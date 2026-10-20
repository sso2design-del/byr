import json, uuid, os
from datetime import date

DATA_FILE = os.path.join(os.path.dirname(__file__), "../data/teams.json")
AGENTS_FILE = os.path.join(os.path.dirname(__file__), "../data/agents.json")


def _load_agents_map():
    try:
        with open(AGENTS_FILE, encoding="utf-8") as f:
            return {a["id"]: a for a in json.load(f)}
    except Exception:
        return {}


def _member_task(agent):
    return (agent.get("purpose") or "").strip() or f"{agent.get('name', '에이전트')} 담당 업무를 처리합니다"


def _default_flow(agent_ids):
    """팀 멤버(있으면)로 기본 협업 흐름 초안을 만든다 — 멤버 순서대로 핸드오프."""
    amap = _load_agents_map()
    members = [amap[i] for i in (agent_ids or []) if i in amap]
    if not members:
        return None
    steps = [
        {"order": i + 1, "agent_id": m["id"], "task": _member_task(m), "high_risk": False}
        for i, m in enumerate(members)
    ]
    return {
        "id": f"flow-{uuid.uuid4().hex[:6]}",
        "name": "기본 협업 흐름",
        "icon": "⚡",
        "description": "팀 멤버 에이전트가 순서대로 처리하는 기본 협업 흐름입니다. 상세에서 편집하세요.",
        "status": "active",
        "trigger": {"type": "messenger", "config": "메신저 채널에서 이 흐름을 호출하면 시작합니다."},
        "steps": steps,
        "runs": [],
    }

def _normalize(t):
    # 다채널 배치: deployments(목록)로 통일. 레거시 단일 deployment는 목록으로 승격.
    if t.get("deployments") is None:
        legacy = t.get("deployment") or {}
        t["deployments"] = (
            [{"platform": legacy["platform"], "channel": legacy["channel"], "status": "배치됨"}]
            if legacy.get("platform") and legacy.get("channel") else []
        )
    # deployment(단일)는 하위호환용 = 목록 첫 항목
    t["deployment"] = t["deployments"][0] if t["deployments"] else {"platform": None, "channel": "", "status": "미배치"}
    return t

def _load():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        _save([])
        return []
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return [_normalize(t) for t in data]

def _save(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def list_teams():
    return _load()

def get_team(team_id):
    return next((t for t in _load() if t["id"] == team_id), None)

def create_team(name, purpose, agent_ids, icon=None):
    teams = _load()
    default_flow = _default_flow(agent_ids)  # 멤버로 기본 협업 흐름 자동 시드
    team = {
        "id": f"team-{uuid.uuid4().hex[:6]}",
        "name": name,
        "icon": icon or "👥",
        "purpose": purpose,
        "agents": agent_ids,
        "status": "draft",
        "deployment": {"platform": None, "channel": "", "status": "미배치"},
        "flows": [default_flow] if default_flow else [],
        "created_at": date.today().isoformat(),
        "created_by": "황소이 선임",
    }
    teams.append(team)
    _save(teams)
    return team

def update_team(team_id, patch):
    teams = _load()
    for t in teams:
        if t["id"] == team_id:
            t.update(patch)
            _save(teams)
            return t
    return None

def delete_team(team_id):
    teams = _load()
    new = [t for t in teams if t["id"] != team_id]
    if len(new) == len(teams):
        return False
    _save(new)
    return True

def add_member(team_id, agent_id):
    """팀에 멤버를 추가한다. 협업 흐름은 건드리지 않는다 —
    사용자가 편집한 흐름을 시스템이 임의로 바꾸면 안 된다.
    새 멤버를 흐름에 넣을지는 "스텝 편집"에서 사용자가 정한다."""
    teams = _load()
    for t in teams:
        if t["id"] != team_id:
            continue
        if agent_id in t.setdefault("agents", []):
            return t, "already"
        t["agents"].append(agent_id)
        _save(teams)
        return t, "added"
    return None, "no_team"


def member_flow_usage(team_id, agent_id):
    """이 멤버가 협업 흐름의 어느 단계에 쓰이는지. 제거 전 확인용."""
    for t in _load():
        if t["id"] != team_id:
            continue
        used = []
        for flow in t.get("flows") or []:
            steps = [s for s in (flow.get("steps") or []) if s.get("agent_id") == agent_id]
            if steps:
                used.append({"flow": flow.get("name"), "orders": [s.get("order") for s in steps]})
        return used
    return []


def remove_member(team_id, agent_id):
    """팀에서 멤버를 뺀다. 그 멤버가 들어간 흐름 단계도 함께 빼고 order를 다시 매긴다.

    흐름 단계를 남겨두면 존재하지 않는 멤버를 가리켜 실행이 깨진다
    (에이전트 삭제 시 정리와 같은 이유). 다만 이쪽은 **팀이 하는 일이 바뀌는**
    변경이므로, 조용히 처리하지 않고 호출 전에 사용자 확인을 받는다.
    """
    teams = _load()
    for t in teams:
        if t["id"] != team_id:
            continue
        if agent_id not in (t.get("agents") or []):
            return None, "not_member"
        t["agents"] = [a for a in t["agents"] if a != agent_id]
        dropped = 0
        for flow in t.get("flows") or []:
            steps = flow.get("steps") or []
            kept = [x for x in steps if x.get("agent_id") != agent_id]
            if len(kept) != len(steps):
                dropped += len(steps) - len(kept)
                for i, x in enumerate(kept):
                    x["order"] = i + 1
                flow["steps"] = kept
        _save(teams)
        return t, f"removed:{dropped}"
    return None, "no_team"


def teams_deployed_on(channel):
    """이 채널에 배치된 팀 목록. 개별 배치를 막을지 판단하는 데 쓴다."""
    if not channel:
        return []
    out = []
    for t in _load():
        deps = t.get("deployments") or ([t["deployment"]] if t.get("deployment") else [])
        if any(d and d.get("status") == "배치됨" and d.get("channel") == channel for d in deps):
            out.append(t)
    return out

def team_of_member_on(agent_id, channel):
    """이 에이전트를 멤버로 둔 팀 중, 해당 채널에 배치된 팀(없으면 None)."""
    for t in teams_deployed_on(channel):
        if agent_id in (t.get("agents") or []):
            return t
    return None

# 다채널 배치 — 채널을 목록에 추가(중복 채널명은 무시)
def deploy_team_channel(team_id, platform, channel):
    teams = _load()
    for t in teams:
        if t["id"] == team_id:
            deps = t.setdefault("deployments", [])
            if channel:
                existing = next((d for d in deps if d["channel"] == channel), None)
                if existing:                       # 기존 채널이면 상태·플랫폼 갱신(H3)
                    existing["status"] = "배치됨"
                    existing["platform"] = platform
                else:
                    deps.append({"platform": platform, "channel": channel, "status": "배치됨"})
            t["deployment"] = deps[0] if deps else {"platform": None, "channel": "", "status": "미배치"}
            t["status"] = "active" if deps else "draft"
            _save(teams)
            return t
    return None

# 다채널 배치 해제 — 특정 채널만 목록에서 제거
def undeploy_team_channel(team_id, channel):
    teams = _load()
    for t in teams:
        if t["id"] == team_id:
            deps = [d for d in t.get("deployments", []) if d["channel"] != channel]
            t["deployments"] = deps
            t["deployment"] = deps[0] if deps else {"platform": None, "channel": "", "status": "미배치"}
            t["status"] = "active" if deps else "draft"
            _save(teams)
            return t
    return None

# 협업 흐름 생성 — teams.json의 팀에 flow를 append. 단계는 order 자동 부여, runs는 빈 배열.
def create_flow(team_id, name, description, trigger, steps):
    teams = _load()
    for t in teams:
        if t["id"] == team_id:
            trig = dict(trigger or {})
            trig.setdefault("type", "messenger")
            trig.setdefault("config", "")
            flow = {
                "id": f"flow-{uuid.uuid4().hex[:6]}",
                "name": name,
                "icon": "⚡",
                "description": description,
                "status": "active",
                "trigger": trig,
                "steps": [
                    {
                        "order": i + 1,
                        "agent_id": s.get("agent_id", ""),
                        "task": s.get("task", ""),
                        "high_risk": bool(s.get("high_risk")),
                    }
                    for i, s in enumerate(steps)
                ],
                "runs": [],
            }
            t.setdefault("flows", []).append(flow)
            _save(teams)
            return t, flow
    return None, None

# 협업 흐름 편집 — 이름·설명·트리거·단계만 갱신. 실행 이력(runs)·id·icon은 보존.
def update_flow(team_id, flow_id, name, description, trigger, steps):
    teams = _load()
    for t in teams:
        if t["id"] == team_id:
            for f in t.get("flows", []):
                if f["id"] == flow_id:
                    f["name"] = name
                    f["description"] = description
                    trig = dict(trigger or {})
                    trig.setdefault("type", "messenger")
                    trig.setdefault("config", "")
                    f["trigger"] = trig
                    f["steps"] = [
                        {
                            "order": i + 1,
                            "agent_id": s.get("agent_id", ""),
                            "task": s.get("task", ""),
                            "high_risk": bool(s.get("high_risk")),
                        }
                        for i, s in enumerate(steps)
                    ]
                    _save(teams)
                    return t, f
    return None, None
