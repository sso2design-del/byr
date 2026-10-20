"""메신저 대화 엔진 — 직무/템플릿별 온보딩→질문수집→실행→승인/반려→외부반영→완료.

설계 근거: 02_output/spec/messenger-conversation-design-all-agents-v2.md
- 인텐트 사전(38+ 템플릿)으로 시작 문구 → 템플릿 라우팅(ambiguous면 후보 2개 제시).
- 세션 상태: (platform, channel_id, user_id, agent_id) 키. 파일 백업(data/convo_sessions.json).
- 질문 엔진: required_inputs 누락값만 1개씩. 이미 채운 값 재질문 금지. validation 실패 시 친화 메시지.
- 표준 명령: 승인/확정 · 반려:[사유] · 재실행 dry_run · 재실행 live · 취소.
- 실행 연결: run_and_stage → commit(승인·미리보기) → execute(dry_run/live 반영).

sales/insurance_fp(제안서형)는 기존 slack_bot 경로가 처리 — 이 엔진은 나머지 6직무를 담당한다.
runner 등록 직무(vat_reconcile/hr/pm_brief)는 스키마 required_inputs를 권위값으로 사용하고,
미등록 직무(securities/compliance/dev)는 아래 사전의 입력을 쓰며 실행은 일반 스테이징으로 완주한다.
"""
import os
import re
import json
from datetime import datetime

from . import execution as ex
from . import job_runners as jr
from . import agents as agents_store
from . import audit as au
from . import approval_policy as policy


def _audit(action: str, agent_id: str, stage_id: str, result: str):
    """메신저 기반 액션을 감사로그에 기록(액션타입·agent_id·stage_id·결과코드)."""
    actor = "agent" if action == "STAGE" else "user"
    au.log(actor, action, stage_id or (agent_id or "-"),
           f"[msg] agent={agent_id or '-'} stage={stage_id or '-'} result={result}")

SESSION_FILE = os.path.join(os.path.dirname(__file__), "../data/convo_sessions.json")

# 이 엔진이 대화로 완주시키는 직무(제안서형 sales/insurance_fp는 기존 경로가 담당)
CONVO_JOBS = {"vat_reconcile", "hr", "pm_brief",
              "securities_research", "compliance_aml", "dev_incident"}


# ── 인텐트 사전(템플릿별 시작 문구 + 미등록 직무 입력) ──────────────
def _i(key, job, name, intents, inputs=None):
    return {"key": key, "job": job, "name": name, "intents": intents, "inputs": inputs or []}


def _f(key, label, question, example="", type="string", required=True):
    return {"key": key, "label": label, "question": question,
            "example": example, "type": type, "required": required}


TEMPLATES = [
    # 재무·회계 (runner: 입력은 스키마에서 해결)
    _i("vat", "vat_reconcile", "부가세 대사", ["부가세 대사", "부가세 신고", "매입 매출 대사"]),
    _i("close", "vat_reconcile", "월마감", ["월마감", "월 마감", "마감 보고서"]),
    _i("expense", "vat_reconcile", "지출결의 요약", ["경비 정산", "지출결의", "지출 결의"]),
    _i("budget", "vat_reconcile", "예산 집행", ["예산 집행", "예산 소진"]),
    _i("tax_invoice", "vat_reconcile", "세금계산서 검증", ["세금계산서 검증", "세금계산서 점검"]),
    # 인사 (runner)
    _i("hr", "hr", "인사 요약", ["인사 요약", "근태 요약"]),
    _i("hr_hire", "hr", "채용 공고", ["채용 공고", "공고 초안"]),
    _i("hr_screen", "hr", "이력서 스크리닝", ["이력서 스크리닝", "이력서 분류", "지원자 분류"]),
    _i("hr_onboard", "hr", "온보딩 안내", ["온보딩"]),
    _i("hr_faq", "hr", "인사 FAQ", ["인사 faq", "사규 질문"]),
    # 기획/PM (runner)
    _i("pm_research", "pm_brief", "경쟁사 리서치", ["경쟁사 리서치", "경쟁 리서치"]),
    _i("pm_brief", "pm_brief", "컨셉 브리프", ["컨셉 브리프", "기획 브리프"]),
    _i("pm_spec", "pm_brief", "제품 스펙", ["제품 스펙", "스펙 정리", "요구사항 정리"]),
    _i("pm_meeting", "pm_brief", "회의록 정리", ["회의록 정리", "회의록"]),
    # 증권 리서치 (미등록 → 사전 입력)
    _i("rs_company", "securities_research", "기업 분석", ["기업 분석"],
       [_f("company", "기업명(종목)", "분석할 기업명(또는 종목코드)을 알려주세요.", "삼성전자"),
        _f("period", "분석 기간", "분석 기간을 알려주세요.", "2026 상반기")]),
    _i("rs_dart", "securities_research", "공시 분석", ["공시 분석", "dart 분석"],
       [_f("company", "기업명", "대상 기업명을 알려주세요.", "SK하이닉스"),
        _f("period", "공시 기간", "공시 기간을 알려주세요.", "2026-01~06"),
        _f("event_type", "이벤트 유형", "관심 공시 유형을 알려주세요.", "유상증자")]),
    _i("rs_earnings", "securities_research", "실적 리뷰", ["실적 리뷰"],
       [_f("quarter", "분기", "대상 분기를 알려주세요.", "2026 2Q"),
        _f("company", "기업명", "대상 기업명을 알려주세요.", "네이버"),
        _f("benchmark", "비교 기준", "비교 기준을 알려주세요.", "컨센서스")]),
    _i("rs_sector", "securities_research", "섹터 리서치", ["섹터 리서치", "산업 리서치"],
       [_f("sector", "섹터", "리서치할 섹터를 알려주세요.", "2차전지"),
        _f("period", "기간", "기간을 알려주세요.", "최근 1년"),
        _f("axis", "비교축", "비교축을 알려주세요.", "점유율")]),
    _i("rs_valuation", "securities_research", "밸류에이션", ["밸류에이션"],
       [_f("company", "기업명", "대상 기업명을 알려주세요.", "카카오"),
        _f("method", "방법론", "밸류에이션 방법론을 알려주세요.", "PER/DCF"),
        _f("assumptions", "가정", "핵심 가정을 알려주세요.", "성장률 8%")]),
    # 준법·감사 (미등록)
    _i("aml_monitor", "compliance_aml", "이상거래 모니터링", ["이상거래", "이상 거래"],
       [_f("target", "대상 계정/거래ID", "대상 계정 또는 거래ID를 알려주세요.", "ACC-1023"),
        _f("period", "기간", "점검 기간을 알려주세요.", "2026-06")]),
    _i("aml_str", "compliance_aml", "STR 초안", ["str", "의심거래보고"],
       [_f("case_id", "케이스ID", "케이스ID를 알려주세요.", "STR-2026-014"),
        _f("reason", "의심 사유", "의심 사유를 알려주세요.", "분할 입금 반복"),
        _f("evidence", "증빙", "증빙 요약을 알려주세요.", "거래내역 3건")]),
    _i("aml_kyc", "compliance_aml", "KYC 고객확인", ["kyc"],
       [_f("customer", "고객 식별정보", "고객 식별정보를 알려주세요.", "홍길동/사업자123"),
        _f("scope", "점검 범위", "점검 범위를 알려주세요.", "신규 등록")]),
    _i("aml_control", "compliance_aml", "내부통제 점검", ["내부통제"],
       [_f("process", "점검 대상 프로세스", "점검 대상 프로세스를 알려주세요.", "지급 승인"),
        _f("standard", "기준 문서", "기준 문서를 알려주세요.", "내부통제규정 v3")]),
    _i("aml_reg", "compliance_aml", "규제 모니터링", ["규제 모니터링", "제재 모니터링"],
       [_f("domain", "관할/규제영역", "관할·규제영역을 알려주세요.", "자금세탁방지"),
        _f("period", "기간", "기간을 알려주세요.", "2026 상반기")]),
    # 개발·운영 (미등록)
    _i("dev_sprint", "dev_incident", "스프린트 계획", ["스프린트 계획", "스프린트 플래닝"],
       [_f("epic", "에픽", "대상 에픽을 알려주세요.", "결제 개편"),
        _f("period", "기간", "스프린트 기간을 알려주세요.", "2주"),
        _f("team", "팀", "담당 팀을 알려주세요.", "플랫폼팀")]),
    _i("dev_pr", "dev_incident", "PR 리뷰", ["pr 리뷰", "코드 리뷰"],
       [_f("pr_link", "PR 링크", "리뷰할 PR 링크를 알려주세요.", "github.com/.../pull/42"),
        _f("perspective", "리뷰 관점", "리뷰 관점을 알려주세요.", "성능/보안")]),
    _i("dev_incident", "dev_incident", "인시던트 리포트", ["인시던트", "장애 리포트"],
       [_f("service", "서비스명", "장애가 난 서비스명을 알려주세요.", "결제 API"),
        _f("timerange", "시간 범위", "장애 시간 범위를 알려주세요.", "14:00~14:40"),
        _f("symptom", "증상", "증상을 알려주세요.", "5xx 급증")]),
    _i("dev_doc", "dev_incident", "API 문서", ["api 문서"],
       [_f("module", "대상 모듈", "대상 모듈을 알려주세요.", "auth"),
        _f("version", "버전", "버전을 알려주세요.", "v2"),
        _f("scope", "공개범위", "공개 범위를 알려주세요.", "외부")]),
    _i("ops_monitor", "dev_incident", "모니터링", ["모니터링", "이상 알림"],
       [_f("metric", "지표", "감시할 지표를 알려주세요.", "에러율"),
        _f("threshold", "임계값", "임계값을 알려주세요.", "1%"),
        _f("channel", "채널", "알림 채널을 알려주세요.", "#oncall")]),
    _i("ops_deploy", "dev_incident", "배포 알림", ["배포 알림", "배포 현황"],
       [_f("service", "서비스", "서비스명을 알려주세요.", "web"),
        _f("version", "배포 버전", "배포 버전을 알려주세요.", "1.8.0"),
        _f("env", "환경", "배포 환경을 알려주세요.", "prod")]),
    # 제안서형(온보딩/라우팅 참조용 — 실행은 기존 경로)
    _i("sales_proposal", "sales", "제안서 작성·발송", ["제안서 작성", "고객 제안서", "제안서"]),
    _i("sales_followup", "sales", "미팅 팔로업 메일", ["팔로업 메일", "후속 메일"]),
    _i("sales_report", "sales", "영업 현황 리포트", ["영업 리포트"]),
    _i("sales_contract", "sales", "계약서 검토", ["계약서 검토"]),
    _i("fp_coverage", "insurance_fp", "보장 분석", ["보장 분석"]),
    _i("fp_proposal", "insurance_fp", "맞춤 제안서", ["보험 제안서"]),
    _i("fp_policy_qa", "insurance_fp", "약관 Q&A", ["약관 질문"]),
    _i("fp_compliance", "insurance_fp", "완전판매 체크", ["완전판매 점검"]),
    _i("fp_renewal", "insurance_fp", "갱신 안내", ["갱신 안내"]),
]

_JOB_ROLE = {
    "vat_reconcile": "재무·회계", "hr": "인사·총무", "pm_brief": "기획/PM",
    "securities_research": "증권 리서치", "compliance_aml": "준법·감사",
    "dev_incident": "개발·운영", "sales": "영업", "insurance_fp": "보험 FP",
}


def templates_for_job(job: str) -> list:
    return [t for t in TEMPLATES if t["job"] == job]


# ── 입력 정의 해결(runner=스키마, 그 외=사전) ──────────────────────
_SCHEMA_EXAMPLE = {
    "period_from": "2026-04-01", "period_to": "2026-06-30", "company_code": "NHN01",
    "amount_tolerance_pct": "0", "job_description": "백엔드 5년 이상, Python/FastAPI 실무…",
    "must_have_requirements": "Python 5년, FastAPI", "experience_range": "5-10 years",
    "problem_statement": "현재 문제를 한 문장으로", "success_metrics": "처리시간 50% 단축",
    "in_scope": "승인 게이트, 외부 반영", "out_of_scope": "없음",
}


def resolve_inputs(tpl: dict) -> list:
    """템플릿의 required_inputs. 러너 직무면 template_key 우선 required를 사용."""
    job = tpl["job"]
    if job in jr.JOB_RUNNERS:
        out = []
        for f in jr.required_inputs_for(job, template_key=tpl.get("key")):
            if not f.get("required"):
                continue
            out.append({"key": f["key"], "label": f.get("label", f["key"]),
                        "question": f.get("question_if_missing", f"{f.get('label')}를 알려주세요."),
                        "example": _SCHEMA_EXAMPLE.get(f["key"], ""),
                        "type": f.get("type", "string"),
                        "can_empty": "can be empty" in (f.get("validation") or "")})
        return out
    return [{**f, "can_empty": False} for f in tpl.get("inputs", [])]


# ── 세션 저장 ────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now().isoformat()


def skey(platform: str, channel_id: str, user_id: str, agent_id: str) -> str:
    return "|".join([platform or "", channel_id or "", user_id or "", agent_id or ""])


def _load_all() -> dict:
    if not os.path.exists(SESSION_FILE):
        return {}
    try:
        with open(SESSION_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_all(data: dict):
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_session(key: str) -> dict | None:
    return _load_all().get(key)


def save_session(key: str, sess: dict):
    data = _load_all()
    sess["updated_at"] = _now()
    data[key] = sess
    _save_all(data)


def clear_session(key: str):
    data = _load_all()
    if key in data:
        del data[key]
        _save_all(data)


def _new_session(platform, channel_id, user_id, agent_id) -> dict:
    return {"platform": platform, "channel_id": channel_id, "user_id": user_id,
            "agent_id": agent_id, "current_job": None, "current_template_key": None,
            "collected_inputs": {}, "missing_queue": [], "asking": None,
            "stage_id": None, "last_status": None, "last_error": None,
            "pending_candidates": [], "updated_at": _now()}


# ── 명령 파서 ────────────────────────────────────────────────────
def parse_command(text: str) -> tuple:
    """표준 명령 인식. 반환 (kind, arg). kind None이면 일반 입력."""
    t = (text or "").strip()
    low = t.lower()
    m = re.match(r"^\s*반려\s*[:：]?\s*(.*)$", t)
    if m and (t.startswith("반려") ):
        return ("reject", m.group(1).strip())
    if policy.is_approve_word(t):   # '확인'·'확정'은 평소 말이라 승인으로 보지 않는다
        return ("approve", "")
    if low in ("재실행 dry_run", "재실행 dryrun", "dry_run", "미리보기", "재실행 미리보기"):
        return ("rerun_dry", "")
    if low in ("재실행 live", "재실행 라이브", "live", "최종 반영", "최종반영", "반영"):
        return ("rerun_live", "")
    if t in ("취소", "그만", "중단", "cancel", "stop"):
        return ("cancel", "")
    return (None, t)


# ── 인텐트 라우팅 ────────────────────────────────────────────────
def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def route_intent(job: str, text: str) -> dict:
    """job 범위 템플릿에서 시작 문구 매칭. 반환 {match} | {ambiguous:[...]} | {none:True}."""
    q = _norm(text)
    if not q:
        return {"none": True}
    hits = []
    for t in templates_for_job(job):
        for phrase in t["intents"]:
            if _norm(phrase) in q:
                hits.append(t)
                break
    # 중복 제거(키 기준)
    uniq = []
    seen = set()
    for h in hits:
        if h["key"] not in seen:
            seen.add(h["key"]); uniq.append(h)
    if not uniq:
        return {"none": True}
    if len(uniq) == 1:
        return {"match": uniq[0]}
    return {"ambiguous": uniq[:2]}


# ── 값 변환·검증 ──────────────────────────────────────────────────
_EMPTY_TOKENS = {"없음", "none", "-", "스킵", "건너뛰기", "skip"}


def coerce(field: dict, raw: str):
    t = field.get("type", "string")
    raw = (raw or "").strip()
    if t == "array":
        if raw.lower() in _EMPTY_TOKENS:
            return []
        return [p.strip() for p in re.split(r"[,\n;]", raw) if p.strip()]
    if t == "number":
        try:
            return int(raw) if re.fullmatch(r"-?\d+", raw) else float(raw)
        except ValueError:
            return raw
    return raw


def validate_field(field: dict, value) -> str:
    """유효성 검사. 통과 시 '' , 실패 시 사용자 친화 메시지."""
    key = field["key"]
    ex = field.get("example", "")
    ex_hint = f" (예: {ex})" if ex else ""
    empty = value is None or (isinstance(value, str) and not value.strip()) or \
        (isinstance(value, list) and len(value) == 0) or \
        (isinstance(value, str) and value.strip().lower() in _EMPTY_TOKENS)   # 필수 칸의 '없음'은 빈 값으로 본다
    if empty:
        if field.get("can_empty"):
            return ""
        return f"'{field['label']}'가 필요합니다.{ex_hint}"
    if field.get("type") == "number" and not isinstance(value, (int, float)):
        return f"'{field['label']}'는 숫자로 입력해주세요.{ex_hint}"
    if key == "amount_tolerance_pct" and isinstance(value, (int, float)) and not (0 <= value <= 100):
        return f"'{field['label']}'는 0~100 사이 숫자여야 합니다.{ex_hint}"
    is_date = field.get("type") == "date" or "YYYY-MM-DD" in (field.get("question") or "")
    if is_date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value)):
        return f"'{field['label']}'는 YYYY-MM-DD 형식으로 입력해주세요.{ex_hint}"
    return ""


# ── 메시지 빌더 ──────────────────────────────────────────────────
def onboarding_message(agent: dict) -> str:
    job = agent.get("job")
    name = agent.get("name", "에이전트")
    role = _JOB_ROLE.get(job, agent.get("role", "업무"))
    starts = []
    for t in templates_for_job(job)[:3]:
        if t["intents"]:
            starts.append(t["intents"][0])
    hint = " / ".join(f"`{s}`" for s in starts) or "시작 문구"
    return (f"안녕하세요, *{name}*입니다. {role} 업무를 도와드립니다.\n"
            f"바로 시작하려면 예: {hint} 라고 입력해주세요.")


def _ask_question(field: dict) -> str:
    ex = field.get("example", "")
    hint = f"\n_예: {ex}_" if ex else ""
    return f":speech_balloon: {field['question']}{hint}"


def _summary_message(rec: dict) -> str:
    status = rec.get("status")
    summ = rec.get("summary", "")
    reasons = rec.get("approval_reasons") or []
    lines = [f":page_facing_up: *작업 초안 준비됨* — {summ}", f"결과 ID: `{rec.get('stage_id')}`"]
    if rec.get("blocked"):
        blocks = [f["desc"] for f in (rec.get("rule_findings") or []) if f.get("action") == "block"]
        lines.append(":no_entry: *확정 불가(blocked)*: " + (" · ".join(blocks) or "규칙 위반"))
        lines.append("다음 액션: 입력을 수정한 뒤 다시 시작해주세요.")
    elif rec.get("approval_required"):
        if reasons:
            lines.append("승인 사유: " + " · ".join(reasons))
        lines.append("초안이 준비되었습니다. 확정(승인)할까요? — `승인` / `반려: 사유`")
    else:
        lines.append("검증 규칙 통과. 확정하려면 `승인`.")
    return "\n".join(lines)


def _completion_message(result: dict) -> str:
    if result.get("ok"):
        ext = result.get("id") or (result.get("external_ids") or ["-"])[0]
        extra = " (일부 실패 — 성공분 유지)" if result.get("partial_success") else ""
        return (f":white_check_mark: *작업 완료*: {result.get('message', '외부 반영 완료')}{extra}\n"
                f"결과 ID: `{ext}`\n다음 액션: `취소`로 종료하거나 새 작업을 시작하세요.")
    err = result.get("error")
    hint = {
        "not_approved": "먼저 `승인`으로 확정하세요.",
        "blocked": "규칙 위반으로 반영할 수 없습니다. 입력을 수정하세요.",
        "connector_error": "외부 시스템 오류입니다. 잠시 후 `재실행 live`로 다시 시도하세요.",
        "permission_denied": "권한이 없습니다. 연결/권한을 확인하세요.",
        "not_configured": "실 커넥터가 아직 연결되지 않았습니다(관리자 설정 필요).",
        "timeout": "시간 초과입니다. `재실행 live`로 다시 시도하세요.",
    }.get(err, "다시 시도해주세요.")
    return f":warning: *반영 실패* ({err}): {result.get('message', '')}\n{hint}"


# ── 진행 헬퍼 ────────────────────────────────────────────────────
def _start_template(sess: dict, tpl: dict) -> list:
    """템플릿 확정 → 미질문 큐 구성 → 첫 질문."""
    sess["current_job"] = tpl["job"]
    sess["current_template_key"] = tpl["key"]
    sess["pending_candidates"] = []
    fields = resolve_inputs(tpl)
    collected = sess.get("collected_inputs") or {}
    missing = [f["key"] for f in fields if f["key"] not in collected]
    sess["missing_queue"] = missing
    sess["last_status"] = "intake"
    return _next_prompt(sess, tpl, intro=f":robot_face: *{tpl['name']}* 시작할게요.")


def _fields_map(tpl: dict) -> dict:
    return {f["key"]: f for f in resolve_inputs(tpl)}


def _next_prompt(sess: dict, tpl: dict, intro: str = "") -> list:
    """다음 미질문 항목 1개 질문, 없으면 실행."""
    fmap = _fields_map(tpl)
    queue = [k for k in sess.get("missing_queue", []) if k in fmap]
    sess["missing_queue"] = queue
    if queue:
        sess["asking"] = queue[0]
        msg = _ask_question(fmap[queue[0]])
        return [f"{intro}\n{msg}" if intro else msg]
    # 입력 완료 → 실행
    return _run(sess, tpl, intro)


def _run(sess: dict, tpl: dict, intro: str = "") -> list:
    sess["asking"] = None
    sess["last_status"] = "running"
    agent = agents_store.get_agent(sess["agent_id"]) or {"id": sess["agent_id"], "job": tpl["job"]}
    inputs = dict(sess.get("collected_inputs") or {})
    job = tpl["job"]
    if job in jr.JOB_RUNNERS:
        missing = jr.validate_inputs(job, inputs, template_key=tpl.get("key"))
        if missing:  # 방어: 누락 재질문
            sess["missing_queue"] = [m["key"] for m in missing]
            return _next_prompt(sess, tpl)
    inputs["_template_key"] = tpl.get("key")
    rec = ex.run_and_stage(sess["agent_id"], agent, inputs)
    sess["stage_id"] = rec["stage_id"]
    sess["last_status"] = rec.get("status")
    _audit("STAGE", sess["agent_id"], rec["stage_id"], f"{job}/{tpl.get('key')}:{rec.get('status')}")
    out = [_summary_message(rec)]
    if intro:
        out[0] = intro + "\n" + out[0]
    return out


# ── 메인 엔트리 ──────────────────────────────────────────────────
def handle(platform: str, channel_id: str, user_id: str, agent: dict, text: str) -> list:
    """메신저 1턴 처리. 반환: 보낼 메시지 리스트(순서대로)."""
    job = agent.get("job")
    key = skey(platform, channel_id, user_id, agent.get("id", ""))
    sess = get_session(key) or _new_session(platform, channel_id, user_id, agent.get("id", ""))
    kind, arg = parse_command(text)

    # 표준 명령 우선
    if kind == "cancel":
        _audit("CANCEL", sess.get("agent_id"), sess.get("stage_id"), "cancelled")
        clear_session(key)
        return [":wave: 진행을 취소했어요. 다시 시작하려면 시작 문구를 입력해주세요."]
    if kind == "approve":
        if not (sess.get("stage_id") and sess.get("last_status") == "staged"):
            other = _pending_for_approver(platform, channel_id, user_id, agent)
            if other:   # 지정 승인자가 다른 사람의 대기 건을 승인
                return _cmd_approve(other[0], other[1], user_id, agent)
        return _cmd_approve(key, sess, user_id, agent)
    if kind == "reject":
        return _cmd_reject(key, sess, arg)
    if kind in ("rerun_dry", "rerun_live"):
        return _cmd_rerun(key, sess, live=(kind == "rerun_live"))

    # 초안이 승인을 기다리는 중 → 평소 말('확인' 등)로 초안을 다시 만들지 않는다
    if sess.get("stage_id") and sess.get("last_status") == "staged":
        return [":hourglass_flowing_sand: 초안이 승인을 기다리고 있어요. `승인` / `반려: 사유` / `취소` 중에 답해주세요."]
    # 승인·반영이 끝난 뒤의 일반 대화 → 새 작업으로 시작(이전 작업을 다시 실행하지 않는다)
    if sess.get("last_status") in ("committed", "reflected"):
        clear_session(key)
        sess = _new_session(platform, channel_id, user_id, agent.get("id", ""))

    # ambiguous 후보 선택 대기 중
    if sess.get("pending_candidates"):
        chosen = _match_candidate(sess["pending_candidates"], text)
        if chosen:
            out = _start_template(sess, chosen)
            save_session(key, sess)
            return out
        cands = " / ".join(f"`{c['name']}`" for c in sess["pending_candidates"])
        return [f"어떤 작업을 원하시나요? {cands} 중에 골라주세요."]

    # 진행 중 템플릿 없으면 → 인텐트 라우팅
    if not sess.get("current_template_key"):
        r = route_intent(job, text)
        if r.get("match"):
            out = _start_template(sess, r["match"])
            save_session(key, sess)
            return out
        if r.get("ambiguous"):
            sess["pending_candidates"] = r["ambiguous"]
            save_session(key, sess)
            cands = " / ".join(f"`{c['name']}`" for c in r["ambiguous"])
            return [f":thinking_face: 어떤 작업을 원하시나요? {cands}"]
        return [onboarding_message(agent)]

    # 입력 수집 중 → 현재 질문 항목 채우기
    tpl = next((t for t in TEMPLATES if t["key"] == sess["current_template_key"]), None)
    if not tpl:
        clear_session(key)
        return [onboarding_message(agent)]
    fmap = _fields_map(tpl)
    asking = sess.get("asking")
    if asking and asking in fmap:
        field = fmap[asking]
        value = coerce(field, text)
        err = validate_field(field, value)
        if err:
            return [f":warning: {err}"]
        sess.setdefault("collected_inputs", {})[asking] = value
        sess["missing_queue"] = [k for k in sess.get("missing_queue", []) if k != asking]
        out = _next_prompt(sess, tpl)
        save_session(key, sess)
        return out
    # asking 상태가 아닌데 진행 중 → 다음 질문/실행 재개
    out = _next_prompt(sess, tpl)
    save_session(key, sess)
    return out


def _match_candidate(cands: list, text: str) -> dict | None:
    q = _norm(text)
    for c in cands:
        if _norm(c["name"]) in q or any(_norm(p) in q for p in c["intents"]):
            return c
    return None


def _pending_for_approver(platform, channel_id, user_id, agent) -> tuple | None:
    """같은 채널·같은 에이전트에서 승인을 기다리는 다른 사람의 세션.
    user_id 가 이 에이전트의 지정 승인자일 때만 찾는다. 가장 최근 건 하나."""
    if user_id not in policy.approvers_of(agent):
        return None
    cands = [(k, v) for k, v in _load_all().items()
             if v.get("platform") == platform and v.get("channel_id") == channel_id
             and v.get("agent_id") == agent.get("id") and v.get("user_id") != user_id
             and v.get("stage_id") and v.get("last_status") == "staged"]
    cands.sort(key=lambda kv: kv[1].get("updated_at", ""), reverse=True)
    return cands[0] if cands else None


def _cmd_approve(key: str, sess: dict, actor: str = "", agent: dict | None = None) -> list:
    sid = sess.get("stage_id")
    if not sid:
        return ["진행 중인 작업이 없어요. 시작 문구로 새 작업을 시작해주세요."]
    if sess.get("last_status") in ("committed", "reflected"):   # 같은 건을 두 번 확정하지 않는다
        return [":information_source: 이미 승인한 작업이에요. 외부 반영은 `재실행 live`, 새 작업은 시작 문구로 시작해주세요."]
    verdict = policy.check(agent or {}, sess.get("user_id", ""), actor)
    if not verdict.get("ok"):
        _audit("COMMIT", sess.get("agent_id"), sid, f"denied:{verdict.get('reason')}")
        return [f":lock: {verdict['message']}"]
    rec = ex.commit(sid, actor=actor, self_approved=verdict.get("self_approved", False))  # 기본 dry_run(승인+미리보기)
    if rec.get("error") == "blocked":
        _audit("COMMIT", sess.get("agent_id"), sid, "blocked")
        return [f":no_entry: 규칙 위반으로 확정할 수 없습니다: {rec.get('message', '')}"]
    sess["last_status"] = "committed"
    ear = rec.get("external_action_result")
    _audit("COMMIT", sess.get("agent_id"), sid,
           f"ok/{(ear or {}).get('error') or (ear or {}).get('id') or 'committed'}")
    save_session(key, sess)
    who = " (요청자 본인 승인)" if verdict.get("self_approved") else f" (승인자 <@{actor}>)"
    lines = [f":white_check_mark: 승인 완료{who} — 확정(스테이징)했습니다."]
    if ear:
        lines.append(f":mag: 미리보기: {ear.get('message', '')}")
        lines.append("실제 외부 반영은 `재실행 live`, 다시 미리보려면 `재실행 dry_run`.")
    else:
        lines.append("다음 액션: 완료. 새 작업을 시작하려면 시작 문구를 입력하세요.")
    return ["\n".join(lines)]


def _cmd_reject(key: str, sess: dict, reason: str) -> list:
    sid = sess.get("stage_id")
    if not sid and not sess.get("current_template_key"):
        return ["반려할 진행 중 작업이 없어요."]
    sess["last_status"] = "rejected"
    sess["last_error"] = reason or "(사유 미기재)"
    if sid:
        ex.undo(sid)
    _audit("REJECT", sess.get("agent_id"), sid, f"rejected:{sess['last_error']}")
    sess["stage_id"] = None
    # 다음 입력 요청: 수정할 항목을 다시 받도록 수집 재개
    tpl = next((t for t in TEMPLATES if t["key"] == sess.get("current_template_key")), None)
    save_session(key, sess)
    base = f":arrows_counterclockwise: 반려 사유 기록: {sess['last_error']}."
    if tpl:
        # 수정 편의를 위해 전체 재입력을 다시 큐잉
        sess["collected_inputs"] = {}
        sess["missing_queue"] = [f["key"] for f in resolve_inputs(tpl)]
        out = _next_prompt(sess, tpl, intro=base + " 수정해서 다시 진행할게요.")
        save_session(key, sess)
        return out
    return [base + " 다음 입력을 알려주세요."]


def _cmd_rerun(key: str, sess: dict, live: bool) -> list:
    sid = sess.get("stage_id")
    if not sid:
        return ["재실행할 작업이 없어요. 먼저 시작하고 `승인`까지 진행해주세요."]
    result = ex.execute_external_action(sid, dry_run=not live)
    mode = "live" if live else "dry_run"
    _audit("EXTERNAL_ACTION", sess.get("agent_id"), sid,
           f"{mode}/{result.get('error') or ('ok:' + str(result.get('id')))}"
           f"/보낸값:{ex.payload_digest(result.get('payload') or result.get('sent'))}")
    if result.get("error") == "not_approved":
        return [":lock: 승인 전에는 외부 실행이 차단됩니다. 먼저 `승인`을 해주세요."]
    if result.get("error") == "blocked":
        return [":no_entry: 규칙 위반으로 반영할 수 없습니다."]
    if result.get("error") == "already_reflected":
        return [":repeat: 이미 반영된 작업이에요. 같은 내용을 다시 보내려면 새로 시작해서 승인받아주세요."]
    if live and result.get("ok"):
        sess["last_status"] = "reflected"
    save_session(key, sess)
    if not live:  # dry_run 미리보기
        return [f":mag: 미리보기: {result.get('message', '')}\n실제 반영은 `재실행 live`."]
    return [_completion_message(result)]
