"""팀에이전트 메신저 오케스트레이터 — Phase 1(완주선) + Phase 2(운영 품질).

설계 근거: 02_output/spec/team-agent-messenger-conversation-design-v1.md
상태머신(task 단위): intake → clarifying → planning → awaiting_approval → dispatching
   → aggregating → awaiting_commit → completed  (예외: blocked/failed/cancelled/expired)

Phase 2 확장:
- 워크스페이스 모델: (platform, channel, user, team) 하나에 여러 task(request_id) 병렬 유지.
- 모호 발화: 후보를 신뢰도 점수순 제시 + 숫자(1/2) 선택.
- 표준 명령 확장: 현황 · 전환:[id] · 취소:[id] · 재개:[id].
- 세션 TTL(기본 24h) 만료/재개, 지연 리마인드, blocked 연속 2회 에스컬레이션.
- 감사 확장: SWITCH_TASK · SESSION_EXPIRED · SESSION_RESUMED · ESCALATED (agent/task/result/reason).

sales/insurance_fp 개별 제안서 경로(slack_bot)는 건드리지 않는다(회귀 금지).
"""
import os
import re
import json
from datetime import datetime

from . import conversation as C
from . import execution as ex
from . import job_runners as jr
from . import audit as au
from . import team_config as cfg

TEAM_SESSION_FILE = os.path.join(os.path.dirname(__file__), "../data/team_sessions.json")

_TASK_STATES = ("intake", "clarifying", "planning", "awaiting_approval", "dispatching",
                "aggregating", "awaiting_commit", "completed", "blocked", "failed",
                "cancelled", "expired")

_TEAM_EXTRA_INPUTS = {
    "sales": [C._f("customer", "고객사", "어느 고객사 대상인가요?", "NHN"),
              C._f("request", "요청 목적", "무엇을 제안할까요?", "전사 업무 자동화")],
    "insurance_fp": [C._f("customer", "고객", "어느 고객 대상인가요?", "김철수"),
                     C._f("request", "니즈", "고객 상황·니즈를 알려주세요.", "40대 가장, 암·사망 보장")],
}


# ── 시간/감사 ────────────────────────────────────────────────────
def _now():
    return datetime.now().isoformat()


def _age_sec(iso):
    try:
        return (datetime.now() - datetime.fromisoformat(iso)).total_seconds()
    except (ValueError, TypeError):
        return 0.0


def _audit(action, team_id, task_id, result, reason=""):
    """팀 액션 감사(신규 4종 포함). 필드: agent_id·task_id·result·reason."""
    actor = "agent" if action == "STAGE" else "user"
    au.log(actor, action, task_id or team_id or "-",
           f"[team] agent={team_id or '-'} task={task_id or '-'} "
           f"stage={task_id or '-'} result={result} reason={reason or '-'}")


# ── 워크스페이스 저장 ─────────────────────────────────────────────
def tkey(platform, channel_id, user_id, team_id):
    return "|".join(["team", platform or "", channel_id or "", user_id or "", team_id or ""])


def _load_all():
    if not os.path.exists(TEAM_SESSION_FILE):
        return {}
    try:
        with open(TEAM_SESSION_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_all(data):
    os.makedirs(os.path.dirname(TEAM_SESSION_FILE), exist_ok=True)
    with open(TEAM_SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_workspace(key):
    return _load_all().get(key)


def save_workspace(key, ws):
    data = _load_all()
    ws["updated_at"] = _now()
    data[key] = ws
    _save_all(data)


def clear_workspace(key):
    data = _load_all()
    if key in data:
        del data[key]
        _save_all(data)


def get_session(key):
    """하위호환(Phase 1): 활성 task 세션 반환."""
    ws = get_workspace(key)
    if not ws:
        return None
    return ws["tasks"].get(ws.get("active"))


def _new_workspace(platform, channel_id, user_id, team):
    tid = team.get("id") or team.get("team_id") or ""
    return {"platform": platform, "channel_id": channel_id, "user_id": user_id,
            "team_id": tid, "team_name": team.get("name", "팀에이전트"),
            "active": None, "tasks": {}, "pending": [], "seq": 0, "updated_at": _now()}


def _new_task(ws, request_text):
    ws["seq"] += 1
    tid = f"t{ws['seq']}"
    return {"task_id": tid, "request_id": f"req-{ws['team_id']}-{tid}",
            "request_text": request_text, "state": "intake",
            "plan": [], "cur": 0, "committed": False,
            "dry_run_ok": False,
            "blocked_count": 0, "prev_state": None,
            "last_status": None, "last_error": None,
            "created_at": _now(), "updated_at": _now()}


def _touch(task):
    task["updated_at"] = _now()


# ── 명령 파서 ────────────────────────────────────────────────────
def parse_ws_command(text):
    """워크스페이스 명령: 현황 · 전환:[id] · 취소:[id] · 재개:[id]. 반환 (kind, arg)."""
    t = (text or "").strip()
    if t in ("현황", "상태", "status"):
        return ("status", "")
    m = re.match(r"^(전환|switch)\s*[:：]?\s*(\S+)$", t)
    if m:
        return ("switch", m.group(2))
    m = re.match(r"^(재개|resume)\s*[:：]?\s*(\S+)$", t)
    if m:
        return ("resume", m.group(2))
    m = re.match(r"^취소\s*[:：]\s*(\S+)$", t)
    if m:
        return ("cancel_task", m.group(1))
    return (None, t)


def parse_task_command(text):
    """task 단위 명령. 승인 동의어는 설정(cfg.APPROVAL_WORDS)."""
    t = (text or "").strip()
    if t in cfg.APPROVAL_WORDS:
        return ("approve", "")
    low = t.lower()
    if low.startswith("다시 실행"):
        return ("rerun_live" if ("live" in low or "라이브" in low) else "rerun_dry", "")
    k, a = C.parse_command(t)   # 반려:[사유] · 재실행 dry/live · 취소
    if k == "approve":          # 승인 동의어는 오직 cfg.APPROVAL_WORDS(8종)만 허용
        return (None, t)        # (발송/send 등 개별엔진 동의어 누수 차단)
    return (k, a)


# ── 팀 멤버 직무 제한 ─────────────────────────────────────────────
def _allowed_jobs(team):
    """팀 멤버 에이전트의 직무 집합. 비어 있으면 set()(=제한 없음, 안전 폴백)."""
    jobs = team.get("jobs")
    if jobs:
        return set(jobs)
    tid = team.get("id") or team.get("team_id")
    if not tid:
        return set()
    try:
        from . import teams as tm, agents as ag
        t = tm.get_team(tid) or {}
        out = set()
        for aid in t.get("agents", []):
            a = ag.get_agent(aid)
            if a and a.get("job"):
                out.add(a["job"])
        return out
    except Exception:  # noqa: BLE001
        return set()


# ── 모호 발화: 후보 점수화 ────────────────────────────────────────
def candidates(request, allowed=None):
    """요청과 매칭되는 템플릿 후보(신뢰도 점수순). allowed 지정 시 그 직무로 제한."""
    q = C._norm(request)
    scored, seen = [], set()
    for t in C.TEMPLATES:
        if allowed and t.get("job") not in allowed:
            continue
        best = 0
        for p in t["intents"]:
            np = C._norm(p)
            if np and np in q:
                best = max(best, len(np))
        if best and t["key"] not in seen:
            seen.add(t["key"])
            scored.append({"tpl": t, "score": best})
    if not scored:
        return []
    total = sum(s["score"] for s in scored) or 1
    for s in scored:
        s["conf"] = round(100 * s["score"] / total)
    scored.sort(key=lambda x: -x["score"])
    return scored


def _available_templates(allowed=None):
    return [t for t in C.TEMPLATES if t.get("job") and (not allowed or t["job"] in allowed)]


def _llm_route(team, text, allowed=None):
    """정확한 시작문구가 없을 때 자연어 요청을 템플릿으로 매핑하거나 대화로 응답(LLM).

    반환: {"template": tpl, "reply": str} | {"reply": str} | None.
    LLM 불가/실패 시 None → 호출측이 온보딩으로 폴백(테스트는 이 경로 미도달, 결정론 유지).
    """
    try:
        from . import proposal
    except Exception:  # noqa: BLE001
        return None
    tpls = _available_templates(allowed)
    catalog = "\n".join(f"- {t['key']}: {t['name']}" for t in tpls)
    sysp = (
        "너는 팀에이전트의 요청 라우터다. 사용자의 자연어 요청을 아래 작업 카탈로그 중 하나로 "
        "매핑하거나, 인사/도움요청/무관이면 대화로 응답한다.\n"
        f"팀: {team.get('name', '')} — {team.get('purpose', '')}. 이 팀 성격에 맞는 작업을 우선 고려.\n"
        f"작업 카탈로그(key: 이름):\n{catalog}\n\n"
        "규칙: 특정 업무 요청이면 가장 근접한 작업 하나를 고르고 intent=task. "
        "인사·잡담이면 intent=greeting, 무엇을 할 수 있는지 물으면 intent=help, 전혀 무관하면 none. "
        "reply는 짧고 친근한 한국어 한두 문장.\n"
        "출력은 오직 JSON: {\"template_key\":\"\",\"intent\":\"task|greeting|help|none\",\"reply\":\"\"}"
    )
    res = proposal._call_llm(sysp, f"사용자 요청: {text}", max_tokens=250, target=team.get("id", "-"))
    if not res:
        return None
    try:
        txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", res[0].strip(), flags=re.I | re.M)
        m = re.search(r"\{.*\}", txt, flags=re.S)
        d = json.loads(m.group(0) if m else txt)
    except (ValueError, AttributeError):
        return None
    tk = (d.get("template_key") or "").strip()
    reply = (d.get("reply") or "").strip()
    if d.get("intent") == "task" and tk:
        tpl = next((t for t in tpls if t["key"] == tk), None)
        if tpl:
            return {"template": tpl, "reply": reply}
    return {"reply": reply} if reply else None


def _tpl_task(ws, tpl, request_text):
    task = _new_task(ws, request_text)
    task["plan"] = [{"task_id": task["task_id"], "job": tpl["job"], "template_key": tpl["key"],
                     "name": tpl["name"], "inputs": {}, "missing": [], "asking": None,
                     "stage_id": None, "status": None, "result": None}]
    task["state"] = "awaiting_approval"
    return task


# ── 입력 필드 ────────────────────────────────────────────────────
def _task_fields(item):
    tpl = next((t for t in C.TEMPLATES if t["key"] == item["template_key"]), None)
    if not tpl:
        return []
    if item["job"] in jr.JOB_RUNNERS:
        return C.resolve_inputs(tpl)
    return _TEAM_EXTRA_INPUTS.get(item["job"], [{**f, "can_empty": False} for f in tpl.get("inputs", [])])


# ── 메시지 ───────────────────────────────────────────────────────
def _onboarding_examples(team):
    """채널/팀 성격에 맞는 시작 예시 3개를 반환."""
    ctx = " ".join([
        str(team.get("name", "")),
        str(team.get("purpose", "")),
        " ".join(team.get("flows") or []),
    ]).lower()

    if any(k in ctx for k in ("증권", "리서치", "securities", "dart", "실적")):
        return [
            "`삼성전자 2Q 실적 컨센서스 대비 요약해줘`",
            "`2차전지 섹터 경쟁구도 핵심만 정리해줘`",
            "`NAVER 목표주가 근거(멀티플) 정리해줘`",
        ]
    if any(k in ctx for k in ("재무", "회계", "부가세", "월마감", "vat")):
        return [
            "`이번달 월마감 진행해줘`",
            "`부가세 대사 시작해줘`",
            "`법인카드 경비 정산 점검해줘`",
        ]
    if any(k in ctx for k in ("인사", "hr", "채용", "이력서")):
        return [
            "`백엔드 경력직 이력서 스크리닝해줘`",
            "`면접 질문 초안 만들어줘`",
            "`채용 공고 핵심 요건 정리해줘`",
        ]
    return [
        "`고객 제안서 준비해줘`",
        "`이번달 월마감`",
        "`이력서 스크리닝`",
    ]


def onboarding_message(team):
    name = team.get("name", "팀에이전트")
    ex = " · ".join(_onboarding_examples(team))
    return (f":busts_in_silhouette: 안녕하세요, *{name}* 팀에이전트입니다. "
            "요청을 직무별로 나눠 끝까지 진행하겠습니다.\n"
            f"예: {ex}")


def _plan_message(task):
    names = " + ".join(f"*{p['name']}*({p['job']})" for p in task["plan"])
    return (f":clipboard: [{task['task_id']}] 이 요청은 {len(task['plan'])}개 작업으로 나눕니다: {names}.\n"
            "이대로 진행할까요? — `승인`(진행) / `반려: 사유`")


def _ambiguous_message(scored):
    top = scored[:2]
    lines = [":thinking_face: 어떤 작업을 원하시나요? (숫자로 선택)"]
    for i, s in enumerate(top, 1):
        lines.append(f"  {i}) {s['tpl']['name']} (신뢰도 {s['conf']}%)")
    return "\n".join(lines)


_TERMINAL = ("completed", "cancelled", "expired")


def _workspace_status(ws):
    active_tasks = [(tid, tk) for tid, tk in ws["tasks"].items() if tk["state"] not in _TERMINAL]
    done = sum(1 for tk in ws["tasks"].values() if tk["state"] == "completed")
    cancelled = sum(1 for tk in ws["tasks"].values() if tk["state"] in ("cancelled", "expired"))
    if not active_tasks:
        tail = f" (완료 {done} · 종료 {cancelled})" if (done or cancelled) else ""
        return f":information_source: 진행 중인 작업이 없습니다.{tail} 요청을 보내주세요."
    lines = [":information_source: *진행 현황*"]
    for tid, task in active_tasks:
        mark = "▶" if tid == ws.get("active") else " "
        names = ", ".join(p["name"] for p in task["plan"]) or task.get("request_text", "")[:20]
        lines.append(f" {mark} [{tid}] {names} — {task['state']}")
    if done or cancelled:
        lines.append(f"_지난 작업: 완료 {done} · 종료 {cancelled}_")
    lines.append("_전환: `전환:[id]` · 취소: `취소:[id]` · 재개: `재개:[id]`_")
    return "\n".join(lines)


def _completion_message(task):
    parts, ids = [], []
    for p in task["plan"]:
        rec = p.get("result") or {}
        parts.append(rec.get("summary", p["name"]))
        ear = p.get("external_action_result") or {}
        ids.append(str(ear.get("id") or p.get("stage_id") or "-"))
    return (f":white_check_mark: *완료* [{task['task_id']}]: {' / '.join(parts)}\n"
            f"결과ID: `{', '.join(ids)}`\n"
            "다음 액션: `현황`으로 다른 작업을 보거나 새 요청을 보내세요.")


# ── per-task 상태머신 (Phase 1 로직, 순수 함수) ───────────────────
def _run_item(ws, task, item):
    agent = {"id": ws["team_id"], "job": item["job"], "name": ws["team_name"]}
    inputs = dict(item.get("inputs") or {})
    inputs["_template_key"] = item["template_key"]
    rec = ex.run_and_stage(ws["team_id"], agent, inputs)
    task["dry_run_ok"] = False  # 새 stage 생성 시 live 전 dry_run 재검증
    item["stage_id"] = rec["stage_id"]
    item["status"] = rec.get("status")
    item["result"] = {"summary": rec.get("summary"), "rule_findings": rec.get("rule_findings"),
                      "blocked": rec.get("blocked")}
    C._audit("STAGE", ws["team_id"], rec["stage_id"], f"{item['job']}/{item['template_key']}:{rec.get('status')}")
    if rec.get("blocked"):
        task["state"] = "blocked"
        task["blocked_count"] = task.get("blocked_count", 0) + 1
        blocks = [f["desc"] for f in (rec.get("rule_findings") or []) if f.get("action") == "block"]
        msg = [f":no_entry: *확정 불가(blocked)* [{task['task_id']}] {item['name']}\n"
               f"정책 위반: {' · '.join(blocks) or '규칙 위반'}\n"
               "수정 후 다시 진행하려면 `반려: 사유`, 종료는 `취소`."]
        if task["blocked_count"] >= cfg.ESCALATE_BLOCKED_COUNT:  # 에스컬레이션
            _audit("ESCALATED", ws["team_id"], task["task_id"], "blocked_repeat",
                   f"blocked {task['blocked_count']}회 연속")
            msg.append(f":rotating_light: *에스컬레이션* — [{task['task_id']}]이 {task['blocked_count']}회 연속 막혔습니다. "
                       "대표 확인이 필요합니다.")
        return msg
    return None


def _dispatch_next(ws, task):
    while task["cur"] < len(task["plan"]):
        item = task["plan"][task["cur"]]
        fields = _task_fields(item)
        fmap = {f["key"]: f for f in fields}
        if not item["missing"] and item["status"] is None:
            item["missing"] = [f["key"] for f in fields if f["key"] not in (item["inputs"] or {})]
        queue = [k for k in item["missing"] if k in fmap]
        item["missing"] = queue
        if queue:
            item["asking"] = queue[0]
            return [f":speech_balloon: [{item['name']}] " + C._ask_question(fmap[queue[0]]).replace(":speech_balloon: ", "")]
        if item["status"] is None:
            blk = _run_item(ws, task, item)
            if blk:
                return blk
        task["cur"] += 1
    task["state"] = "awaiting_commit"
    lines = [f":bar_chart: *취합 결과* [{task['task_id']}] — 승인하면 외부 반영을 준비합니다."]
    for p in task["plan"]:
        rec = p.get("result") or {}
        lines.append(f"• {p['name']}: {rec.get('summary', '')} · `{p['stage_id']}`")
    lines.append("확정하려면 `승인`, 되돌리려면 `반려: 사유`.")
    return ["\n".join(lines)]


def _commit_all(ws, task):
    previews = []
    for p in task["plan"]:
        if not p.get("stage_id"):
            continue
        rec = ex.commit(p["stage_id"], actor=ws.get("user_id") or "user",
                        self_approved=True)   # 팀 세션은 요청자 본인이 승인한다(지정 승인자 경로는 후속)
        if rec.get("error") == "blocked":
            C._audit("COMMIT", ws["team_id"], p["stage_id"], "blocked")
            return [f":no_entry: 규칙 위반으로 확정할 수 없습니다: {rec.get('message', '')}"]
        ear = rec.get("external_action_result") or {}
        C._audit("COMMIT", ws["team_id"], p["stage_id"], f"ok/{ear.get('error') or ear.get('id') or 'committed'}")
        if ear:
            previews.append(f"{ear.get('message', '')}")
    task["committed"] = True
    task["last_status"] = "committed"
    lines = [f":white_check_mark: 승인 완료 [{task['task_id']}] — 확정(스테이징)했습니다."]
    if previews:
        lines.append(":mag: 미리보기: " + " · ".join(previews))
        lines.append("실제 반영은 `재실행 live`, 다시 미리보려면 `재실행 dry_run`.")
    else:
        lines.append("다음 액션: 완료. 새 요청을 보내주세요.")
    return ["\n".join(lines)]


def _execute_all(ws, task, live):
    if live and cfg.REQUIRE_DRY_RUN_BEFORE_LIVE and task.get("committed") and not task.get("dry_run_ok"):
        return [":shield: live 실행 전에는 `재실행 dry_run` 1회 성공이 필요합니다. 먼저 `재실행 dry_run`을 실행해주세요."]

    mode = "live" if live else "dry_run"
    results, any_fail = [], False
    for p in task["plan"]:
        if not p.get("stage_id"):
            continue
        r = ex.execute_external_action(p["stage_id"], dry_run=not live)
        C._audit("EXTERNAL_ACTION", ws["team_id"], p["stage_id"],
                 f"{mode}/{r.get('error') or ('ok:' + str(r.get('id')))}")
        if r.get("error") == "not_approved":
            return [":lock: 승인 전에는 외부 실행이 차단됩니다. 먼저 `승인`을 해주세요."]
        if r.get("error") == "blocked":
            return [":no_entry: 규칙 위반으로 반영할 수 없습니다."]
        if r.get("error") == "already_reflected":   # 부분 실패 후 재시도 — 이미 나간 건은 다시 보내지 않음
            r = {"ok": True, "id": p["stage_id"], "message": "이미 반영됨(중복 실행 안 함)"}
        if r.get("error") in ("no_external_action", "unsupported_action"):
            r = {"ok": True, "id": p["stage_id"], "message": "외부 반영 없음(스테이징 확정)"}
        p["external_action_result"] = r
        if not r.get("ok"):
            any_fail = True
        results.append(r)
    if not live:
        if results and all(r.get("ok") for r in results):
            task["dry_run_ok"] = True
        return [":mag: 미리보기: " + " · ".join(x.get("message", "") for x in results) + "\n실제 반영은 `재실행 live`.\n(정책: live 전 dry_run 1회 성공 필수)"]
    if any_fail:
        task["state"] = "failed"
        errs = "; ".join(r.get("error") for r in results if not r.get("ok"))
        return [f":warning: 일부 반영 실패({errs}). `재실행 dry_run`으로 재확인하거나 다시 `재실행 live` 해주세요."]
    task["state"] = "completed"
    return [_completion_message(task)]


def _reject(ws, task, reason):
    task["last_status"] = "rejected"
    task["last_error"] = reason or "(사유 미기재)"
    for p in task.get("plan", []):
        if p.get("stage_id"):
            ex.undo(p["stage_id"])
            C._audit("REJECT", ws["team_id"], p["stage_id"], f"rejected:{task['last_error']}")
    for p in task.get("plan", []):
        p.update({"inputs": {}, "missing": [], "asking": None, "stage_id": None, "status": None, "result": None})
    task["cur"] = 0
    task["committed"] = False
    task["dry_run_ok"] = False
    task["state"] = "dispatching"
    out = _dispatch_next(ws, task)
    return [f":arrows_counterclockwise: 반려 사유 기록: {task['last_error']}. 수정해서 다시 진행할게요."] + out


def _advance_task(ws, task, text):
    """활성 task 1턴 진행(표준 명령 + 상태 전이)."""
    kind, arg = parse_task_command(text)
    state = task["state"]
    if kind == "cancel":
        for p in task.get("plan", []):
            if p.get("stage_id"):
                ex.undo(p["stage_id"])
        C._audit("CANCEL", ws["team_id"], task.get("plan") and task["plan"][0].get("stage_id"), "cancelled")
        task["state"] = "cancelled"
        if ws.get("active") == task["task_id"]:
            ws["active"] = None
        return [f":wave: [{task['task_id']}] 작업을 취소했어요."]
    if kind == "reject":
        return _reject(ws, task, arg)
    if state == "awaiting_approval":
        if kind == "approve":
            task["state"] = "dispatching"
            return _dispatch_next(ws, task)
        return ["진행하려면 `승인`, 계획을 바꾸려면 `반려: 사유`."]
    if state == "dispatching":
        item = task["plan"][task["cur"]] if task["cur"] < len(task["plan"]) else None
        if item and kind is None and item.get("asking"):
            fmap = {f["key"]: f for f in _task_fields(item)}
            field = fmap.get(item["asking"])
            value = C.coerce(field, text)
            err = C.validate_field(field, value)
            if err:
                return [f":warning: {err}"]
            item.setdefault("inputs", {})[item["asking"]] = value
            item["missing"] = [k for k in item["missing"] if k != item["asking"]]
            item["asking"] = None
            return _dispatch_next(ws, task)
        return _dispatch_next(ws, task)
    if state in ("awaiting_commit", "failed"):
        if kind == "approve":
            return _commit_all(ws, task)
        if kind == "rerun_dry":
            return _execute_all(ws, task, live=False)
        if kind == "rerun_live":
            return _execute_all(ws, task, live=True)
        return ["확정하려면 `승인`, 미리보기는 `재실행 dry_run`, 되돌리려면 `반려: 사유`."]
    if state == "blocked":
        return [":no_entry: 정책 위반으로 멈춰 있어요. `반려: 사유`로 수정하거나 `취소`로 종료해주세요."]
    return [":information_source: 다음 지시를 알려주세요. (`현황`으로 상태 확인)"]


# ── 유지관리: TTL 만료 / 지연 리마인드 ────────────────────────────
def _expire_and_remind(ws):
    """만료 처리(SESSION_EXPIRED) + 정체 리마인드. 반환: 시스템 메시지 리스트."""
    msgs = []
    for tid, task in ws["tasks"].items():
        if task["state"] in ("completed", "cancelled", "expired"):
            continue
        age = _age_sec(task["updated_at"])
        if age > cfg.SESSION_TTL_SEC:            # TTL 만료(C)
            task["prev_state"] = task["state"]
            task["state"] = "expired"
            _touch(task)                         # 만료 시각 갱신 → 재개 유예(즉시 정리 방지)
            _audit("SESSION_EXPIRED", ws["team_id"], tid, "expired", f"ttl>{cfg.SESSION_TTL_SEC}s")
            if ws.get("active") == tid:
                ws["active"] = None
            names = ", ".join(p["name"] for p in task["plan"]) or "요청"
            msgs.append(f":hourglass: [{tid}] 세션이 만료됐어요(요약: {names} · {task['prev_state']}). "
                        f"이어서 하려면 `재개:{tid}`.")
        elif task["state"] in ("awaiting_approval", "dispatching") and age > cfg.REMINDER_SEC:  # 지연 알림(D)
            if not task.get("_reminded"):
                task["_reminded"] = True
                msgs.append(f":alarm_clock: [{tid}] 진행이 멈춰 있어요({task['state']}). "
                            "계속하려면 응답해주세요. (`현황`으로 확인)")
    # 종료 상태(완료/취소/만료) 오래된 작업 정리(L1) — 워크스페이스·현황 클린 유지
    for tid in [k for k, tk in ws["tasks"].items()
                if tk["state"] in ("completed", "cancelled", "expired")
                and _age_sec(tk["updated_at"]) > 30 * 60]:
        del ws["tasks"][tid]
        if ws.get("active") == tid:
            ws["active"] = None
    return msgs


# ── 메인 엔트리 ──────────────────────────────────────────────────
def handle(platform, channel_id, user_id, team, text):
    key = tkey(platform, channel_id, user_id, team.get("id") or team.get("team_id") or "")
    ws = get_workspace(key) or _new_workspace(platform, channel_id, user_id, team)
    out = _expire_and_remind(ws)   # 매 턴: 만료/리마인드 선처리
    t = (text or "").strip()

    # 0) 모호 발화 숫자 선택 대기
    if ws.get("pending"):
        pick = None
        m = re.match(r"^([12])$", t)
        if m:
            idx = int(m.group(1)) - 1
            if idx < len(ws["pending"]):
                pick = ws["pending"][idx]
        else:
            for c in ws["pending"]:
                if C._norm(c["name"]) in C._norm(t):
                    pick = c
                    break
        if pick:
            tpl = next((x for x in C.TEMPLATES if x["key"] == pick["key"]), None)
            ws["pending"] = []
            task = _tpl_task(ws, tpl, ws.get("pending_text", t))
            ws["tasks"][task["task_id"]] = task
            ws["active"] = task["task_id"]
            save_workspace(key, ws)
            return out + [_plan_message(task)]
        # 선택 실패 — 취소면 초기화, 아니면 후보 유지하고 다시 안내(M2)
        if parse_task_command(t)[0] == "cancel":
            ws["pending"] = []
            save_workspace(key, ws)
            return out + ["선택을 취소했어요. 새 요청을 보내주세요."]
        cands = " / ".join(f"{i + 1}) {c['name']}" for i, c in enumerate(ws["pending"]))
        save_workspace(key, ws)
        return out + [f":point_up_2: 숫자로 골라주세요 — {cands}  (그만두려면 `취소`)"]

    # 1) 워크스페이스 명령
    wk, wa = parse_ws_command(t)
    if wk == "status":
        save_workspace(key, ws)
        return out + [_workspace_status(ws)]
    if wk == "switch":
        if wa in ws["tasks"]:
            ws["active"] = wa
            _audit("SWITCH_TASK", ws["team_id"], wa, "switched", f"active→{wa}")
            save_workspace(key, ws)
            return out + [f":twisted_rightwards_arrows: [{wa}]로 전환했어요.\n" + _workspace_status(ws)]
        save_workspace(key, ws)
        return out + [f"[{wa}] 작업을 찾을 수 없어요. `현황`으로 확인해주세요."]
    if wk == "cancel_task":
        task = ws["tasks"].get(wa)
        if task:
            for p in task.get("plan", []):
                if p.get("stage_id"):
                    ex.undo(p["stage_id"])
            task["state"] = "cancelled"
            C._audit("CANCEL", ws["team_id"], task["plan"] and task["plan"][0].get("stage_id"), f"cancel_task:{wa}")
            if ws.get("active") == wa:
                ws["active"] = None
            save_workspace(key, ws)
            return out + [f":wave: [{wa}] 작업을 취소했어요."]
        save_workspace(key, ws)
        return out + [f"[{wa}] 작업을 찾을 수 없어요."]
    if wk == "resume":
        task = ws["tasks"].get(wa)
        if task:
            if task["state"] == "expired":
                task["state"] = task.get("prev_state") or "awaiting_approval"
            ws["active"] = wa
            _touch(task)
            task["_reminded"] = False
            _audit("SESSION_RESUMED", ws["team_id"], wa, "resumed", f"→{task['state']}")
            save_workspace(key, ws)
            return out + [f":arrow_forward: [{wa}] 재개합니다.\n" + _workspace_status(ws)]
        save_workspace(key, ws)
        return out + [f"[{wa}] 작업을 찾을 수 없어요."]

    # 2) 활성 task 결정
    active = ws["tasks"].get(ws.get("active"))
    active_collecting = active and active["state"] == "dispatching" and \
        active["cur"] < len(active["plan"]) and active["plan"][active["cur"]].get("asking")
    tkind, _ = parse_task_command(t)

    # 활성 task가 질문 수집 중이거나 명령이면 → 활성 task로 라우팅
    if active and active["state"] not in ("completed", "cancelled", "expired") and \
            (active_collecting or tkind is not None):
        _touch(active)
        msgs = _advance_task(ws, active, t)
        save_workspace(key, ws)
        return out + msgs

    # 명령인데 처리할 활성 작업이 없음(M1) — 온보딩 덤프 대신 짧은 안내
    if tkind is not None:
        save_workspace(key, ws)
        return out + ["처리할 진행 중 작업이 없어요. 요청 문장으로 새 작업을 시작해주세요. (`현황`으로 확인)"]

    # 3) 신규 요청 접수(팀 멤버 직무로 제한 · 모호 발화 점수화)
    allowed = _allowed_jobs(team)
    scored = candidates(t, allowed)
    if len(scored) >= 2:                         # 후보 다수 → 모호(점수순 2개 제시)
        ws["pending"] = [{"key": s["tpl"]["key"], "name": s["tpl"]["name"], "conf": s["conf"]}
                         for s in scored[:2]]
        ws["pending_text"] = t
        save_workspace(key, ws)
        return out + [_ambiguous_message(scored)]
    if len(scored) == 1:                          # 단일 매칭 → task 생성
        task = _tpl_task(ws, scored[0]["tpl"], t)
        ws["tasks"][task["task_id"]] = task
        ws["active"] = task["task_id"]
        save_workspace(key, ws)
        return out + [_plan_message(task)]

    # 매칭 없음
    if active and active["state"] not in ("completed", "cancelled", "expired"):
        msgs = _advance_task(ws, active, t)
        save_workspace(key, ws)
        return out + msgs
    # 자연어 해석(LLM) — 정확한 시작문구가 없어도 요청을 이해하고 대화형으로 응답(팀 직무 범위)
    r = _llm_route(team, t, allowed)
    if r and r.get("template"):
        task = _tpl_task(ws, r["template"], t)
        ws["tasks"][task["task_id"]] = task
        ws["active"] = task["task_id"]
        save_workspace(key, ws)
        head = r.get("reply") or "요청을 이해했어요."
        return out + [f":sparkles: {head}\n" + _plan_message(task)]
    hint = " / ".join(_onboarding_examples(team)[:2])
    if r and r.get("reply"):
        save_workspace(key, ws)
        return out + [f"{r['reply']}\n\n이렇게 요청해보세요 — {hint}"]
    # 온보딩은 1회만 전체 노출, 이후엔 짧은 안내(M4)
    if ws.get("greeted"):
        save_workspace(key, ws)
        return out + [f"어떤 작업을 도와드릴까요? 예: {hint}  (`현황`으로 진행 확인)"]
    ws["greeted"] = True
    save_workspace(key, ws)
    return out + [onboarding_message(team) + "\n\n어떤 작업이 필요한지 한 문장으로 알려주세요."]
