"""
직무별 완주형 태스크 실행 엔진 — 8블록 스키마(agent-template-schema-v1.json) 기반.

run 고정 데모를 제거하고, 직무별로 plan/run이 분기 실행되도록 한다:
  - build_plan(job): 스키마의 required_inputs·rules·gate·artifact를 계획으로 노출
  - validate_inputs(job, inputs): 필수 입력 검증 → 누락 필드 리스트
  - run(job, inputs): 결정론적 규칙 적용 → artifact + approval_required/reasons + rule_findings

데이터 소스(ERP·이력서 등)가 아직 목이므로 artifact는 입력 기반의 현실적 예시로 생성하되,
승인 게이트 판단(approval_required/reasons)과 규칙 위반(rule_findings)은 실제 로직으로 계산한다.
"""
import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Optional

# HR-R-002: 채용 평가에 반영 금지되는 민감정보(PII) — 입력단 정적 탐지용.
# 속성 명사 또는 명시적 차별 표현만 매칭해 오탐(정상 JD)을 억제한다.
_PII_PATTERNS = [
    ("나이/연령", r"나이|연령|만\s?\d+\s?세|\b\d{1,2}\s?세\b|\bage\b"),
    ("성별", r"성별|남성\s?(우대|선호|만)|여성\s?(우대|선호|만)|남녀\s?구분|\bgender\b|\b(male|female)\s?(only|preferred)"),
    ("혼인", r"혼인|기혼|미혼|결혼\s?여부|\bmarital\b"),
    ("종교", r"종교|\breligion\b|기독교|불교|천주교|무교"),
    ("건강/장애", r"건강\s?상태|병력|지병|장애\s?(여부|등급)|\bdisability\b|health\s?condition"),
    ("출신/가족", r"출신\s?지역|본적|가족\s?관계|호주\s?관계"),
]
# 정적 검사에서 제외할 제어 키(값이 민감어를 담지 않는 운영 파라미터)
_PII_SKIP_KEYS = {"simulate_action", "action_target", "review_channel", "post_channel", "company_code"}


def _req(key, label, q, type="string", required=True, validation=""):
    return {
        "key": key,
        "label": label,
        "type": type,
        "required": required,
        "question_if_missing": q,
        "validation": validation,
    }


_PRIMARY_TEMPLATE_BY_JOB = {
    "vat_reconcile": "vat",
    "hr": "hr",
    "pm_brief": "pm_brief",
    "securities_research": "rs_company",
    "compliance_aml": "aml_monitor",
    "dev_incident": "dev_incident",
}


_RUNNER_TEMPLATE_INPUTS = {
    "vat": [_req("period_from", "기간 시작", "기간 시작일을 입력해주세요 (YYYY-MM-DD)."),
            _req("period_to", "기간 종료", "기간 종료일을 입력해주세요 (YYYY-MM-DD)."),
            _req("company_code", "회사 코드", "회사 코드를 입력해주세요 (예: NHN01)."),
            _req("amount_tolerance_pct", "허용 오차(%)", "허용 오차를 숫자로 입력해주세요 (0~100).", type="number")],
    "close": [_req("period_from", "기간 시작", "마감 기간 시작일을 입력해주세요 (YYYY-MM-DD)."),
              _req("period_to", "기간 종료", "마감 기간 종료일을 입력해주세요 (YYYY-MM-DD)."),
              _req("company_code", "회사 코드", "회사 코드를 입력해주세요 (예: NHN01)."),
              _req("close_scope", "마감 범위", "마감 범위를 입력해주세요 (예: 법인 전체/사업부).")],
    "expense": [_req("period_from", "기간 시작", "정산 기간 시작일을 입력해주세요 (YYYY-MM-DD)."),
                _req("period_to", "기간 종료", "정산 기간 종료일을 입력해주세요 (YYYY-MM-DD)."),
                _req("department", "부서", "대상 부서를 입력해주세요 (예: 영업본부)."),
                _req("proof_scope", "증빙 범위", "증빙 범위를 입력해주세요 (예: 카드+세금계산서).")],
    "budget": [_req("fiscal_period", "회계 기간", "회계 기간을 입력해주세요 (예: 2026-Q3)."),
               _req("department", "부서", "대상 부서를 입력해주세요."),
               _req("budget_version", "예산 버전", "예산 버전을 입력해주세요 (예: v2).")],
    "tax_invoice": [_req("period_from", "기간 시작", "검증 기간 시작일을 입력해주세요 (YYYY-MM-DD)."),
                    _req("period_to", "기간 종료", "검증 기간 종료일을 입력해주세요 (YYYY-MM-DD)."),
                    _req("vendor_scope", "거래처 범위", "검증할 거래처 범위를 입력해주세요."),
                    _req("invoice_rules", "검증 규칙", "검증 규칙을 입력해주세요 (예: 중복/금액불일치).")],
    "hr": [_req("period", "기간", "대상 기간을 입력해주세요 (예: 2026-06)."),
           _req("target_team", "대상 팀", "대상 팀을 입력해주세요."),
           _req("kpi_scope", "지표 범위", "집계할 지표 범위를 입력해주세요.")],
    "hr_hire": [_req("job_title", "직무명", "채용 직무명을 입력해주세요."),
                _req("must_have_requirements", "필수 요건", "필수 요건을 입력해주세요.", type="array"),
                _req("nice_to_have_requirements", "우대 요건", "우대 요건을 입력해주세요.", type="array", validation="can be empty")],
    "hr_screen": [_req("job_description", "JD", "채용 JD를 입력해주세요."),
                  _req("must_have_requirements", "필수 요건", "필수 요건을 입력해주세요.", type="array"),
                  _req("experience_range", "경력 범위", "경력 범위를 입력해주세요 (예: 5-10 years).")],
    "hr_onboard": [_req("start_date", "입사일", "입사일을 입력해주세요 (YYYY-MM-DD)."),
                   _req("role", "직무", "입사자 직무를 입력해주세요."),
                   _req("checklist_policy", "체크리스트 기준", "적용할 온보딩 기준을 입력해주세요.")],
    "hr_faq": [_req("question", "질문", "인사 관련 질문을 입력해주세요.")],
    "pm_research": [_req("topic", "주제", "리서치 주제를 입력해주세요."),
                    _req("competitors", "비교 대상", "비교 대상을 입력해주세요.", type="array"),
                    _req("period", "기간", "분석 기간을 입력해주세요.")],
    "pm_brief": [_req("problem_statement", "문제 정의", "해결할 문제를 한 문장으로 입력해주세요."),
                 _req("success_metrics", "성공 지표", "성공 지표를 입력해주세요.", type="array"),
                 _req("in_scope", "포함 범위", "포함 범위를 입력해주세요.", type="array"),
                 _req("out_of_scope", "제외 범위", "제외 범위를 입력해주세요.", type="array", validation="can be empty")],
    "pm_spec": [_req("feature_list", "기능 목록", "기능 목록을 입력해주세요.", type="array"),
                _req("priority_rule", "우선순위 기준", "우선순위 기준을 입력해주세요."),
                _req("release_scope", "릴리즈 범위", "릴리즈 범위를 입력해주세요.")],
    "pm_meeting": [_req("notes", "회의 메모", "회의 메모를 입력해주세요."),
                   _req("attendees", "참석자", "참석자를 입력해주세요.", type="array"),
                   _req("decision_points", "결정 필요사항", "결정 필요사항을 입력해주세요.", type="array")],
    "rs_company": [_req("company", "기업명(종목)", "분석할 기업명(또는 종목코드)을 입력해주세요."),
                   _req("period", "분석 기간", "분석 기간을 입력해주세요.")],
    "rs_dart": [_req("company", "기업명", "대상 기업명을 입력해주세요."),
                _req("period", "공시 기간", "공시 기간을 입력해주세요."),
                _req("event_type", "이벤트 유형", "관심 공시 유형을 입력해주세요.")],
    "rs_earnings": [_req("quarter", "분기", "분기를 입력해주세요."),
                    _req("company", "기업명", "기업명을 입력해주세요."),
                    _req("benchmark", "비교 기준", "비교 기준을 입력해주세요.")],
    "rs_sector": [_req("sector", "섹터", "섹터를 입력해주세요."),
                  _req("period", "기간", "기간을 입력해주세요."),
                  _req("axis", "비교축", "비교축을 입력해주세요.")],
    "rs_valuation": [_req("company", "기업명", "기업명을 입력해주세요."),
                     _req("method", "방법론", "방법론을 입력해주세요."),
                     _req("assumptions", "핵심 가정", "핵심 가정을 입력해주세요.")],
    "aml_monitor": [_req("target", "대상 계정/거래ID", "대상 계정 또는 거래ID를 입력해주세요."),
                    _req("period", "기간", "점검 기간을 입력해주세요.")],
    "aml_str": [_req("case_id", "케이스ID", "케이스ID를 입력해주세요."),
                _req("reason", "의심 사유", "의심 사유를 입력해주세요."),
                _req("evidence", "증빙", "증빙 요약을 입력해주세요.")],
    "aml_kyc": [_req("customer", "고객 식별정보", "고객 식별정보를 입력해주세요."),
                _req("scope", "점검 범위", "점검 범위를 입력해주세요.")],
    "aml_control": [_req("process", "점검 대상 프로세스", "점검 대상 프로세스를 입력해주세요."),
                    _req("standard", "기준 문서", "기준 문서를 입력해주세요.")],
    "aml_reg": [_req("domain", "관할/규제영역", "관할·규제영역을 입력해주세요."),
                _req("period", "기간", "기간을 입력해주세요.")],
    "dev_sprint": [_req("epic", "에픽", "대상 에픽을 입력해주세요."),
                   _req("period", "기간", "스프린트 기간을 입력해주세요."),
                   _req("team", "팀", "담당 팀을 입력해주세요.")],
    "dev_pr": [_req("pr_link", "PR 링크", "리뷰할 PR 링크를 입력해주세요."),
               _req("perspective", "리뷰 관점", "리뷰 관점을 입력해주세요.")],
    "dev_incident": [_req("service", "서비스명", "장애가 난 서비스명을 입력해주세요."),
                     _req("timerange", "시간 범위", "장애 시간 범위를 입력해주세요."),
                     _req("symptom", "증상", "증상을 입력해주세요.")],
    "dev_doc": [_req("module", "대상 모듈", "대상 모듈을 입력해주세요."),
                _req("version", "버전", "버전을 입력해주세요."),
                _req("scope", "공개 범위", "공개 범위를 입력해주세요.")],
    "ops_monitor": [_req("metric", "지표", "감시 지표를 입력해주세요."),
                    _req("threshold", "임계값", "임계값을 입력해주세요."),
                    _req("channel", "채널", "알림 채널을 입력해주세요.")],
    "ops_deploy": [_req("service", "서비스", "서비스명을 입력해주세요."),
                   _req("version", "배포 버전", "배포 버전을 입력해주세요."),
                   _req("env", "환경", "배포 환경을 입력해주세요.")],
}


def scan_pii(inputs: dict) -> list:
    """입력 문자열에서 금지 민감정보 신호 탐지. 반환: [{field,label,term}]."""
    hits = []
    for key, val in (inputs or {}).items():
        if key in _PII_SKIP_KEYS:
            continue
        text = " ".join(map(str, val)) if isinstance(val, (list, tuple)) else str(val)
        for label, pat in _PII_PATTERNS:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                hits.append({"field": key, "label": label, "term": m.group(0).strip()})
    return hits

# 스키마: 에이전트 템플릿 스키마 v1
_SCHEMA_PATH = Path(__file__).resolve().parents[3] / "02_output" / "spec" / "agent-template-schema-v1.json"


def _load_schema() -> dict:
    try:
        data = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
        return {t["job"]: t for t in data.get("templates", [])}
    except Exception:
        return {}


_SCHEMA = _load_schema()


def schema_for(job: str) -> dict:
    return _SCHEMA.get(job, {})


def _required_inputs(job: str) -> list:
    return (_SCHEMA.get(job) or {}).get("required_inputs", [])


def required_inputs_for(job: str, template_key: Optional[str] = None) -> list:
    """job/template 기준 required_inputs. template override > schema > primary template."""
    if template_key and template_key in _RUNNER_TEMPLATE_INPUTS:
        return deepcopy(_RUNNER_TEMPLATE_INPUTS[template_key])
    req = _required_inputs(job)
    if req:
        return deepcopy(req)
    primary = _PRIMARY_TEMPLATE_BY_JOB.get(job)
    if primary and primary in _RUNNER_TEMPLATE_INPUTS:
        return deepcopy(_RUNNER_TEMPLATE_INPUTS[primary])
    return []


def validate_inputs(job: str, inputs: Optional[dict], template_key: Optional[str] = None) -> list:
    """필수 입력 검증. 반환: 누락/무효 필드 [{key,label,message}]."""
    inputs = inputs or {}
    problems = []
    for f in required_inputs_for(job, template_key=template_key):
        if not f.get("required"):
            continue
        key = f["key"]
        val = inputs.get(key)
        allow_empty = "can be empty" in (f.get("validation") or "")
        empty = val is None or (isinstance(val, str) and not val.strip()) or \
            (isinstance(val, (list, dict)) and len(val) == 0)
        if empty and not allow_empty:
            problems.append({
                "key": key, "label": f.get("label", key),
                "message": f.get("question_if_missing", f"{f.get('label', key)}가 필요합니다."),
            })
    return problems


def build_plan(job: str, agent: dict, template_key: Optional[str] = None) -> dict:
    """직무별 실행 계획(스키마 기반). ExecutionFlow 호환 필드(task·steps·source_files) 포함."""
    t = _SCHEMA.get(job) or {}
    reqs = required_inputs_for(job, template_key=template_key)
    fmt = (t.get("draft_artifact") or {}).get("format", "산출물")
    steps = [
        "필수 입력 확인",
        "근거 소스 연결 확인",
        "결정론적 규칙 검증",
        f"{fmt.upper()} 초안 생성 · 스테이징(덮어쓰기 없음)",
        "승인 게이트 판단",
    ]
    return {
        "agent_id": agent.get("id"),
        "job": job,
        "task": t.get("name", "실행"),
        "goal": t.get("goal", "직무 실행을 위한 입력 수집·규칙 검증·승인·외부반영"),
        "steps": steps,
        "required_inputs": [
            {"key": f["key"], "label": f.get("label", f["key"]), "type": f.get("type", "string"),
             "required": f.get("required", False), "question_if_missing": f.get("question_if_missing", "")}
            for f in reqs
        ],
        "evidence_sources": t.get("evidence_sources", {}),
        "deterministic_rules": t.get("deterministic_rules", []),
        "approval_gate": t.get("approval_gate", {}),
        "external_action": t.get("external_action", {}),
        "artifact_format": fmt,
        # ExecutionFlow 하위호환
        "source_files": (t.get("evidence_sources") or {}).get("required_files", []),
    }


# ── 직무별 run ─────────────────────────────────────────────────────

def _run_vat(inputs: dict) -> dict:
    tol = float(inputs.get("amount_tolerance_pct", 0) or 0)
    matched = 47
    detected_err = 2.0  # 목: 탐지된 공급가액-세액 오차(%)
    anomalies = []
    if detected_err > tol:  # 허용 오차보다 크면 이상건으로 분류(작으면 clean run)
        anomalies = [
            {"rule": "VAT-R-001", "desc": "세금계산서 중복 의심(거래처 A · 2026-05-11 · ₩3,300,000)",
             "severity": "high", "action": "manual_review", "ref": "매출_2026Q2.xlsx · B23"},
            {"rule": "VAT-R-002", "desc": f"공급가액-세액 불일치(오차 {detected_err:.1f}% > 허용 {tol}%)",
             "severity": "high", "action": "manual_review", "ref": "매입_2026Q2.xlsx · D41"},
            {"rule": "VAT-R-003", "desc": "거래처-계정 매핑 누락(거래처 C)",
             "severity": "medium", "action": "warn", "ref": "매입_2026Q2.xlsx · E17"},
        ]
    high = [a for a in anomalies if a["severity"] == "high"]
    approval_required = len(anomalies) > 0
    reasons = []
    if high:
        reasons.append(f"고위험 이상 {len(high)}건(중복·공급가액-세액 규칙) — 재무 담당자 승인 필요")
    if any(a["action"] == "warn" for a in anomalies):
        reasons.append("경고 항목 1건(계정 매핑) 확인 필요")
    artifact = {
        "matched_count": matched,
        "anomalies": anomalies,
        "approval_queue": high,
        "commit_payload": {"target": "update_erp|update_sheet", "entries": matched,
                           "adjustments": len(anomalies), "approval_id": None, "dry_run": True},
    }
    summary = (f"{inputs.get('company_code', '')} {inputs.get('period_from', '')}~{inputs.get('period_to', '')} "
               f"대사: 매칭 {matched}건 · 이상 {len(anomalies)}건(고위험 {len(high)})")
    return {"summary": summary, "artifact": artifact,
            "approval_required": approval_required, "approval_reasons": reasons,
            "rule_findings": anomalies, "blocked": False}


def _run_hr(inputs: dict) -> dict:
    # HR-R-002: 입력단 민감정보(PII) 정적 검사 — 위반 시 즉시 blocked(스크리닝 미실행).
    pii = scan_pii(inputs)
    if pii:
        labels = ", ".join(sorted({f"{h['label']}('{h['term']}')" for h in pii}))
        findings = [{"rule": "HR-R-002", "desc": f"민감정보 평가 반영 금지 위반: {labels}",
                     "severity": "high", "action": "block", "evidence": pii}]
        return {
            "summary": f"민감정보 감지 {len(pii)}건 — 스크리닝 차단(입력에서 {labels} 제거 필요)",
            "artifact": {"pii_findings": pii,
                         "rationale": "채용 평가에 반영 금지 정보(나이·성별·혼인·종교·건강 등)가 입력에 포함되어 실행을 차단했습니다."},
            "approval_required": True,
            "approval_reasons": ["민감정보 포함 — 입력 정정 후 재실행 필요"],
            "rule_findings": findings, "blocked": True,
        }
    musts = inputs.get("must_have_requirements") or []
    exp = inputs.get("experience_range", "")
    # 이력서 소스가 목이므로 예시 후보 — 각 후보 '근거' 필수(HR-R-003), 민감정보 미반영(HR-R-002)
    scorecard = [
        {"name": "후보 A", "score": 86, "decision": "shortlist",
         "rationale": f"필수요건 {len(musts)}개 중 대부분 충족: 관련 경력({exp})·유사 프로젝트 근거 확인"},
        {"name": "후보 B", "score": 71, "decision": "hold",
         "rationale": "핵심 경력 일부 부합, 요건 1개 근거 불명확 — 인터뷰로 확인 권장"},
        {"name": "후보 C", "score": 39, "decision": "reject",
         "rationale": "필수요건 다수 미충족(근거: 요구 기술 실무 경험 서류상 없음)"},
    ]
    shortlist = [c for c in scorecard if c["decision"] == "shortlist"]
    hold = [c for c in scorecard if c["decision"] == "hold"]
    reject = [c for c in scorecard if c["decision"] == "reject"]
    # HR-R-001: 근거 없는 자동 탈락 금지 → 위반 시 block
    findings = []
    no_reason = [c for c in reject if not (c.get("rationale") or "").strip()]
    if no_reason:
        findings.append({"rule": "HR-R-001", "desc": f"근거 없는 자동 탈락 {len(no_reason)}건",
                         "severity": "high", "action": "block"})
    approval_required = True  # 숏리스트 확정 전 + 자동 탈락 존재
    reasons = ["숏리스트 확정 전 채용 담당자 승인 필요"]
    if reject:
        reasons.append(f"자동 탈락 후보 {len(reject)}명 — 탈락 근거 검토 필요")
    artifact = {
        "candidate_scorecard": scorecard, "shortlist": shortlist, "hold_list": hold, "reject_list": reject,
        "rationale": "필수요건 대비 점수화. 각 후보 근거 첨부. 민감정보(나이·성별·혼인·종교)는 평가에 반영하지 않음.",
    }
    summary = f"지원자 {len(scorecard)}명 스크리닝: 숏리스트 {len(shortlist)} · 보류 {len(hold)} · 탈락 {len(reject)}"
    return {"summary": summary, "artifact": artifact,
            "approval_required": approval_required, "approval_reasons": reasons,
            "rule_findings": findings, "blocked": any(f["action"] == "block" for f in findings)}


def _run_pm(inputs: dict) -> dict:
    problem = inputs.get("problem_statement", "")
    metrics = inputs.get("success_metrics") or []
    in_scope = inputs.get("in_scope") or []
    out_scope = inputs.get("out_of_scope") or []
    acceptance = []
    jira = []
    qa = []
    for i, item in enumerate(in_scope, 1):
        acceptance.append({"requirement": item,
                           "criteria": [f"{item} 완료 시 {metrics[0] if metrics else '목표 지표'} 충족",
                                        f"{item} 예외/에러 처리가 정의됨"]})
        jira.append({"key": f"PMX-{i}", "type": "Story", "summary": item})
        qa.append(f"{item} 정상/예외 케이스 검증")
    spec_sections = [
        {"title": "1. 배경·문제", "body": problem},
        {"title": "2. 목표·성공지표", "body": ", ".join(metrics) or "(미결정) 지표 확정 필요"},
        {"title": "3. 범위", "body": f"포함: {', '.join(in_scope)} / 제외: {', '.join(out_scope) or '없음'}"},
        {"title": "4. 요구사항·수용기준(AC)", "body": f"요구 {len(acceptance)}건, 각 AC 포함"},
        {"title": "5. 미결정", "body": "(미결정) 성공지표 목표치 확정 필요"},
    ]
    risks = ["의존성: 인증/권한 모듈", "리스크: 일정·범위 변동"]
    # PM-R-001: AC 없는 요구사항 → block / PM-R-003: 미결정 유지
    findings = []
    no_ac = [a for a in acceptance if not a["criteria"]]
    if no_ac:
        findings.append({"rule": "PM-R-001", "desc": f"AC 없는 요구사항 {len(no_ac)}건", "severity": "high", "action": "block"})
    undecided = True  # spec에 미결정 포함
    approval_required = undecided
    reasons = ["미결정 정책 포함 — PM/대표 승인 필요"]
    artifact = {"spec_sections": spec_sections, "acceptance_criteria": acceptance,
                "jira_items": jira, "qa_checklist": qa, "risks": risks}
    summary = f"요구사항 {len(acceptance)}건 스펙화 · 티켓 {len(jira)} · QA {len(qa)} · 미결정 1건"
    return {"summary": summary, "artifact": artifact,
            "approval_required": approval_required, "approval_reasons": reasons,
            "rule_findings": findings, "blocked": any(f["action"] == "block" for f in findings)}


def _run_securities(inputs: dict, template_key: Optional[str] = None) -> dict:
    company = inputs.get("company", "대상 기업")
    period = inputs.get("period", "최근 기간")
    summary = f"{company} 리서치 초안 생성 완료 ({period})"
    artifact = {
        "research_type": template_key or "rs_company",
        "highlights": [
            "핵심 포인트 3건 요약",
            "리스크/기회 요인 정리",
            "추가 확인 필요 데이터 명시",
        ],
        "next_actions": ["근거 데이터 검토", "대표 승인", "채널 공유"],
    }
    return {
        "summary": summary,
        "artifact": artifact,
        "approval_required": True,
        "approval_reasons": ["리서치 배포 전 승인 필요"],
        "rule_findings": [],
        "blocked": False,
    }


def _run_compliance(inputs: dict, template_key: Optional[str] = None) -> dict:
    case_id = inputs.get("case_id") or inputs.get("target") or "CASE-UNKNOWN"
    findings = []
    evidence = str(inputs.get("evidence") or "").strip().lower()
    if template_key == "aml_str" and evidence in ("", "없음", "none", "-", "n/a", "모름"):
        findings.append({"rule": "AML-R-001", "desc": "STR은 증빙 없이 제출 불가", "severity": "high", "action": "block"})
    blocked = any(f.get("action") == "block" for f in findings)
    summary = f"준법 점검 초안 생성 ({template_key or 'aml_monitor'} · {case_id})"
    artifact = {
        "check_type": template_key or "aml_monitor",
        "case_id": case_id,
        "risk_level": "high" if findings else "medium",
        "recommendations": ["추가 근거 수집", "승인 후 보고"],
    }
    return {
        "summary": summary,
        "artifact": artifact,
        "approval_required": True,
        "approval_reasons": ["규제/감사 문서는 승인 후 외부 보고"],
        "rule_findings": findings,
        "blocked": blocked,
    }


def _run_devops(inputs: dict, template_key: Optional[str] = None) -> dict:
    service = inputs.get("service") or inputs.get("module") or inputs.get("epic") or "서비스"
    summary = f"개발·운영 작업 초안 생성 ({template_key or 'dev_incident'} · {service})"
    artifact = {
        "work_type": template_key or "dev_incident",
        "service": service,
        "action_items": ["담당자 확인", "우선순위 조정", "승인 후 티켓 반영"],
    }
    return {
        "summary": summary,
        "artifact": artifact,
        "approval_required": True,
        "approval_reasons": ["운영 변경 반영 전 승인 필요"],
        "rule_findings": [],
        "blocked": False,
    }


JOB_RUNNERS = {
    "vat_reconcile": {"build_plan": build_plan, "run": _run_vat},
    "hr":            {"build_plan": build_plan, "run": _run_hr},
    "pm_brief":      {"build_plan": build_plan, "run": _run_pm},
    "securities_research": {"build_plan": build_plan, "run": _run_securities},
    "compliance_aml":      {"build_plan": build_plan, "run": _run_compliance},
    "dev_incident":        {"build_plan": build_plan, "run": _run_devops},
}


def run(job: str, inputs: dict, template_key: Optional[str] = None) -> dict:
    """직무 러너 실행. 등록 안 된 직무는 KeyError."""
    fn = JOB_RUNNERS[job]["run"]
    if job in ("securities_research", "compliance_aml", "dev_incident"):
        return fn(inputs or {}, template_key=template_key)
    return fn(inputs or {})


# ── ⑦ External Action ─────────────────────────────────────────────
# 승인된 산출물을 외부 시스템에 반영. 커넥터 배선은 action_connectors(스텁+Slack 실연동).
_ACTION_PRIMARY = {           # external_action.type의 파이프 옵션 중 1차 대상
    "vat_reconcile": "update_erp",
    "hr": "update_sheet",
    "pm_brief": "create_ticket",
    "securities_research": "update_sheet",
    "compliance_aml": "post_channel",
    "dev_incident": "create_ticket",
}


def external_action_spec(job: str) -> dict:
    return (_SCHEMA.get(job) or {}).get("external_action", {})


def _build_action_payload(job: str, record: dict) -> dict:
    """스키마 payload_fields에 맞춰 artifact에서 외부 반영 페이로드 추출."""
    art = record.get("artifact") or {}
    inputs = record.get("inputs") or {}
    if job == "vat_reconcile":
        cp = art.get("commit_payload") or {}
        return {
            "entries": cp.get("entries", art.get("matched_count", 0)),
            "adjustments": cp.get("adjustments", len(art.get("anomalies", []))),
            "approval_id": record.get("stage_id"),
            "channel": inputs.get("post_channel", ""),
        }
    if job == "hr":
        rows = [{"name": c.get("name"), "score": c.get("score"), "decision": c.get("decision")}
                for c in art.get("shortlist", [])]
        return {
            "shortlist_rows": rows,
            "review_request_message": f"숏리스트 {len(rows)}명 검토 요청 — 각 후보 근거 첨부",
            "channel": inputs.get("review_channel", inputs.get("post_channel", "")),
        }
    if job == "pm_brief":
        summaries = [{"key": t.get("key"), "summary": t.get("summary"), "type": t.get("type")}
                     for t in art.get("jira_items", [])]
        return {
            "ticket_summaries": summaries,
            "release_note_draft": record.get("summary", ""),
            "channel": inputs.get("post_channel", ""),
        }
    if job == "securities_research":
        return {
            "shortlist_rows": [{"name": (record.get("template_key") or "rs_company"),
                                "score": "", "decision": record.get("summary", "")}],
            "review_request_message": record.get("summary", "리서치 결과 공유"),
            "channel": inputs.get("post_channel", ""),
        }
    if job == "compliance_aml":
        return {
            "message": record.get("summary", ""),
            "channel": inputs.get("post_channel", ""),
        }
    if job == "dev_incident":
        return {
            "ticket_summaries": [{"summary": record.get("summary", ""), "type": "Task"}],
            "channel": inputs.get("post_channel", ""),
        }
    return {}


def resolve_action_target(job: str, record: dict) -> str:
    """1차 대상. inputs.action_target이 스키마 허용 옵션이면 그것으로 대체."""
    target = _ACTION_PRIMARY.get(job)
    allowed = (external_action_spec(job).get("type") or "").split("|")
    req = (record.get("inputs") or {}).get("action_target")
    if req in allowed:
        target = req
    return target


def execute_external_action(job: str, record: dict, dry_run: bool = False, actor: str = "user") -> dict:
    """직무 산출물을 외부 시스템에 반영. dry_run·simulate 지원, 표준 result 반환."""
    import hashlib
    from . import action_connectors as ac
    target = resolve_action_target(job, record)
    fn = ac.CONNECTORS.get(target)
    payload = _build_action_payload(job, record)
    # 요청 해시(감사 추적용) — 페이로드 변조/재현 확인
    req_hash = hashlib.sha256(
        json.dumps({"job": job, "target": target, "payload": payload},
                   sort_keys=True, ensure_ascii=False, default=str).encode()
    ).hexdigest()[:16]
    if not fn:
        return {"ok": False, "target": target, "dry_run": dry_run, "mode": "stub",
                "error": "unsupported_action", "message": f"미지원 외부 액션: {target}",
                "request_hash": req_hash}
    # 운영 실 커넥터 플래그가 켜졌을 때, 실 배선된 대상만 통과(그 외는 차단 — 샌드박스 선연결 원칙)
    if not dry_run and ac.live_enabled():
        from . import sheets_client as sc
        from . import jira_client as jc
        ready = (target == "post_channel"
                 or (target == "update_sheet" and sc.configured())
                 or (target == "create_ticket" and jc.configured()))
        if not ready:
            return {"ok": False, "target": target, "dry_run": False, "mode": "live-real",
                    "error": ac.ERR_NOT_CONFIGURED, "request_hash": req_hash,
                    "message": "실 커넥터 미배선 — 샌드박스 연결 후 사용(BYR_CONNECTORS_LIVE)",
                    "payload_fields": external_action_spec(job).get("payload_fields", [])}
    simulate = (record.get("inputs") or {}).get("simulate_action", "ok")
    result = fn(payload, dry_run, record.get("stage_id", ""), simulate)
    result.setdefault("target", target)
    result.setdefault("dry_run", dry_run)
    result.setdefault("mode", "stub")
    result["request_hash"] = req_hash
    result["payload_fields"] = external_action_spec(job).get("payload_fields", [])
    return result
