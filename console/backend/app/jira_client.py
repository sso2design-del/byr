"""Jira 실 커넥터 — 승인된 스펙의 티켓을 실제 Jira에 생성.

자격증명(기밀): ~/.hermes/.env 에서만 읽는다.
  JIRA_BASE_URL      = https://<사이트>.atlassian.net
  JIRA_EMAIL         = 아틀라시안 로그인 이메일
  JIRA_TOKEN         = API 토큰(id.atlassian.com/manage-profile/security/api-tokens)
  JIRA_PROJECT_KEY   = 티켓을 붙일 프로젝트 키(예: KAN)

configured()가 False면 호출측(action_connectors.create_ticket)이 스텁으로 폴백한다.
"""
import os
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path

# 기본 이슈타입 우선순위(한글/영문 사이트 모두 대응)
_PREFERRED_TYPES = ["작업", "Task", "기능", "Story", "스토리"]
_TYPE_CACHE: dict[str, str] = {}


def _load_hermes_env() -> None:
    env = Path.home() / ".hermes" / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _config() -> dict:
    _load_hermes_env()
    return {
        "base": os.getenv("JIRA_BASE_URL", "").rstrip("/"),
        "email": os.getenv("JIRA_EMAIL", ""),
        "token": os.getenv("JIRA_TOKEN", ""),
        "project": os.getenv("JIRA_PROJECT_KEY", ""),
    }


def configured() -> bool:
    c = _config()
    return all([c["base"], c["email"], c["token"], c["project"]])


def _api(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    c = _config()
    auth = base64.b64encode(f"{c['email']}:{c['token']}".encode()).decode()
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        c["base"] + path, data=data, method=method,
        headers={"Authorization": f"Basic {auth}",
                 "Content-Type": "application/json", "Accept": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def _issue_type(project: str) -> str:
    if project in _TYPE_CACHE:
        return _TYPE_CACHE[project]
    s, pj = _api("GET", f"/rest/api/3/project/{project}")
    names = [it["name"] for it in pj.get("issueTypes", [])] if s == 200 else []
    chosen = next((t for t in _PREFERRED_TYPES if t in names), (names[0] if names else "Task"))
    _TYPE_CACHE[project] = chosen
    return chosen


def create_issue(summary: str, itype: str | None = None) -> dict:
    """티켓 1건 생성. 성공 {ok, key, url}, 실패 {ok:False, error, message}."""
    c = _config()
    itype = itype or _issue_type(c["project"])
    body = {"fields": {"project": {"key": c["project"]},
                       "summary": summary[:250] or "무제",
                       "issuetype": {"name": itype}}}
    s, r = _api("POST", "/rest/api/3/issue", body)
    if s in (200, 201):
        return {"ok": True, "key": r["key"], "url": f"{c['base']}/browse/{r['key']}"}
    err = r.get("errors") or r.get("errorMessages") or f"HTTP {s}"
    code = "permission_denied" if s in (401, 403) else "connector_error"
    return {"ok": False, "error": code, "message": str(err)[:160]}
