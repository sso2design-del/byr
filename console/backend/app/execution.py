from pydantic import BaseModel
from typing import Optional
import json, os, uuid
from datetime import datetime, timedelta

STAGING_FILE = os.path.join(os.path.dirname(__file__), "../data/staging.json")

# 롤백 허용 시간(분) — "커밋 후 N분 내 승인자만 롤백". 직무별 override, 그 외 기본값.
ROLLBACK_WINDOW_MIN = {"vat_reconcile": 60, "hr": 120, "pm_brief": 120}
_DEFAULT_ROLLBACK_MIN = 30

class ExecutionPlan(BaseModel):
    agent_id: str
    task: str
    steps: list[str]
    source_files: list[str]
    golden_sample: Optional[str] = None

class StageResult(BaseModel):
    stage_id: str
    agent_id: str
    task: str
    summary: str
    details: list[dict]  # [{cell, value, source}]
    golden_check: Optional[dict] = None
    status: str = "staged"  # staged | committed | undone

DEMO_PLAN = ExecutionPlan(
    agent_id="ag-001",
    task="부가세 매입/매출 대사",
    steps=[
        "매출 원장 파일 읽기 (매출_2026Q2.xlsx)",
        "매입 원장 파일 읽기 (매입_2026Q2.xlsx)",
        "세액 합계·대사 계산 (결정론적 코드 수행)",
        "골든샘플(2026Q1 확정치)과 비교 검증",
        "초안 스테이징 — 새 버전으로 저장 (덮어쓰기 없음)",
    ],
    source_files=["매출_2026Q2.xlsx", "매입_2026Q2.xlsx"],
    golden_sample="2026Q1 확정치"
)

DEMO_RESULT = {
    "summary": "매출 47건·매입 51건 대사 완료. 이상 2건 발견.",
    "golden_check": {"matched": 47, "anomalies": 2, "label": "2026Q1 재현: 일치 47 / 이상 2건"},
    "details": [
        {"cell": "매출_2026Q2.xlsx · Sheet1 · F2:F49", "label": "매출 세액 합계", "value": "₩12,450,000"},
        {"cell": "매입_2026Q2.xlsx · Sheet1 · G3:G54", "label": "매입 세액 합계", "value": "₩9,870,000"},
        {"cell": "매출_2026Q2.xlsx · Sheet1 · B23", "label": "⚠️ 세금계산서 중복 의심", "value": "공급가액 불일치"},
        {"cell": "매입_2026Q2.xlsx · Sheet1 · D41", "label": "⚠️ 빈칸 감지", "value": "세액 미기재"},
    ]
}

def _load_staging() -> list[dict]:
    os.makedirs(os.path.dirname(STAGING_FILE), exist_ok=True)
    if not os.path.exists(STAGING_FILE):
        return []
    with open(STAGING_FILE, encoding="utf-8") as f:
        return json.load(f)

def _save_staging(data: list[dict]):
    with open(STAGING_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_plan(agent_id: str, agent: dict = None) -> dict:
    a = agent or {}
    from . import job_runners as jr
    job = a.get("job")
    if job in jr.JOB_RUNNERS:                       # 직무별 실행 계획(스키마 기반)
        return jr.build_plan(job, {**a, "id": agent_id})
    # 미등록 직무 — 일반 계획(하위호환)
    return {
        "agent_id": agent_id,
        "task": f"{a.get('role', '업무')} 실행",
        "steps": ["업무 범위 파악 중", "초안 생성 중", "검증 중", "스테이징"],
        "source_files": a.get("file_paths", []),
    }

def run_and_stage(agent_id: str, agent: dict = None, inputs: dict = None) -> dict:
    """직무별 분기 실행. 등록 직무는 job_runners로, 그 외는 일반 스테이징(고정 DEMO 의존 제거)."""
    a = agent or {}
    job = a.get("job")
    stage_id = f"stg-{uuid.uuid4().hex[:8]}"
    from . import job_runners as jr
    raw_inputs = inputs or {}
    template_key = raw_inputs.get("_template_key") if isinstance(raw_inputs, dict) else None
    clean_inputs = {k: v for k, v in raw_inputs.items() if k != "_template_key"} if isinstance(raw_inputs, dict) else {}
    if job in jr.JOB_RUNNERS:
        r = jr.run(job, clean_inputs, template_key=template_key)
        record = {
            "stage_id": stage_id, "agent_id": agent_id, "job": job, "kind": "job_task",
            "task": jr.schema_for(job).get("name", "실행"),
            "template_key": template_key,
            "inputs": clean_inputs,
            "summary": r["summary"], "artifact": r["artifact"],
            "approval_required": r["approval_required"], "approval_reasons": r["approval_reasons"],
            "rule_findings": r.get("rule_findings", []), "blocked": r.get("blocked", False),
            "created_at": datetime.now().isoformat(),
            "status": "blocked" if r.get("blocked") else "staged",
        }
    else:
        # 미등록 직무 — 일반 스테이징(고정 DEMO 대신 최소 결과)
        record = {
            "stage_id": stage_id, "agent_id": agent_id, "job": job, "kind": "job_task",
            "task": f"{a.get('role', '업무')} 실행", "inputs": clean_inputs,
            "summary": "이 직무의 실행 로직은 아직 준비 중입니다.", "artifact": {},
            "approval_required": True, "approval_reasons": ["미구현 직무 — 사용자 검토 필요"],
            "rule_findings": [], "blocked": False,
            "created_at": datetime.now().isoformat(), "status": "staged",
        }
    staging = _load_staging()
    staging.insert(0, record)
    _save_staging(staging)
    return record

def stage_proposal(agent_id: str, customer: str, request: str, result: dict,
                   recipient: str = "", pdf_path: str = "",
                   channel_id: str = "", thread_ts: str = "", requester: str = "") -> dict:
    """제안서 작성 태스크를 실제 스테이징 레코드로 저장(고정 DEMO 아님).
    result = proposal.draft() 반환값. 승인 게이트 대기(status=staged) → 승인 시 발송."""
    stage_id = f"stg-{uuid.uuid4().hex[:8]}"
    record = {
        "stage_id": stage_id,
        "agent_id": agent_id,
        "kind": "proposal",
        "task": f"{customer or '고객사'} 제안서",
        "customer": customer,
        "request": request,
        "recipient": recipient,
        "pdf_path": pdf_path,
        "draft": result.get("draft", ""),
        "citations": result.get("citations", []),
        "used_llm": result.get("used_llm", False),
        "model": result.get("model"),
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "requester": requester,   # 요청한 메신저 사용자 ID — 승인 정책(자기 승인) 판단 기준
        "created_at": datetime.now().isoformat(),
        "status": "staged",   # staged → sending → sent | approved(발송 대기) | undone
        "sent": False,
    }
    staging = _load_staging()
    staging.insert(0, record)
    _save_staging(staging)
    return record


def set_pdf(stage_id: str, pdf_path: str) -> None:
    staging = _load_staging()
    for s in staging:
        if s["stage_id"] == stage_id:
            s["pdf_path"] = pdf_path
            _save_staging(staging)
            return


def get_staging(stage_id: str) -> dict:
    for s in _load_staging():
        if s["stage_id"] == stage_id:
            return s
    return {}


def find_proposal_by_thread(thread_ts: str) -> dict:
    """Slack 스레드로 대기 중(staged) 제안서 찾기(텍스트 승인용)."""
    if not thread_ts:
        return {}
    for s in _load_staging():
        if s.get("kind") == "proposal" and s.get("thread_ts") == thread_ts and s.get("status") == "staged":
            return s
    return {}


def find_last_proposal(channel_id: str) -> dict:
    """이 채널에서 가장 최근 만든 제안서(상태 무관) — 대화 맥락(기억)용."""
    if not channel_id:
        return {}
    for s in _load_staging():   # insert(0,…) 라 최신이 앞
        if s.get("kind") == "proposal" and s.get("channel_id") == channel_id:
            return s
    return {}


def find_pending_proposal(channel_id: str) -> dict:
    """이 채널의 가장 최근 승인 대기(staged) 제안서(채널에서 '승인' 시)."""
    if not channel_id:
        return {}
    for s in _load_staging():   # insert(0,…) 라 최신이 앞
        if s.get("kind") == "proposal" and s.get("channel_id") == channel_id and s.get("status") == "staged":
            return s
    return {}


def claim_proposal(stage_id: str, actor: str, self_approved: bool = False) -> dict:
    """대기(staged) 제안서를 승인자로 선점한다. 이미 처리 중이거나 끝난 건이면 {}.

    발송은 백그라운드에서 돌기 때문에, '승인'이 두 번 연달아 와도
    여기서 상태를 먼저 바꿔 두 번째 요청이 같은 제안서를 다시 보내지 못하게 한다.
    """
    staging = _load_staging()
    for s in staging:
        if s["stage_id"] == stage_id:
            if s.get("status") != "staged":
                return {}
            s["status"] = "sending"
            s["approved_by"] = actor
            s["self_approved"] = self_approved
            s["approved_at"] = datetime.now().isoformat()
            _save_staging(staging)
            return s
    return {}


def mark_sent(stage_id: str, send_result: dict) -> dict:
    """승인 결과 기록. 발송 성공이면 sent, 실패(자격증명 없음 등)면 approved(발송 대기)."""
    ok = bool(send_result.get("ok"))
    staging = _load_staging()
    for s in staging:
        if s["stage_id"] == stage_id:
            s["status"] = "sent" if ok else "approved"
            s["sent"] = ok
            s["send_message"] = send_result.get("message", "")
            s.setdefault("approved_at", datetime.now().isoformat())
            if ok:
                s["sent_at"] = datetime.now().isoformat()
            _save_staging(staging)
            return s
    return {}


def execute_external_action(stage_id: str, dry_run: bool = False, actor: str = "user") -> dict:
    """⑦ 외부 액션 실행 — 승인(committed) 게이트 통과 시에만. 결과·감사로그를 레코드에 부착.

    반환: 표준 result(job_runners.execute_external_action). 승인 전/blocked/대상아님은 error로.
    """
    from . import job_runners as jr
    staging = _load_staging()
    rec = next((s for s in staging if s["stage_id"] == stage_id), None)
    if rec is None:
        return {"ok": False, "error": "not_found", "message": "스테이징 결과를 찾을 수 없습니다."}
    if rec.get("kind") != "job_task" or rec.get("job") not in jr.JOB_RUNNERS:
        return {"ok": False, "error": "no_external_action", "message": "외부 액션 대상이 아닙니다."}
    if rec.get("blocked"):
        return {"ok": False, "error": "blocked", "message": "규칙 위반(blocked) — 외부 실행 불가"}
    if rec.get("status") not in ("committed", "reflected"):   # 승인 게이트
        return {"ok": False, "error": "not_approved",
                "message": "승인 전에는 외부 실행이 차단됩니다. 먼저 확정(승인)하세요."}
    if not dry_run and rec.get("status") == "reflected":      # 승인 1회 = 반영 1회
        return {"ok": False, "error": "already_reflected",
                "message": "이미 반영된 작업입니다. 다시 반영하려면 새로 승인받아야 합니다."}
    result = jr.execute_external_action(rec["job"], rec, dry_run=dry_run, actor=actor)
    entry = {                                                 # 감사 필드(스키마 audit_fields)
        "actor": actor,
        "timestamp": datetime.now().isoformat(),
        "source_refs": jr.schema_for(rec["job"]).get("evidence_sources", {}).get("required_files", []),
        "decision": "approved",
        "dry_run": dry_run,
        "external_id": result.get("id") or result.get("external_ids"),
        "request_hash": result.get("request_hash"),
        "mode": result.get("mode"),
        "result": {"ok": result.get("ok"), "target": result.get("target"),
                   "id": result.get("id"), "error": result.get("error")},
    }
    rec.setdefault("external_action_log", []).append(entry)
    rec["external_action_result"] = result
    if not dry_run and result.get("ok"):                      # 실반영 성공 → reflected
        rec["status"] = "reflected"
        rec["reflected_at"] = datetime.now().isoformat()
    _save_staging(staging)
    return result


def commit(stage_id: str, dry_run: bool = True, actor: str = "user",
           self_approved: bool = False) -> dict:
    # 기본 dry_run=True(사고 예방): 승인+미리보기만. 실반영은 명시적 dry_run=False(최종확정).
    staging = _load_staging()
    for s in staging:
        if s["stage_id"] == stage_id:
            if s.get("blocked"):                              # 규칙 위반은 확정 불가
                return {"error": "blocked", "stage_id": stage_id,
                        "message": "규칙 위반(blocked) — 확정 불가"}
            now = datetime.now()
            s["status"] = "committed"                         # 승인 게이트 통과
            s["committed_at"] = now.isoformat()
            s["approved_by"] = actor                          # 롤백 권한 판정 기준
            s["self_approved"] = self_approved                # 요청자 본인 승인 여부(기록부 표시용)
            win = ROLLBACK_WINDOW_MIN.get(s.get("job"), _DEFAULT_ROLLBACK_MIN)
            s["rollback_window_min"] = win
            s["rollback_deadline"] = (now + timedelta(minutes=win)).isoformat()
            _save_staging(staging)
            from . import job_runners as jr
            if s.get("kind") == "job_task" and s.get("job") in jr.JOB_RUNNERS:
                execute_external_action(stage_id, dry_run=dry_run, actor=actor)  # 승인 후 외부 반영
                return get_staging(stage_id)                  # external_action_result 포함 최신본
            return s
    return {}

def undo(stage_id: str, actor: str = "user") -> dict:
    """되돌리기. 확정(committed/reflected)건은 롤백 윈도우·승인자 권한을 검사."""
    staging = _load_staging()
    for s in staging:
        if s["stage_id"] != stage_id:
            continue
        # 확정 후에만 시간/권한 통제(스테이징 단계 취소는 자유)
        if s.get("rollback_deadline") and s.get("status") in ("committed", "reflected"):
            try:
                expired = datetime.now() > datetime.fromisoformat(s["rollback_deadline"])
            except ValueError:
                expired = False
            if expired:
                return {"error": "rollback_expired", "stage_id": stage_id,
                        "message": f"롤백 기간({s.get('rollback_window_min')}분) 만료 — 되돌릴 수 없습니다.",
                        "rollback_deadline": s["rollback_deadline"]}
            approver = s.get("approved_by")
            if approver and actor != approver:
                return {"error": "not_approver", "stage_id": stage_id,
                        "message": f"승인자({approver})만 롤백할 수 있습니다."}
        s["status"] = "undone"
        s["undone_at"] = datetime.now().isoformat()
        s["undone_by"] = actor
        _save_staging(staging)
        return s
    return {}

def list_staging(agent_id: str) -> list[dict]:
    return [s for s in _load_staging() if s["agent_id"] == agent_id]


# 개인정보를 남기지 않으면서 "무엇이 나갔나"를 알 수 있게 요약한다.
# 값 자체가 아니라 필드명·건수·길이만 남긴다 — 감사에 필요한 건 내용이 아니라 범위다.
_DIGEST_SKIP = {"password", "token", "key", "secret", "authorization"}

def payload_digest(payload) -> str:
    if payload is None:
        return "-"
    if isinstance(payload, dict):
        parts = []
        for k, v in list(payload.items())[:8]:
            if any(x in str(k).lower() for x in _DIGEST_SKIP):
                parts.append(f"{k}=<가림>")
            elif isinstance(v, (list, tuple)):
                parts.append(f"{k}[{len(v)}]")
            elif isinstance(v, dict):
                parts.append(f"{k}{{{len(v)}}}")
            elif isinstance(v, str):
                parts.append(f"{k}({len(v)}자)")
            else:
                parts.append(f"{k}={v}")
        return " ".join(parts)
    if isinstance(payload, (list, tuple)):
        return f"[{len(payload)}건]"
    return f"({len(str(payload))}자)"
