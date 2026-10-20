import json, os
from datetime import datetime

AUDIT_FILE = os.path.join(os.path.dirname(__file__), "../data/audit.jsonl")

def log(actor: str, action: str, target: str, detail: str = ""):
    os.makedirs(os.path.dirname(AUDIT_FILE), exist_ok=True)
    entry = {
        "ts": datetime.now().isoformat(),
        "actor": actor,
        "action": action,   # READ | STAGE | COMMIT | UNDO | MODEL_CALL | KB_READ | EXTERNAL_ACTION
        "target": target,
        "detail": detail,
    }
    with open(AUDIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    rotate_if_needed()
    return entry

def list_audit(limit: int = 50) -> list[dict]:
    if not os.path.exists(AUDIT_FILE):
        return []
    with open(AUDIT_FILE, encoding="utf-8") as f:
        lines = f.readlines()
    entries = [json.loads(l) for l in lines if l.strip()]
    return list(reversed(entries))[:limit]


# ─────────────────────────────────────────────────────────────
# A2. 사용량 집계 — MODEL_CALL 기록에서 뽑는다.
#     회사 제품이면 가격 근거, 개인이면 본인 지갑. 어느 쪽이든 원본은 같다.
# ─────────────────────────────────────────────────────────────

def _parse_model_call(detail: str) -> dict:
    """detail 형식: provider/model/scope/ok|fail[/in:N,out:M]"""
    parts = (detail or "").split("/")
    out = {"provider": None, "model": None, "scope": None, "ok": None, "in": 0, "out": 0}
    if len(parts) >= 4:
        out["provider"], out["model"], out["scope"], out["ok"] = parts[0], parts[1], parts[2], parts[3] == "ok"
    for p in parts[4:]:
        if p.startswith("in:"):
            for kv in p.split(","):
                k, _, v = kv.partition(":")
                if k in ("in", "out") and v.isdigit():
                    out[k] = int(v)
    return out


def usage_summary(days: int = 30) -> dict:
    """최근 N일 모델 사용량. 자체/외부, provider·model 별 토큰과 호출 수."""
    from datetime import datetime, timedelta
    if not os.path.exists(AUDIT_FILE):
        return {"days": days, "calls": 0, "tokens_in": 0, "tokens_out": 0, "by_model": [], "failures": 0}
    since = datetime.now() - timedelta(days=days)
    by = {}
    calls = fails = tin = tout = 0
    with open(AUDIT_FILE, encoding="utf-8") as f:
        for line in f:
            if '"MODEL_CALL"' not in line:
                continue
            try:
                e = json.loads(line)
                if datetime.fromisoformat(e["ts"]) < since:
                    continue
            except Exception:
                continue
            m = _parse_model_call(e.get("detail", ""))
            calls += 1
            if not m["ok"]:
                fails += 1
            tin += m["in"]; tout += m["out"]
            k = (m["provider"], m["model"], m["scope"])
            b = by.setdefault(k, {"provider": k[0], "model": k[1], "scope": k[2],
                                  "calls": 0, "tokens_in": 0, "tokens_out": 0, "failures": 0})
            b["calls"] += 1; b["tokens_in"] += m["in"]; b["tokens_out"] += m["out"]
            if not m["ok"]:
                b["failures"] += 1
    return {
        "days": days, "calls": calls, "failures": fails,
        "tokens_in": tin, "tokens_out": tout,
        "by_model": sorted(by.values(), key=lambda x: -(x["tokens_in"] + x["tokens_out"])),
    }


# ─────────────────────────────────────────────────────────────
# A3. 보관 정책 — 모델 호출은 대화 한 번에 수십 건이라 금방 불어난다.
#     단일 파일에 무한정 붙이면 지금 만든 게 나중에 부채가 된다.
# ─────────────────────────────────────────────────────────────

MAX_BYTES = int(os.environ.get("BYR_AUDIT_MAX_BYTES", 5 * 1024 * 1024))   # 5MB
KEEP_ROTATIONS = int(os.environ.get("BYR_AUDIT_KEEP", 6))                  # 약 30MB 보관

def rotate_if_needed() -> str | None:
    """파일이 한도를 넘으면 audit.1.jsonl … 로 밀어내고 새 파일을 연다.
    오래된 것부터 지운다 — 감사 기록이므로 '삭제'가 아니라 '한도 내 보관'이다."""
    try:
        if not os.path.exists(AUDIT_FILE) or os.path.getsize(AUDIT_FILE) < MAX_BYTES:
            return None
        base, ext = os.path.splitext(AUDIT_FILE)
        oldest = f"{base}.{KEEP_ROTATIONS}{ext}"
        if os.path.exists(oldest):
            os.remove(oldest)
        for i in range(KEEP_ROTATIONS - 1, 0, -1):
            src, dst = f"{base}.{i}{ext}", f"{base}.{i+1}{ext}"
            if os.path.exists(src):
                os.replace(src, dst)
        os.replace(AUDIT_FILE, f"{base}.1{ext}")
        return f"{base}.1{ext}"
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────
# 에이전트별 활동 이력 — 화면의 MOCK 대화 로그를 실제 감사 기록으로 대체.
#
# 감사 이벤트는 에이전트를 세 방식으로 가리킨다:
#   1) target == agent_id            (HIRE·DEPLOY·MODEL_CALL·KB_READ·UPDATE…)
#   2) detail 안에 "agent=<id>"       (메신저 액션 STAGE·COMMIT·EXTERNAL_ACTION…)
#   3) target == stage_id, 그 stage 소유자가 이 에이전트 (staging.json)
# 셋을 합쳐야 "이 에이전트가 실제로 한 일"이 온전히 잡힌다.
# ─────────────────────────────────────────────────────────────

def _stage_owner_map():
    """staging.json 의 stage_id → agent_id. 없으면 빈 dict."""
    f = os.path.join(os.path.dirname(AUDIT_FILE), "staging.json")
    try:
        with open(f, encoding="utf-8") as fp:
            data = json.load(fp)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    items = data if isinstance(data, list) else data.get("items") or data.get("stages") or []
    return {it.get("stage_id"): it.get("agent_id") for it in items if it.get("stage_id")}


def agent_activity(agent_id: str, limit: int = 50) -> list[dict]:
    if not agent_id or not os.path.exists(AUDIT_FILE):
        return []
    owner = _stage_owner_map()
    marker = f"agent={agent_id}"
    out = []
    with open(AUDIT_FILE, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            tgt = e.get("target", "")
            det = e.get("detail", "")
            hit = (tgt == agent_id) or (marker in det) or (owner.get(tgt) == agent_id)
            if hit:
                out.append(e)
    return list(reversed(out))[:limit]
