"""
제안서 작성·발송 태스크 오케스트레이션 — 콘솔(main.py)과 Slack 봇이 공유.

create(): 요청 → 근거 초안 → PDF 생성 → 스테이징(승인 대기)
send()  : 승인 → 이메일 발송(PDF 첨부) → 발송 기록

각 단계는 실제로 동작하되(초안=LLM, PDF=reportlab, 메일=Gmail SMTP),
메일 자격증명이 없으면 send()가 발송하지 않고 안내를 돌려준다(데모 비차단).
"""
import os
from datetime import datetime
from . import proposal as pr
from . import pdf_gen
from . import deck_gen
from . import execution as ex
from . import mailer


def _sales_contact() -> dict:
    """영업 담당 명함 정보(env로 설정, 마무리 슬라이드·메일 서명 공용)."""
    mailer._load_hermes_env()
    return {
        "name": os.environ.get("BYR_SALES_REP", "황소이"),
        "title": os.environ.get("BYR_SALES_TITLE", "영업 담당"),
        "team": os.environ.get("BYR_SALES_TEAM", "영업팀"),
        "company": os.environ.get("BYR_SALES_COMPANY", "Byr"),
        "email": os.environ.get("BYR_SALES_EMAIL", "sales@byr.com"),  # 표기용(발신 계정과 별개)
        "phone": os.environ.get("BYR_SALES_PHONE", "02-1234-5678"),
        "address": os.environ.get("BYR_SALES_ADDRESS", "서울시 강남구 테헤란로 123, 6층"),
    }


def _contact_slide(customer: str) -> dict:
    """마무리 슬라이드 — 회사 연락처(명함)."""
    c = _sales_contact()
    return {
        "type": "closing",
        "message": f"{customer or '고객사'}의 다음 단계를 함께 만들어요",
        "subhead": "무료 상담·데모부터 시작합니다. 편하게 연락 주세요.",
        "contact": {
            "rep": f"{c['name']} · {c['title']}",
            "email": c["email"], "phone": c["phone"],
            "company": f"{c['company']} {c['team']}", "address": c["address"],
        },
    }


def has_sources(agent_id: str) -> bool:
    return pr.has_sources(agent_id)


# 연결된 가격표(pricing.md) 기준 전체 플랜
PRICING = [
    {"plan": "스타터",       "monthly": "₩39,000",  "annual": "₩31,000",  "members": "개인~10명"},
    {"plan": "프로",         "monthly": "₩89,000",  "annual": "₩71,000",  "members": "~50명"},
    {"plan": "비즈니스",     "monthly": "₩150,000", "annual": "₩120,000", "members": "대규모"},
    {"plan": "엔터프라이즈", "monthly": "영업팀 문의", "annual": "—",        "members": "규제·설치형"},
]


def _rec_index(team_size) -> int:
    """인원 → 추천 플랜 인덱스. 없으면 프로(1) 기본 추천."""
    if not team_size:
        return 1
    if team_size <= 10:
        return 0
    if team_size <= 50:
        return 1
    if team_size <= 200:
        return 2
    return 3


def _apply_customer_facts(deck: dict, facts: dict) -> None:
    """예측 차트(고객 처리량)·요금 슬라이드(전체 플랜+추천)를 결정론적으로 채움."""
    slides = deck.get("slides") or []
    vol = facts.get("volume")
    team = facts.get("team_size")

    # 1) 핵심 지표(impact) 막대 — 현재 처리량(고객 제공) 기준
    if vol:
        after = max(1, round(vol * 0.3))
        cut = round((1 - after / vol) * 100)
        target = next((s for s in slides if s.get("type") == "impact"), None)
        if target:
            target.pop("donut", None)
            target["bars"] = {"unit": "건/일", "items": [
                {"label": "현재", "value": vol, "note": "고객 제공"},
                {"label": "도입 후(예상)", "value": after, "highlight": True, "note": f"약 {cut}% 감소(추정)"},
            ]}
            target["note"] = "현재 처리량 = 고객 제공 · 감소율 = 추정"

    # 2) 추천 플랜 — 연결된 가격표 전체를 표로 보여주고 추천 행 하이라이트(항상)
    target = next((s for s in slides if s.get("type") == "plan"), None)
    if target:
        ri = _rec_index(team)
        rec = PRICING[ri]
        rows = []
        for i, p in enumerate(PRICING):
            name = p["plan"] + ("  ⟵ 추천" if i == ri else "")
            rows.append([name, p["monthly"], p["annual"], p["members"]])
        target.pop("metrics", None)
        target["table"] = {"columns": ["플랜", "월 요금", "연납(월)", "멤버"], "rows": rows, "highlight_row": ri}
        who = f"{team}명 규모" if team else "승인 게이트가 필요한 팀"
        target["heading"] = "요금제와 추천 플랜"
        target["subhead"] = f"{who} → {rec['plan']} 추천"
        target["note"] = "요금 = 연결된 가격표 기준" + (" · 인원 = 고객 제공" if team else "")
        target["bullets"] = [
            {"lead": f"{rec['plan']} 추천 이유",
             "detail": ("승인 게이트·모델 선택·스케줄 자동 실행이 포함돼 검증이 필요한 실무에 적합합니다." if rec["plan"] == "프로"
                        else "규모·거버넌스 요건에 맞춰 상위 플랜을 권장합니다." if ri >= 2
                        else "소규모로 먼저 시작해 효과를 확인하기 좋습니다.")},
            {"lead": "전 플랜 공통", "detail": "에이전트 생성·실행 무제한, 전 스킬 개방(정액). 상향은 승인 게이트·거버넌스 깊이 차이입니다."},
        ]


def create(agent: dict, customer: str, request: str, recipient: str = "",
           channel_id: str = "", thread_ts: str = "", facts: dict | None = None,
           requester: str = "") -> dict:
    """구조화 초안 → 슬라이드 덱 PDF 생성 후 승인 대기 스테이징. 스테이징 레코드 반환."""
    agent_id = agent.get("id", "")
    job = agent.get("job", "sales")
    facts = facts or {}
    res = pr.draft_structured(customer, request, agent_name=agent.get("name", "제안서 작성 에이전트"), agent_id=agent_id, facts=facts, job=job)
    # 스테이징엔 텍스트 초안(미리보기용)·인용을 보관
    result = {"draft": res.get("draft_text", ""), "citations": res.get("citations", []),
              "used_llm": res.get("used_llm", False), "model": res.get("model")}
    record = ex.stage_proposal(agent_id, customer, request, result,
                               recipient=recipient, channel_id=channel_id, thread_ts=thread_ts,
                               requester=requester)
    # 슬라이드 덱 PDF 우선(Chrome 렌더), 실패 시 텍스트 PDF 폴백
    pdf_path = ""
    try:
        deck = res.get("deck") or {}
        deck.setdefault("date", datetime.now().strftime("%Y-%m-%d"))
        if job == "sales":
            _apply_customer_facts(deck, facts)   # 영업: 고객 수치 → 예측·견적(요금표) 실제 값
        # (보험 FP 등 다른 직무는 덱 자체에 담보·보험료가 들어감 — 요금표 오버라이드 안 함)
        # 마무리(연락처) 슬라이드 추가 — 이미 있으면 중복 방지
        if not any((sl or {}).get("type") == "closing" for sl in deck.get("slides", [])):
            deck.setdefault("slides", []).append(_contact_slide(customer))
        pdf_path = deck_gen.generate(record["stage_id"], deck) or ""
        if not pdf_path:
            pdf_path = pdf_gen.generate(record["stage_id"], f"{customer or '고객사'} 제안서", res.get("draft_text", ""))
    except Exception:
        pdf_path = ""
    ex.set_pdf(record["stage_id"], pdf_path)
    record["pdf_path"] = pdf_path
    return record


def _email_signature() -> str:
    """메일 서명(명함 블록)."""
    c = _sales_contact()
    return (
        "\n\n--\n"
        f"{c['name']} · {c['title']}\n"
        f"{c['company']} {c['team']}\n"
        f"E. {c['email']}   T. {c['phone']}\n"
        f"{c['address']}"
    )


def _email_body(rec: dict) -> str:
    cust = rec.get("customer") or "고객"
    return (
        f"안녕하세요, {cust} 담당자님.\n\n"
        "요청 주신 내용을 바탕으로 Byr 도입 제안서를 첨부드립니다. "
        "제안서는 연결된 자료를 근거로 작성되었으며, 검토 후 편하신 방식으로 회신 부탁드립니다.\n\n"
        "감사합니다."
        + _email_signature()
    )


def send(stage_id: str) -> dict:
    """승인 → 이메일 발송(PDF 첨부) + 발송 기록. 발송 결과 dict 반환."""
    rec = ex.get_staging(stage_id)
    if not rec or rec.get("kind") != "proposal":
        return {"ok": False, "error": "not_found", "message": "제안서를 찾을 수 없습니다."}
    subject = f"[제안] {rec.get('customer') or '고객사'} — Byr 도입 제안서"
    fname = f"{(rec.get('customer') or '고객사')}_Byr_제안서.pdf"
    result = mailer.send(rec.get("recipient", ""), subject, _email_body(rec),
                         rec.get("pdf_path", ""), attachment_name=fname)
    ex.mark_sent(stage_id, result)
    return result
