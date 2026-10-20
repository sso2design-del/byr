"""
승인 정책 회귀 테스트 (2026-10-13 기획팀 합의 기준).

  1) 정책 판단: 지정 승인자 / 1인 사용 자기 승인 / 규제 직무 / ID 없음
  2) 제안서(채널): 아무나 '승인'해도 발송 안 됨 · '확인'은 승인 아님 · 승인 1회 = 발송 1회
  3) 외부 반영: 이미 반영된 건은 live 재실행 차단
실행: ./.venv/bin/python -m tests.test_approval_policy   (backend 디렉토리에서)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import slack_bot as sb  # noqa: E402
from app import approval_policy as P  # noqa: E402
from app import execution as ex  # noqa: E402

FAILS = []

# 감사 로그는 저장소에 들어 있는 파일이라, 테스트가 남긴 줄은 끝에서 되돌린다
from app import audit as _au  # noqa: E402
_AUDIT = getattr(_au, "AUDIT_FILE", None)
_AUDIT_BEFORE = open(_AUDIT, encoding="utf-8").read() if _AUDIT and os.path.exists(_AUDIT) else None


def ck(name, cond, detail=""):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name} {detail}")
    if not cond:
        FAILS.append(name)


print("=== 1) 정책 판단 ===")
solo = {"job": "sales"}
ck("1인 사용 — 요청자 본인 승인 허용(자기 승인 표시)",
   P.check(solo, "U1", "U1") == {"ok": True, "self_approved": True})
ck("1인 사용 — 다른 사람 승인 거부", P.check(solo, "U1", "U2")["reason"] == "not_approver")
ck("승인자 ID 없음 거부", P.check(solo, "U1", "")["reason"] == "no_actor")
team = {"job": "sales", "approvers": ["U9"]}
ck("지정 승인자 승인 허용", P.check(team, "U1", "U9") == {"ok": True, "self_approved": False})
ck("지정 승인자 아님 거부", P.check(team, "U1", "U2")["reason"] == "not_approver")
both = {"job": "sales", "approvers": ["U1", "U9"]}
ck("다른 승인자가 있으면 자기 승인 거부", P.check(both, "U1", "U1")["reason"] == "self_approval_blocked")
ck("allow_self_approval 켜면 자기 승인 허용",
   P.check({**both, "allow_self_approval": True}, "U1", "U1")["ok"])
ck("승인자가 요청자 혼자면 1인 사용으로 봄", P.check({"job": "sales", "approvers": ["U1"]}, "U1", "U1")["ok"])
for job in P.REGULATED_JOBS:
    ck(f"규제 직무 {job} 자기 승인 거부", P.check({"job": job}, "U1", "U1")["reason"] == "self_approval_blocked")
ck("규제 직무도 지정 승인자는 허용", P.check({"job": "insurance_fp", "approvers": ["U9"]}, "U1", "U9")["ok"])
ck("'확인'은 승인 단어 아님", not P.is_approve_word("확인"))
ck("'확정'은 승인 단어 아님", not P.is_approve_word("확정"))
ck("'승인'·'approve'는 승인 단어", P.is_approve_word("승인") and P.is_approve_word("Approve"))

print("=== 2) 제안서 채널 승인 ===")
SENT = []
sb.proposal_task.send = lambda sid: (SENT.append(sid), {"ok": True})[1]
sb._bg = lambda target, *a: target(*a)          # 백그라운드 대신 즉시 실행
AGENT = {"id": "test-approval-agent", "job": "sales"}
sb.agents_store.get_agent = lambda aid: AGENT if aid == AGENT["id"] else None


def stage(ch, requester="U1"):
    return ex.stage_proposal(AGENT["id"], "테스트고객", "요청", {"draft": "d"},
                             recipient="a@b.c", channel_id=ch, requester=requester)


def say_box():
    box = []
    return (lambda text="", **kw: box.append(text)), box


rec = stage("C-ap-1")
say, msgs = say_box()
ck("'확인'으로는 처리 안 함", sb._handle_approval(say, {"channel": "C-ap-1", "user": "U1", "text": "확인"}) is False)
handled = sb._handle_approval(say, {"channel": "C-ap-1", "user": "U2", "text": "승인"})
ck("다른 사람 '승인' → 발송 안 함", handled and rec["stage_id"] not in SENT, f"→ {msgs[-1][:40] if msgs else ''}")
ck("거부 안내 메시지", bool(msgs) and ":lock:" in msgs[-1])
sb._handle_approval(say, {"channel": "C-ap-1", "user": "U1", "text": "승인"})
ck("요청자 본인 '승인' → 1회 발송", SENT.count(rec["stage_id"]) == 1)
r = ex.get_staging(rec["stage_id"])
ck("승인자·자기 승인 기록", r.get("approved_by") == "U1" and r.get("self_approved") is True,
   f"→ {r.get('approved_by')}/{r.get('self_approved')}")
sb._handle_approval(say, {"channel": "C-ap-1", "user": "U1", "text": "승인"})
ck("같은 제안서 두 번째 '승인' → 다시 안 보냄", SENT.count(rec["stage_id"]) == 1)
rec2 = stage("C-ap-2")
ck("선점은 한 번만 성공", bool(ex.claim_proposal(rec2["stage_id"], "U1")) and not ex.claim_proposal(rec2["stage_id"], "U1"))

AGENT["job"] = "insurance_fp"
rec3 = stage("C-ap-3")
say, msgs = say_box()
sb._handle_approval(say, {"channel": "C-ap-3", "user": "U1", "text": "승인"})
ck("보험 FP 고객 제안서 — 자기 승인으로 발송 안 함", rec3["stage_id"] not in SENT, f"→ {msgs[-1][:40] if msgs else ''}")
AGENT["job"] = "sales"

print("=== 3) 외부 반영 1회 ===")
staging = ex._load_staging()
fake = {"stage_id": "stg-test-reflected", "kind": "job_task", "job": "vat_reconcile",
        "status": "reflected", "agent_id": "x"}
staging.insert(0, fake)
ex._save_staging(staging)
r = ex.execute_external_action("stg-test-reflected", dry_run=False)
ck("반영된 건 live 재실행 차단", r.get("error") == "already_reflected", f"→ {r.get('error')}")
r = ex.execute_external_action("stg-test-reflected", dry_run=True)
ck("반영된 건도 미리보기는 허용", r.get("error") != "already_reflected", f"→ {r.get('error') or 'ok'}")
ex._save_staging([s for s in ex._load_staging() if s["stage_id"] != "stg-test-reflected"])

print("=== 4) 대화 엔진: 지정 승인자 경로 ===")
from app import conversation as C  # noqa: E402
CA = {"id": "test-approval-convo", "job": "pm_brief", "approvers": ["U9"]}
staging = ex._load_staging()
staging.insert(0, {"stage_id": "stg-test-convo", "kind": "task", "status": "staged", "agent_id": CA["id"]})
ex._save_staging(staging)
k1 = C.skey("slack", "C-ap-4", "U1", CA["id"])
s1 = C._new_session("slack", "C-ap-4", "U1", CA["id"])
s1.update({"stage_id": "stg-test-convo", "last_status": "staged"})
C.save_session(k1, s1)
out = C.handle("slack", "C-ap-4", "U1", CA, "승인")
ck("요청자 본인(승인자 따로 있음) → 거부", ":lock:" in out[0] and ex.get_staging("stg-test-convo")["status"] == "staged",
   f"→ {out[0][:40]}")
out = C.handle("slack", "C-ap-4", "U2", CA, "승인")
ck("승인자 아닌 제3자 → 처리 안 됨", ex.get_staging("stg-test-convo")["status"] == "staged", f"→ {out[0][:40]}")
out = C.handle("slack", "C-ap-4", "U9", CA, "승인")
r = ex.get_staging("stg-test-convo")
ck("지정 승인자 → 요청자 건 승인·기록", r.get("status") == "committed" and r.get("approved_by") == "U9"
   and r.get("self_approved") is False, f"→ {r.get('status')}/{r.get('approved_by')}")
C.clear_session(k1)
C.clear_session(C.skey("slack", "C-ap-4", "U2", CA["id"]))
C.clear_session(C.skey("slack", "C-ap-4", "U9", CA["id"]))

# 테스트가 만든 스테이징 기록 정리
ex._save_staging([s for s in ex._load_staging()
                  if s.get("agent_id") not in (AGENT["id"], CA["id"]) and s["stage_id"] != "stg-test-reflected"])

if _AUDIT_BEFORE is not None:
    with open(_AUDIT, "w", encoding="utf-8") as f:
        f.write(_AUDIT_BEFORE)

print()
print("ALL PASS ✅" if not FAILS else f"FAILED ❌ {FAILS}")
sys.exit(1 if FAILS else 0)
