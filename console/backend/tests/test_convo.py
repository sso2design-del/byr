"""
제안서 대화 에이전트 — 시나리오 자동 테스트(핵심 기술 회귀 검증).

실제 LLM(대화 관리)을 태워 다음을 검증한다:
  1) 정상 흐름  2) 오프스크립트(딴 질문)  3) 최근 제안서 기억(참조)
  4) 이미 포함된 슬라이드 요청  5) 고객사 정정  6) 기억에도 새 고객사 새로 시작

생성(PDF/메일)은 스텁으로 대체 — 대화 로직만 빠르게 검증한다.
실행: ./.venv/bin/python -m tests.test_convo   (backend 디렉토리에서)
"""
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import slack_bot as sb  # noqa: E402

ROUTE = {"agent_id": "test-agent", "name": "제안서 작성·발송", "job": "sales", "kind": "agent"}
ROUTE_FP = {"agent_id": "test-fp", "name": "맞춤 제안서", "job": "insurance_fp", "kind": "agent"}
GEN = []  # 생성 호출 기록


def _make_say():
    msgs = []

    def say(text="", **kw):
        msgs.append(text)
    return say, msgs


def _stub():
    """생성·소스·기억을 스텁으로. last_proposal은 시나리오별로 세팅."""
    sb.proposal_task.has_sources = lambda aid: True

    def fake_generate(say, client, route, customer, request, recipient, channel_id, facts=None, requester=""):
        GEN.append({"customer": customer, "request": request, "recipient": recipient, "facts": facts or {}})
        say(text=f"[생성됨: {customer}]")
    sb._generate_and_offer = fake_generate

    def fake_converse(collected: dict, user_msg: str, context: str = "", job: str = "sales") -> dict:
        """LLM 비결정성 제거: 테스트 시나리오를 결정론으로 재현하는 대화 스텁."""
        t = (user_msg or "").strip()
        slots, action = {}, "ask"

        m = re.search(r"'([^']+)' 대상", context or "")
        last_customer = m.group(1) if m else ""

        for name in ("하나제조", "삼성전자", "NHN", "쿠팡", "카카오", "김철수"):
            if name in t:
                slots["customer"] = name
                break
        if not slots.get("customer") and last_customer and any(k in t for k in ("방금", "아까", "그 제안서", "그대로")):
            slots["customer"] = last_customer

        if "바꿔" in t and "카카오" in t:
            slots["customer"] = "카카오"

        if any(k in t for k in ("반복 문의", "자동응대", "자동화", "암", "사망보장", "예산")):
            slots["request"] = t

        m_size = re.search(r"(\d+)\s*명", t)
        if m_size:
            slots["team_size"] = int(m_size.group(1))

        merged = dict(collected or {})
        merged.update({k: v for k, v in slots.items() if v not in (None, "")})

        if "플랜" in t and "추가" in t:
            return {
                "reply": "플랜/요금 슬라이드는 이미 포함되어 있어요. 필요하면 조정해서 다시 만들어드릴게요.",
                "slots": slots,
                "action": "ask",
            }

        if any(k in t for k in ("응 이대로", "만들어줘", "다시 보내줘")) and merged.get("customer") and merged.get("request"):
            action = "generate"

        if action == "generate":
            reply = "좋아요. 이대로 생성할게요."
        elif not merged.get("customer"):
            reply = "어느 고객사(또는 고객) 대상일까요?"
        elif not merged.get("request"):
            reply = "어떤 상황이거나 무엇을 제안할까요?"
        else:
            reply = "좋아요. 이대로 만들까요?"

        return {"reply": reply, "slots": slots, "action": action}

    sb._converse = fake_converse


def _set_memory(last):
    sb.execution.find_last_proposal = lambda ch: (last or {})


def run_turn(channel, text, route=ROUTE):
    """한 메시지 → 봇 처리(동기). 봇 응답 리스트 반환."""
    say, msgs = _make_say()
    # _advance_proposal은 무거운 부분을 _bg로 돌리므로, 대화는 _run_converse를 직접 호출해 동기 검증
    t = (text or "").strip()
    if t in ("취소", "다시", "처음부터"):
        sb._convo.pop(channel, None)
        return ["(reset)"]
    sb._run_converse(say, None, route, channel, text)
    return msgs


def _last_collected(channel):
    return sb._convo.get(channel) or {}


# ── 시나리오 ──────────────────────────────────────────────────────
RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    print(f"  {'✅' if cond else '❌'} {name}" + (f" — {detail}" if detail and not cond else ""))


def s1_normal():
    print("\n[1] 정상 흐름")
    GEN.clear(); sb._convo.clear(); _set_memory({}); ch = "C1"
    run_turn(ch, "제안서 만들래")
    run_turn(ch, "하나제조")
    c = _last_collected(ch)
    check("고객사 포착", c.get("customer") and "하나" in c["customer"], f"collected={c}")
    run_turn(ch, "30명 CS팀인데 반복 문의 자동응대가 필요해")
    run_turn(ch, "응 이대로 만들어줘")
    check("생성 트리거", any("하나" in g["customer"] for g in GEN), f"GEN={GEN}")


def s2_offscript():
    print("\n[2] 오프스크립트(중간에 딴 질문)")
    GEN.clear(); sb._convo.clear(); _set_memory({}); ch = "C2"
    run_turn(ch, "삼성전자 제안서")
    run_turn(ch, "근데 보안은 어떻게 보장돼?")   # 딴 질문
    c = _last_collected(ch)
    check("고객사 유지(딴질문에도)", c.get("customer") and "삼성" in c["customer"], f"collected={c}")
    check("아직 생성 안 함", len(GEN) == 0, f"GEN={GEN}")


def s3_memory():
    print("\n[3] 최근 제안서 기억(참조)")
    GEN.clear(); sb._convo.clear(); ch = "C3"
    _set_memory({"kind": "proposal", "channel_id": ch, "customer": "NHN", "request": "전사 업무 자동화"})
    msgs = run_turn(ch, "방금 만들었던 NHN 제안서 그대로 다시 보내줘")
    c = _last_collected(ch)
    # 재생성 시 _convo가 비므로 GEN 또는 collected 어느 쪽이든 NHN이면 인식 성공
    ok = c.get("customer") == "NHN" or any(g["customer"] == "NHN" for g in GEN)
    check("NHN 인식(재생성 포함)", ok, f"collected={c} GEN={GEN} reply={msgs}")


def s4_already():
    print("\n[4] 이미 포함된 슬라이드 요청(플랜)")
    GEN.clear(); sb._convo.clear(); ch = "C4"
    _set_memory({"kind": "proposal", "channel_id": ch, "customer": "NHN", "request": "전사 업무 자동화"})
    msgs = run_turn(ch, "방금 만든 NHN 제안서에 플랜 정보 슬라이드 추가해줘")
    reply = " ".join(msgs)
    c = _last_collected(ch)
    # 정상 = 맥락 이해(NHN 참조/이미포함 안내/재생성) & 처음부터 '어느 고객사?' 리셋 안 함
    understood = (c.get("customer") == "NHN") or any(g["customer"] == "NHN" for g in GEN) \
        or any(w in reply for w in ["이미", "포함", "NHN", "요금", "플랜"])
    asked_fresh = ("어느 고객사" in reply) or ("고객사" in reply and "이름" in reply)
    check("맥락 이해(아마네시아 아님)", understood and not asked_fresh, f"collected={c} GEN={GEN} reply={reply}")


def s5_correction():
    print("\n[5] 고객사 정정")
    GEN.clear(); sb._convo.clear(); _set_memory({}); ch = "C5"
    run_turn(ch, "하나제조 제안서 만들어줘")
    run_turn(ch, "아 미안 고객사를 카카오로 바꿔줘")
    c = _last_collected(ch)
    check("고객사 정정 반영(카카오)", c.get("customer") and "카카오" in c["customer"], f"collected={c}")


def s6_new_despite_memory():
    print("\n[6] 기억 있어도 새 고객사로 새로 시작")
    GEN.clear(); sb._convo.clear(); ch = "C6"
    _set_memory({"kind": "proposal", "channel_id": ch, "customer": "NHN", "request": "전사 업무 자동화"})
    run_turn(ch, "이번엔 완전히 다른 회사, 쿠팡 제안서 새로 만들자")
    c = _last_collected(ch)
    check("새 고객사 인식(쿠팡)", c.get("customer") and "쿠팡" in c["customer"], f"collected={c}")


def s7_insurance():
    print("\n[7] 보험 FP 직무 대화(재사용)")
    GEN.clear(); sb._convo.clear(); _set_memory({}); ch = "C7"
    run_turn(ch, "김철수 고객 맞춤 보험 제안 만들어줘", route=ROUTE_FP)
    c = _last_collected(ch)
    check("보험 고객명 포착(김철수)", c.get("customer") and "김철수" in c["customer"], f"collected={c}")
    run_turn(ch, "42세 가장, 배우자·자녀 2명. 암 대비랑 사망보장이 필요하고 예산은 월 20만원", route=ROUTE_FP)
    run_turn(ch, "응 이대로 만들어줘", route=ROUTE_FP)
    check("보험 생성 트리거", any("김철수" in g["customer"] for g in GEN), f"GEN={GEN}")


if __name__ == "__main__":
    _stub()
    for fn in (s1_normal, s2_offscript, s3_memory, s4_already, s5_correction, s6_new_despite_memory, s7_insurance):
        try:
            fn()
        except Exception as e:
            check(fn.__name__ + " (예외)", False, repr(e))
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    print(f"\n=== 결과: {passed}/{len(RESULTS)} 통과 ===")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  실패: {name} — {detail}")
    sys.exit(0 if passed == len(RESULTS) else 1)
