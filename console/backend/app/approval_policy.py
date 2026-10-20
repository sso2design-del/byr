"""승인 정책 — 누가 승인할 수 있는지를 한 곳에서 판단한다.

기준(2026-10-13 기획팀 합의):
- 승인자는 메신저 사용자 ID로 기록한다. ID를 모르면 승인하지 않는다.
- 에이전트에 승인자 목록(approvers)이 있으면 그 사람만 승인한다.
- 목록이 없거나 요청자 혼자뿐이면 1인 사용으로 보고 요청자 본인만 승인한다.
  이때는 '자기 승인'으로 따로 표시한다.
- 다른 승인자가 있는데 요청자가 스스로 승인하려면 allow_self_approval=True 여야 한다.
- 규제 직무(보험 FP 고객 문서·증권 리포트·준법 STR)는 자기 승인을 막는다.
- 승인 키워드는 '승인/발송/approve/send'만 쓴다. '확인'·'확정'은 평소 대화에
  흔해서 뜻하지 않은 발송으로 이어질 수 있어 뺐다.
"""

APPROVE_WORDS = ("승인", "발송", "approve", "send")
REGULATED_JOBS = ("insurance_fp", "securities_research", "compliance_aml")


def is_approve_word(text: str) -> bool:
    t = (text or "").strip()
    return t in APPROVE_WORDS or t.lower() in APPROVE_WORDS


def approvers_of(agent: dict) -> list:
    return [a for a in ((agent or {}).get("approvers") or []) if a]


def check(agent: dict, requester: str, actor: str) -> dict:
    """승인 가능 여부. 반환 {ok, self_approved} | {ok: False, reason, message}."""
    agent = agent or {}
    if not actor:
        return {"ok": False, "reason": "no_actor",
                "message": "승인한 사람을 확인할 수 없어 처리하지 않았습니다."}
    approvers = approvers_of(agent)
    self_approval = bool(requester) and actor == requester
    others = [a for a in approvers if a != requester]

    if approvers and actor not in approvers:
        return {"ok": False, "reason": "not_approver",
                "message": "이 에이전트의 지정 승인자만 승인할 수 있습니다."}
    if not approvers and not self_approval:
        return {"ok": False, "reason": "not_approver",
                "message": "승인자가 지정되지 않은 에이전트는 요청한 사람만 승인할 수 있습니다."}
    if self_approval and agent.get("job") in REGULATED_JOBS:
        return {"ok": False, "reason": "self_approval_blocked",
                "message": "이 업무는 요청한 사람이 직접 승인할 수 없습니다. "
                           "콘솔에서 승인자를 지정한 뒤 그 사람이 `승인`해주세요."}
    if self_approval and others and not agent.get("allow_self_approval"):
        return {"ok": False, "reason": "self_approval_blocked",
                "message": "요청한 사람은 직접 승인할 수 없습니다. 지정 승인자가 `승인`해주세요."}
    return {"ok": True, "self_approved": self_approval}
