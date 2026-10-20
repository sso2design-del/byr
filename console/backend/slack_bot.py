"""
Byr 지식봇 — Slack 실연동 Phase 1 (Socket Mode)

@멘션 또는 DM으로 질문하면, 지식봇이 답 + 출처를 스레드로 답한다.
(Phase 1 = 목 RAG. 실제 검색·인덱싱은 후속 트랙.)

준비:
  1) Slack 앱 생성 후 토큰을 ~/.hermes/.env 에:
       SLACK_BOT_TOKEN=xoxb-...
       SLACK_APP_TOKEN=xapp-...
  2) 의존성 설치:
       ./.venv/bin/pip install slack_bolt
  3) 실행:
       ./.venv/bin/python slack_bot.py
  4) 채널에 봇 초대(/invite @Byr-지식봇) 하거나 봇에게 DM → 질문.
"""
import os
import re
import json
import threading
from pathlib import Path
import app.team_config as team_cfg


def _load_hermes_env() -> None:
    """비밀키는 저장소가 아니라 ~/.hermes/.env 에서만 읽는다(기밀 규칙)."""
    env = Path.home() / ".hermes" / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_hermes_env()

# Byr 전용 앱 토큰 우선(BYR_*), 없으면 기존 SLACK_* 폴백(개발용 hermes 재사용)
BOT_TOKEN = os.environ.get("BYR_SLACK_BOT_TOKEN") or os.environ.get("SLACK_BOT_TOKEN")
APP_TOKEN = os.environ.get("BYR_SLACK_APP_TOKEN") or os.environ.get("SLACK_APP_TOKEN")
if not (BOT_TOKEN and APP_TOKEN):
    raise SystemExit(
        "SLACK_BOT_TOKEN / SLACK_APP_TOKEN 이 필요합니다.\n"
        "  ~/.hermes/.env 에 다음을 추가하세요:\n"
        "    SLACK_BOT_TOKEN=xoxb-...\n"
        "    SLACK_APP_TOKEN=xapp-...\n"
    )

try:
    from slack_bolt import App
    from slack_bolt.adapter.socket_mode import SocketModeHandler
except ImportError:
    raise SystemExit("slack_bolt 미설치 — 실행: ./.venv/bin/pip install slack_bolt")

app = App(token=BOT_TOKEN)


# ── 배치 라우팅: 채널 → 배치된 에이전트/팀 ────────────────────────
DATA_DIR = Path(__file__).parent / "data"
_ch_name_cache: dict = {}


def _norm_channel(ch: str) -> str:
    return (ch or "").lstrip("#").strip().lower()


def _load_routes() -> dict:
    """배치된 채널명(정규화) → 에이전트/팀 정보. 매 메시지 파일 로드(신규 배치 즉시 반영).

    우선순위는 team_config.CHANNEL_PRIORITY를 따른다(기본: team > agent).
    같은 종류끼리는 먼저 등록된 항목이 우선한다.
    """
    by_kind = {"team": {}, "agent": {}}

    # 1) 개별 에이전트 수집(채널별 first-win)
    try:
        for a in json.loads((DATA_DIR / "agents.json").read_text(encoding="utf-8")):
            dep = a.get("deployment") or {}
            if dep.get("channel") and dep.get("status") == "배치됨":
                key = _norm_channel(dep["channel"])
                by_kind["agent"].setdefault(key, {
                    "kind": "agent", "name": a.get("name", ""),
                    "role": a.get("role") or a.get("purpose", ""),
                    "job": a.get("job"), "agent_id": a.get("id"),
                })
    except Exception:
        pass

    # 2) 팀 수집(채널별 first-win)
    try:
        for t in json.loads((DATA_DIR / "teams.json").read_text(encoding="utf-8")):
            for dep in (t.get("deployments") or []):
                if not dep.get("channel") or dep.get("status") != "배치됨":
                    continue  # 미배치 팀은 채널에서 응답하지 않음(에이전트와 동일 기준)
                key = _norm_channel(dep["channel"])
                by_kind["team"].setdefault(key, {
                    "kind": "team", "name": t.get("name", ""),
                    "team_id": t.get("id"),
                    "role": t.get("purpose", ""),
                    "flows": [f.get("name") for f in (t.get("flows") or [])],
                })
    except Exception:
        pass

    # 3) 우선순위 적용(정책값 기반 단일 규칙 — team_config와 공유)
    return team_cfg.merge_routes_by_priority(by_kind)


def _channel_name(client, channel_id: str) -> str:
    if channel_id in _ch_name_cache:
        return _ch_name_cache[channel_id]
    try:
        name = client.conversations_info(channel=channel_id)["channel"]["name"]
    except Exception:
        name = ""
    _ch_name_cache[channel_id] = name
    return name


def _route(client, channel_id: str):
    """이 채널에 배치된 에이전트/팀(없으면 None → 지식봇)."""
    return _load_routes().get(_norm_channel(_channel_name(client, channel_id)))


# ── 목 답변(Phase 1) — 배치된 에이전트 인지 ─────────────────────────
def _answer(question: str, agent=None) -> dict:
    q = (question or "").lower()
    if "부가세" in q or "마감" in q or "신고" in q:
        return {
            "text": (
                "2026년 2분기 부가세 확정신고 *마감일은 7월 25일*입니다. "
                "준비 서류는 매입·매출 세금계산서 합계표, 대사 완료된 원장, 홈택스 신고서 초안입니다. "
                "재무팀 가이드 기준 *마감 3영업일 전까지 대사*를 끝내도록 권장합니다."
            ),
            "sources": [
                "`2026 부가세 신고 가이드.pdf` — Google Drive · p.3 마감 일정",
                "`세금계산서 합계표 (2026Q2)` — 국세청 홈택스 · 요약",
            ],
        }
    if "협업" in q or "승인" in q or "흐름" in q:
        return {
            "text": (
                "팀 협업 흐름은 여러 에이전트가 *핸드오프 + 사람 승인*으로 하나의 업무를 처리합니다. "
                "고위험 단계(외부 발송·제출)는 승인 전까지 진행되지 않고, 전 과정이 감사에 기록됩니다."
            ),
            "sources": ["`PRD — 팀 에이전트 협업(스텝·승인) v1` — Google Drive · 개요"],
        }
    if agent and agent.get("kind") == "team":
        flows = ", ".join(agent.get("flows") or []) or "협업 흐름"
        return {
            "text": (
                f"저는 이 채널에 배치된 팀 *{agent['name']}*입니다. "
                f"제 협업 흐름({flows})으로 '{question}'을(를) 처리합니다. "
                "(Phase 2 데모 — 실제 흐름 실행·승인은 후속)"
            ),
            "sources": ["`배치된 팀` — 콘솔 배치 기준"],
        }
    if agent:
        return {
            "text": (
                f"저는 이 채널에 배치된 *{agent['name']}*입니다. "
                f"'{question}'은(는) 제 담당({agent.get('role') or '업무'}) 범위에서 처리합니다. "
                "(Phase 2 데모 — 실제 실행·검색은 후속)"
            ),
            "sources": ["`배치된 에이전트` — 콘솔 배치 기준"],
        }
    return {
        "text": (
            f"'{question}'에 대해 연결된 사내 지식에서 관련 문서를 찾았습니다. "
            "(Phase 1 데모 — 실제 검색·인덱싱은 후속입니다.)"
        ),
        "sources": ["`검색 결과` — 연결된 소스(Drive·Slack·홈택스)"],
    }


def _reply(say, question: str, thread_ts: str, agent=None) -> None:
    a = _answer(question, agent)
    src = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(a["sources"]))
    if agent:
        icon = ":busts_in_silhouette:" if agent.get("kind") == "team" else ":robot_face:"
        header = agent["name"]
    else:
        icon = ":mag:"
        header = "Byr 지식봇"
    say(
        text=(
            f"{icon} *{header}*\n\n"
            f"{a['text']}\n\n"
            f"*출처*\n{src}\n\n"
            "_권한 범위 내 문서만 참고했고, 답변·출처는 감사에 기록됩니다._"
        ),
        thread_ts=thread_ts,
    )


# ── 제안서 작성·발송 에이전트(영업) — 메신저에서 전 과정 ──────────────
import app.proposal_task as proposal_task   # noqa: E402
import app.approval_policy as approval_policy   # noqa: E402
import app.execution as execution           # noqa: E402
import app.agents as agents_store           # noqa: E402
import app.conversation as conversation     # noqa: E402
import app.team_conversation as team_conversation  # noqa: E402
BACKEND_BASE = os.environ.get("BYR_BACKEND_BASE", "http://localhost:8000")

# 대화형 '작성·발송' 태스크를 지원하는 직무(영업·보험 FP 등 제안서형) — 기존 경로 유지
_TASK_JOBS = ("sales", "insurance_fp")
# 범용 대화엔진(온보딩→질문수집→실행→승인/반려→반영)으로 완주하는 직무
_CONVO_JOBS = conversation.CONVO_JOBS

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _parse_proposal_request(text: str) -> dict:
    """메시지에서 고객사·받는사람(이메일)·요청을 추출.
    라벨(고객사:/받는사람:/요청:)을 우선 인식, 없으면 이메일 정규식 + 전체를 요청으로."""
    customer, recipient, req_lines = "", "", []
    for line in text.splitlines():
        m = re.match(r"\s*(고객사|회사|client)\s*[:=]\s*(.+)", line, re.I)
        if m:
            customer = m.group(2).strip(); continue
        m = re.match(r"\s*(받는사람|수신|이메일|메일|to)\s*[:=]\s*(.+)", line, re.I)
        if m:
            em = _EMAIL_RE.search(m.group(2))
            recipient = em.group(0) if em else m.group(2).strip(); continue
        m = re.match(r"\s*(요청|상황|내용)\s*[:=]\s*(.+)", line, re.I)
        if m:
            req_lines.append(m.group(2).strip()); continue
        req_lines.append(line)
    request = "\n".join(l for l in req_lines if l.strip()).strip()
    if not recipient:
        em = _EMAIL_RE.search(text)
        if em:
            recipient = em.group(0)
            request = request.replace(recipient, "").strip()
    return {"customer": customer, "recipient": recipient, "request": request}


def _upload_pdf(client, channel_id, rec) -> bool:
    """생성된 PDF를 채널에 첨부(files:write 없으면 조용히 건너뜀). 성공 여부 반환."""
    path = rec.get("pdf_path")
    if not path or not Path(path).exists():
        return False
    try:
        client.files_upload_v2(
            channel=channel_id, file=path,
            filename=f"{rec.get('customer') or '고객사'}_Byr_제안서.pdf",
            title="제안서 초안(PDF)",
        )
        return True
    except Exception:
        return False


# ── 대화형 슬롯 필링 (채널별 진행 상태, 메모리) ──────────────────────
_convo: dict = {}   # channel_id -> {step, customer, request, recipient, agent_id}

_NO_SOURCE = (":open_file_folder: 아직 연결된 *근거 소스가 없어요*. "
              "콘솔의 이 에이전트 화면(스킬 옵션 → 파일 접근 경로)에서 문서를 먼저 연결해주세요. 그 문서를 근거로 제안서를 씁니다.")

# 중복 이벤트 제거(Slack 재시도·app_mention+message 이중 발생 방지)
_processed: dict = {}
_team_onboarded_channels: set = set()
_bot_user_id_cache: str = ""


def _dedup(event) -> bool:
    key = event.get("client_msg_id") or event.get("ts") or ""
    if not key:
        return False
    if key in _processed:
        return True
    _processed[key] = 1
    if len(_processed) > 800:
        for k in list(_processed)[:400]:
            _processed.pop(k, None)
    return False


def _bg(target, *args):
    """무거운 작업(생성·발송)은 스레드로 → 리스너가 빨리 반환해 Slack ack 지연·재시도 방지."""
    threading.Thread(target=target, args=args, daemon=True).start()


def _bot_user_id(client) -> str:
    """현재 봇 사용자 ID(auth.test) 캐시."""
    global _bot_user_id_cache
    if _bot_user_id_cache:
        return _bot_user_id_cache
    try:
        _bot_user_id_cache = (client.auth_test() or {}).get("user_id", "")
    except Exception:
        _bot_user_id_cache = ""
    return _bot_user_id_cache


def _send_team_onboarding_once(client, channel_id: str, route) -> bool:
    """팀 채널에 온보딩을 1회 전송한다(프로세스 기준)."""
    if not route or route.get("kind") != "team":
        return False
    if channel_id in _team_onboarded_channels:
        return False
    team = {
        "id": route.get("team_id"),
        "name": route.get("name", "팀에이전트"),
        "purpose": route.get("role", ""),
        "flows": route.get("flows") or [],
    }
    msg = team_conversation.onboarding_message(team) + "\n\n어떤 작업이 필요한지 한 문장으로 알려주세요."
    try:
        client.chat_postMessage(channel=channel_id, text=msg)
        _team_onboarded_channels.add(channel_id)
        return True
    except Exception:
        return False


def _parse_scale(text: str) -> dict:
    """규모 답변에서 팀 인원·현재 처리량 추출. '건너뛰기'면 빈 dict."""
    t = (text or "").strip()
    if t in ("건너뛰기", "스킵", "없음", "모름", "skip", "-"):
        return {}
    n = t.replace(",", "")
    team = re.search(r"(\d+)\s*(?:명|인|사람)", n)
    vol = re.search(r"(\d+)\s*건", n)
    facts = {}
    if team:
        facts["team_size"] = int(team.group(1))
    if vol:
        facts["volume"] = int(vol.group(1))
    return facts


def _generate_and_offer(say, client, route, customer, request, recipient, channel_id, facts=None, requester=""):
    """근거 초안 + PDF 생성 → 채널에 PDF + 승인 안내."""
    say(text=":hourglass_flowing_sand: 근거를 찾아 제안서를 작성하고 PDF로 만드는 중…")
    agent = agents_store.get_agent(route.get("agent_id", "")) or {"id": route.get("agent_id", ""), "name": route.get("name", "")}
    rec = proposal_task.create(agent, customer, request, recipient=recipient, channel_id=channel_id,
                               facts=facts or {}, requester=requester)
    pdf_ok = _upload_pdf(client, channel_id, rec)
    cites = "\n".join(f"• {c['label']}" for c in rec.get("citations", [])[:4])
    engine = rec.get("model") or "템플릿"
    recip = recipient or "_미지정 — 발송하려면 받는분 이메일이 필요해요_"
    if pdf_ok:
        pdf_line = ":point_up_2: 위 *PDF를 열어 검토*하세요."
    else:
        pdf_line = f":page_facing_up: PDF: {BACKEND_BASE}/api/proposals/{rec['stage_id']}/pdf"
    say(text=(
        f":page_facing_up: *{customer or '고객사'} 제안서 PDF* 준비 완료 (근거 기반 · {engine})\n"
        f":envelope_with_arrow: 받는사람: {recip}\n\n"
        f"{pdf_line}\n\n"
        f"*근거*\n{cites}\n\n"
        f"검토 후 보내려면 채널에 *`승인`* 이라고 보내주세요. "
        f"(다시 만들려면 `다시`)"
    ))


_DECK_CONTENTS = ("생성되는 제안서 덱은 항상 다음 슬라이드를 포함한다: 표지, 제안 요약, 고객 현황·과제, "
                  "Byr 제안 개요, 작동 방식, 기대 효과(수치), 핵심 지표(차트), 범용 챗봇 비교(표), "
                  "보안·컴플라이언스, 도입 로드맵, **요금제와 추천 플랜(전체 플랜 표+추천)**, 마무리(연락처·명함).")

_CONVERSE_SYS = (
    "너는 Byr(L3 Agentic AI 플랫폼)의 제안서 작성 도우미다. 목표는 고객 맞춤 제안서를 만들기 위해 "
    "대화로 정보를 모으는 것이다. 모을 항목:\n"
    "- customer: 고객사(회사) 이름 [필수]\n"
    "- request: 고객의 상황·요청(무엇을 원하는지) [필수]\n"
    "- recipient: 제안서를 보낼 받는분 이메일 [선택]\n"
    "- team_size: 팀/조직 인원(정수) [선택]\n"
    "- volume: 현재 처리량(하루 건수, 정수) [선택]\n\n"
    f"{_DECK_CONTENTS}\n\n"
    "규칙:\n"
    "1) 자연스럽고 짧게, 한 번에 하나씩. 딱딱한 폼처럼 굴지 마라.\n"
    "2) 사용자가 딴 질문·잡담·정정을 하면 짧게 답/인정하고 다시 유도해라.\n"
    "3) 이미 아는 정보는 유지, 정정하면 갱신.\n"
    "4) **맥락 인식**: '방금 만든/아까 그 ○○ 제안서'처럼 최근 제안서를 언급하면, 아래 '최근 제안서' 정보의 고객사를 customer로 인식해라.\n"
    "5) **이미 포함된 항목 요청**: 사용자가 이미 덱에 있는 슬라이드(예: 플랜/요금, 보안, 로드맵)를 '추가'해달라 하면, "
    "그 슬라이드가 이미 포함돼 있음을 알려주고, 다시 만들어 보낼지(action='generate') 다른 조정이 필요한지 물어라.\n"
    "6) customer·request가 모이면 '이대로 만들까요?' 확인 후 동의 시 action='generate'. 재생성(수정 반영)도 action='generate'.\n\n"
    "출력은 **오직 JSON**: {\"reply\":\"한국어 메시지\","
    "\"slots\":{\"customer\":\"\",\"request\":\"\",\"recipient\":\"\",\"team_size\":0,\"volume\":0},"
    "\"action\":\"ask\"|\"generate\"}. 새로 파악한 slot만 채워라."
)

_DECK_CONTENTS_FP = ("생성되는 보험 제안 덱은 항상 다음을 포함한다: 표지, 제안 요약, 고객 현황, "
                     "보장 갭 분석, 추천 보장·상품, 예상 보험료, 보장 강화 효과, 가입 절차, 마무리(연락처·명함).")

_CONVERSE_SYS_FP = (
    "너는 보험 FP(재무설계사)의 맞춤 보험 제안 도우미다. 대화로 정보를 모은다:\n"
    "- customer: 고객 이름 [필수]\n"
    "- request: 고객 상황·니즈(나이·가족·직업·관심 보장·예산 등 자유서술) [필수]\n"
    "- recipient: 제안서를 보낼 이메일 [선택]\n\n"
    f"{_DECK_CONTENTS_FP}\n\n"
    "규칙:\n"
    "1) 자연스럽고 짧게, 한 번에 하나씩. 딱딱한 폼처럼 굴지 마라.\n"
    "2) 딴 질문·잡담·정정에는 짧게 답/인정하고 다시 유도.\n"
    "3) 이미 아는 정보 유지, 정정하면 갱신.\n"
    "4) 최근 만든 제안서를 언급하면 아래 '최근 제안서'의 고객을 이어서 활용.\n"
    "5) 이미 덱에 있는 항목(예: 보험료, 보장 갭) '추가' 요청엔 이미 포함됨을 알리고 재생성/조정 제안.\n"
    "6) customer·request가 모이면 '이대로 보험 제안서를 만들까요?' 확인 후 동의 시 action='generate'.\n\n"
    "출력은 **오직 JSON**: {\"reply\":\"한국어 메시지\","
    "\"slots\":{\"customer\":\"\",\"request\":\"\",\"recipient\":\"\",\"team_size\":0,\"volume\":0},"
    "\"action\":\"ask\"|\"generate\"}. 새로 파악한 slot만 채워라."
)

_CONVERSE_BY_JOB = {"sales": _CONVERSE_SYS, "insurance_fp": _CONVERSE_SYS_FP}


def _converse(collected: dict, user_msg: str, context: str = "", job: str = "sales") -> dict:
    """LLM이 대화를 이끈다(직무별 프롬프트). 반환 {reply, slots, action}."""
    import app.proposal as proposal
    sysp = _CONVERSE_BY_JOB.get(job, _CONVERSE_SYS)
    known = {k: collected.get(k) for k in ("customer", "request", "recipient", "team_size", "volume") if collected.get(k)}
    user = (f"{context}\n" if context else "") + f"지금까지 수집: {json.dumps(known, ensure_ascii=False)}\n사용자 메시지: {user_msg}"
    res = proposal._call_llm(sysp, user, max_tokens=600)
    if res:
        raw = res[0]
        try:
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I | re.M)
            m = re.search(r"\{.*\}", txt, flags=re.S)
            d = json.loads(m.group(0) if m else txt)
            return {"reply": d.get("reply", ""), "slots": d.get("slots") or {}, "action": d.get("action", "ask")}
        except Exception:
            pass
    # 폴백(LLM 실패)
    if not collected.get("customer"):
        return {"reply": ":wave: 제안서를 만들어 드릴게요. 어느 고객사 대상인가요?", "slots": {}, "action": "ask"}
    return {"reply": "어떤 상황이거나 무엇을 제안할까요?", "slots": {}, "action": "ask"}


def _run_converse(say, client, route, channel_id, text, requester=""):
    """대화 1턴(스레드 실행): LLM 응답 → slot 갱신 → 필요 시 생성."""
    agent_id = route.get("agent_id", "")
    job = route.get("job", "sales")
    collected = dict(_convo.get(channel_id) or {})
    # 맥락(기억): 이 채널에서 최근 만든 제안서
    context = ""
    last = execution.find_last_proposal(channel_id)
    if last.get("customer"):
        context = (f"[최근 제안서] 이 채널에서 방금 전 '{last['customer']}' 대상 제안서를 만들었음"
                   f"(요청 요약: {(last.get('request') or '')[:60]}). "
                   "사용자가 '방금/아까 그 제안서'처럼 이걸 언급하면 이 고객·요청을 이어서 활용하라. "
                   "단, 사용자가 명백히 다른 고객으로 새로 시작하면 그 새 고객을 따르라.")
    r = _converse(collected, text, context, job)
    for k, v in (r.get("slots") or {}).items():
        if v:
            collected[k] = v
    _convo[channel_id] = collected
    _log("converse", "action=", r.get("action"), "collected=", {k: collected.get(k) for k in ("customer", "request", "recipient", "team_size", "volume") if collected.get(k)})
    if r.get("reply"):
        say(text=r["reply"])
    if r.get("action") == "generate" and collected.get("customer") and collected.get("request"):
        if not proposal_task.has_sources(agent_id):
            say(text=_NO_SOURCE)
            return
        facts = {"team_size": collected.get("team_size") or None, "volume": collected.get("volume") or None}
        _convo.pop(channel_id, None)
        _generate_and_offer(say, client, route, collected.get("customer", ""), collected.get("request", ""),
                            collected.get("recipient", ""), channel_id, facts, requester=requester)


def _advance_proposal(say, client, route, text, channel_id, requester=""):
    """제안서 작성 대화 — LLM이 이끈다(오프스크립트 대응). 무거운 부분은 스레드로."""
    t = (text or "").strip()

    # 빠른 명령어
    if t in ("취소", "그만", "중단", "cancel", "stop"):
        _convo.pop(channel_id, None)
        say(text="네, 멈췄어요. 다시 이야기 걸어주시면 이어서 도와드릴게요.")
        return
    if t in ("다시", "처음부터", "reset"):
        _convo.pop(channel_id, None)
        say(text=":arrows_counterclockwise: 처음부터 할게요. 어느 고객사 대상인가요?")
        return

    # 라벨 한 번에 입력(파워유저) → 바로 생성
    if re.search(r"(고객사|회사|받는사람|수신|요청|상황)\s*[:=]", t):
        p = _parse_proposal_request(text)
        if p["customer"] or len(p["request"]) >= 4:
            if not proposal_task.has_sources(route.get("agent_id", "")):
                say(text=_NO_SOURCE); return
            _convo.pop(channel_id, None)
            _bg(_generate_and_offer, say, client, route, p["customer"], p["request"], p["recipient"], channel_id,
                None, requester)
            return

    # LLM 대화(스레드) — 오프스크립트도 자연스럽게 대응
    _bg(_run_converse, say, client, route, channel_id, t, requester)


def _run_convo(say, route, event, text):
    """범용 대화엔진 1턴 — (platform, channel, user, agent) 세션으로 완주."""
    agent = agents_store.get_agent(route.get("agent_id", "")) or {
        "id": route.get("agent_id", ""), "name": route.get("name", ""), "job": route.get("job")}
    replies = conversation.handle("slack", event.get("channel"), event.get("user", ""), agent, text)
    for m in replies:
        say(text=m)


def _run_team(say, route, event, text):
    """팀 오케스트레이터 1턴 — 요청 분해→배정→승인→반영→완료."""
    team = {
        "id": route.get("team_id"),
        "name": route.get("name", "팀에이전트"),
        "purpose": route.get("role", ""),
        "flows": route.get("flows") or [],
    }
    replies = team_conversation.handle("slack", event.get("channel"), event.get("user", ""), team, text)
    for m in replies:
        say(text=m)


def _handle_approval(say, event) -> bool:
    """채널의 '승인' → 이 채널의 최근 대기 제안서 발송. 처리했으면 True.

    누가 쳤는지 확인한다(approval_policy). 승인자가 아니면 발송하지 않고 이유를 알린다.
    """
    text = re.sub(r"<@[^>]+>", "", event.get("text") or "").strip()
    if not approval_policy.is_approve_word(text):
        return False
    rec = execution.find_pending_proposal(event.get("channel"))
    if not rec:
        return False
    actor = event.get("user", "")
    agent = agents_store.get_agent(rec.get("agent_id", "")) or {}
    verdict = approval_policy.check(agent, rec.get("requester", ""), actor)
    if not verdict.get("ok"):
        _log("approval denied", rec.get("stage_id"), verdict.get("reason"), "actor=", actor)
        say(text=f":lock: {verdict['message']}")
        return True
    claimed = execution.claim_proposal(rec["stage_id"], actor, verdict.get("self_approved", False))
    if not claimed:   # 동시에 들어온 다른 '승인'이 먼저 처리함
        return True
    mark = " (요청자 본인 승인)" if verdict.get("self_approved") else ""

    def _finish():
        result = proposal_task.send(rec["stage_id"])
        if result.get("ok"):
            say(text=f":white_check_mark: *발송 완료*{mark} — {rec.get('recipient')} 로 제안서를 보냈어요. 다음 제안서는 `제안서` 라고 보내면 시작할게요.")
        else:
            say(text=f":warning: 승인은 기록했지만 발송은 대기예요. {result.get('message','')}")
    _bg(_finish)
    return True


def _log(*a):
    print("[byr]", *a, flush=True)


# Slack AI 앱(Claude 등)으로 보낸 메시지 끝에 붙는 출처 줄("*다음을 사용하여 보냄* <@앱>")을 뗀다.
# 이 줄이 남으면 '승인'·'취소' 같은 정확한 명령을 알아보지 못한다(2026-10-19 Slack 실환경 QA에서 발견).
_SENT_VIA = re.compile(r"\s*\*?(다음을 사용하여 보냄|Sent using)\*?\s*<@[^>]+>\s*$")


def _clean_text(event) -> None:
    t = event.get("text") or ""
    c = _SENT_VIA.sub("", t)
    if c != t:
        event["text"] = c.strip()


@app.event("app_mention")
def on_mention(event, say, client):
    if _dedup(event):
        return
    _clean_text(event)
    question = re.sub(r"<@[^>]+>", "", event.get("text", "")).strip()
    ch = event.get("channel")
    route = _route(client, ch)
    _log("app_mention", "ch=", _channel_name(client, ch), "route=", route and route.get("name"), "job=", route and route.get("job"))
    if route and route.get("kind") == "agent" and route.get("job") in _TASK_JOBS:
        if not _handle_approval(say, event):
            _advance_proposal(say, client, route, question, ch, event.get("user", ""))
        return
    if route and route.get("kind") == "agent" and route.get("job") in _CONVO_JOBS:
        _bg(_run_convo, say, route, event, question)
        return
    if route and route.get("kind") == "team":
        _bg(_run_team, say, route, event, question)
        return
    _reply(say, question, event.get("thread_ts") or event.get("ts"), route)


@app.event("message")
def on_message(event, say, client):
    # 봇/시스템 메시지(입장·변경 등)는 무시 — 무한 루프·잡음 방지
    if event.get("bot_id") or event.get("subtype"):
        return
    if _dedup(event):   # 재시도·중복 이벤트 무시
        return
    _clean_text(event)
    text = (event.get("text") or "").strip()
    if not text:
        return
    ctype = event.get("channel_type")
    ch = event.get("channel")
    if ctype == "im":
        _log("message im")
        _reply(say, text, event.get("thread_ts") or event.get("ts"))  # DM = 지식봇
        return
    if ctype not in ("channel", "group"):
        return
    route = _route(client, ch)
    _log("message", "type=", ctype, "ch=", _channel_name(client, ch), "route=", route and route.get("name"), "job=", route and route.get("job"), "text=", text[:30])
    if route is None:
        _log("  → 라우팅된 에이전트 없음(채널명 불일치 가능) → 무시")
        return
    if route.get("kind") == "team":
        # 가입 이벤트를 놓친 경우를 대비한 온보딩 보정(첫 대화 전에 1회 노출)
        _send_team_onboarding_once(client, ch, route)
    # 승인 우선
    if _handle_approval(say, event):
        return
    if route.get("kind") == "agent" and route.get("job") in _TASK_JOBS:
        _advance_proposal(say, client, route, text, ch, event.get("user", ""))   # 대화형 진행(제안서형)
        return
    if route.get("kind") == "agent" and route.get("job") in _CONVO_JOBS:
        _bg(_run_convo, say, route, event, text)          # 범용 대화엔진
        return
    if route.get("kind") == "team":
        _bg(_run_team, say, route, event, text)           # 팀 오케스트레이터
        return
    _reply(say, text, event.get("thread_ts") or event.get("ts"), route)


@app.event("member_joined_channel")
def on_member_joined_channel(event, client):
    """봇이 팀 채널에 초대되면 온보딩 메시지를 즉시 선노출."""
    ch = event.get("channel")
    joined_user = event.get("user")
    if not ch or not joined_user:
        return
    if joined_user != _bot_user_id(client):
        return
    route = _route(client, ch)
    _send_team_onboarding_once(client, ch, route)


@app.event("channel_joined")
def on_channel_joined(event, client):
    """공개채널 조인 이벤트 폴백: 팀 채널이면 온보딩 즉시 전송."""
    ch_obj = event.get("channel") or {}
    ch = ch_obj.get("id")
    if not ch:
        return
    route = _route(client, ch)
    _send_team_onboarding_once(client, ch, route)


if __name__ == "__main__":
    print("⚡ Byr 지식봇 (Socket Mode) 시작 — @멘션 또는 DM으로 질문하세요. (Ctrl+C 종료)")
    SocketModeHandler(app, APP_TOKEN).start()
