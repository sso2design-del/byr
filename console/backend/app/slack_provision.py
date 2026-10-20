"""
Slack 실채널 프로비저닝 — 배치 시 실제 Slack 채널 생성 + 봇 참여 + topic 설정.

필요 스코프(봇): channels:manage(공개 생성/초대/topic) · groups:write(비공개)
토큰은 저장소가 아니라 ~/.hermes/.env 의 SLACK_BOT_TOKEN 에서만 읽는다(기밀 규칙).
스코프가 없으면 Slack이 missing_scope 오류를 반환 → 그대로 상위에 전달(사용자 안내).
"""
import os
import re
from pathlib import Path


def _env_all() -> dict:
    vals = {}
    env = Path.home() / ".hermes" / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def _bot_token():
    # Byr 전용 앱 토큰(BYR_SLACK_BOT_TOKEN) 우선, 없으면 SLACK_BOT_TOKEN 폴백
    vals = _env_all()
    return (
        vals.get("BYR_SLACK_BOT_TOKEN")
        or os.environ.get("BYR_SLACK_BOT_TOKEN")
        or vals.get("SLACK_BOT_TOKEN")
        or os.environ.get("SLACK_BOT_TOKEN")
    )


def _invite_users(client, channel_id: str) -> None:
    """배치한 사용자(콘솔 사용자)를 채널에 초대해 사이드바에 보이게 한다.
    대상 = BYR_SLACK_INVITE_USERS 우선, 없으면 SLACK_ALLOWED_USERS(쉼표 구분 user id)."""
    from slack_sdk.errors import SlackApiError
    vals = _env_all()
    raw = (
        vals.get("BYR_SLACK_INVITE_USERS")
        or os.environ.get("BYR_SLACK_INVITE_USERS")
        or vals.get("SLACK_ALLOWED_USERS")
        or os.environ.get("SLACK_ALLOWED_USERS", "")
    )
    ids = [u.strip() for u in raw.split(",") if u.strip()]
    if not ids:
        return
    try:
        client.conversations_invite(channel=channel_id, users=",".join(ids))
    except SlackApiError:
        pass  # already_in_channel 등은 무시


def _slugify(name: str) -> str:
    # Slack 채널명 규칙: 소문자·공백 불가·최대 80. 한글은 허용됨.
    s = name.lstrip("#").strip().lower()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9가-힣\-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80] or "봇"


# 마지막 채널 조회에서 난 Slack 오류 코드(missing_scope 등) — '못 찾음'과 구분해 알려 주려고 둔다
_last_lookup_error: str | None = None


def _find_channel_any(client, name: str):
    """이름이 일치하는 채널을 찾는다(아카이브 포함)."""
    global _last_lookup_error
    from slack_sdk.errors import SlackApiError
    _last_lookup_error = None
    cursor = None
    try:
        while True:
            r = client.conversations_list(
                limit=200, cursor=cursor,
                types="public_channel,private_channel", exclude_archived=False,
            )
            for ch in r["channels"]:
                if ch["name"] == name:
                    return ch
            cursor = r.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                return None
    except SlackApiError as e:
        _last_lookup_error = e.response.get("error", "unknown")
        return None


def ensure_channel(name: str, topic: str | None = None) -> dict:
    """기존 채널에 배치할 때 봇 참여 + 사용자 초대를 보장한다.
    ‘기존 채널 선택’ 경로는 채널을 새로 만들지 않으므로, 봇이 그 채널 멤버가 아니면
    메시지에 응답할 수 없다 → 여기서 join + invite 로 라우팅이 실제 동작하게 만든다.
    최선노력(best-effort): 실패해도 배치 자체는 막지 않는다(상위에서 무시)."""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "no_token"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"ok": False, "error": "no_sdk"}
    client = WebClient(token=token)
    clean = _slugify(name)
    ch = _find_channel_any(client, clean)
    if not ch:
        return {"ok": False, "error": "not_found"}
    if ch.get("is_archived"):
        try:
            client.conversations_unarchive(channel=ch["id"])
        except SlackApiError:
            pass
    if not ch.get("is_member"):
        try:
            client.conversations_join(channel=ch["id"])
        except SlackApiError:
            pass
    if topic:
        try:
            client.conversations_setTopic(channel=ch["id"], topic=topic)
        except SlackApiError:
            pass
    _invite_users(client, ch["id"])
    return {"ok": True, "channel_id": ch["id"], "channel_name": ch["name"]}


def archive_channel(name: str) -> dict:
    """에이전트/팀 삭제 시 전용 채널을 아카이브해 잔존(orphan)을 방지한다.
    삭제(불가·위험)가 아니라 아카이브 → Slack 히스토리는 보존, 활성 목록에선 사라진다.
    최선노력: 실패는 무시(삭제 흐름을 막지 않는다)."""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "no_token"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"ok": False, "error": "no_sdk"}
    client = WebClient(token=token)
    ch = _find_channel_any(client, _slugify(name))
    if not ch or ch.get("is_archived"):
        return {"ok": True, "skipped": True}
    try:
        client.conversations_archive(channel=ch["id"])
        return {"ok": True, "channel_id": ch["id"]}
    except SlackApiError as e:
        return {"ok": False, "error": e.response.get("error", "unknown")}


def notify_channel(channel: str, text: str) -> dict:
    """배치된 채널에 메시지를 보낸다(제안서 초안 대기·승인 통보 등). 최선노력."""
    token = _bot_token()
    if not token or not channel:
        return {"ok": False, "error": "no_token_or_channel"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"ok": False, "error": "no_sdk"}
    client = WebClient(token=token)
    ch = _find_channel_any(client, _slugify(channel))
    if not ch:
        return {"ok": False, "error": _last_lookup_error or "not_found"}
    if not ch.get("is_member"):
        try:
            client.conversations_join(channel=ch["id"])
        except SlackApiError:
            pass
    try:
        client.chat_postMessage(channel=ch["id"], text=text)
        return {"ok": True, "channel_id": ch["id"]}
    except SlackApiError as e:
        return {"ok": False, "error": e.response.get("error", "unknown")}


def create_channel(name: str, private: bool = False, topic: str | None = None) -> dict:
    """실제 Slack 채널 생성. 성공 시 {ok, channel_id, channel_name}, 실패 시 {ok:False, error}."""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "no_token", "message": "SLACK_BOT_TOKEN 없음(~/.hermes/.env)"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"ok": False, "error": "no_sdk", "message": "slack_sdk 미설치"}

    client = WebClient(token=token)
    clean = _slugify(name)
    try:
        res = client.conversations_create(name=clean, is_private=private)
        ch = res["channel"]
        # 봇은 생성자라 자동 멤버. topic만 추가 설정.
        if topic:
            try:
                client.conversations_setTopic(channel=ch["id"], topic=topic)
            except SlackApiError:
                pass
        _invite_users(client, ch["id"])
        return {"ok": True, "channel_id": ch["id"], "channel_name": ch["name"]}
    except SlackApiError as e:
        err = e.response.get("error", "unknown")
        # 멱등: 같은 이름 채널이 이미 있으면 그 채널을 그대로 사용해 배치(아카이브면 복구)
        if err == "name_taken":
            existing = _find_channel_any(client, clean)
            if existing:
                if existing.get("is_archived"):
                    try:
                        client.conversations_unarchive(channel=existing["id"])
                    except SlackApiError:
                        pass
                if not existing.get("is_member"):
                    try:
                        client.conversations_join(channel=existing["id"])
                    except SlackApiError:
                        pass
                if topic:
                    try:
                        client.conversations_setTopic(channel=existing["id"], topic=topic)
                    except SlackApiError:
                        pass
                _invite_users(client, existing["id"])
                return {"ok": True, "channel_id": existing["id"], "channel_name": existing["name"], "existed": True}
        friendly = {
            "name_taken": "이미 같은 이름의 채널이 있어요. 다른 이름을 쓰거나 ‘기존 채널 선택’을 이용하세요.",
            "missing_scope": "채널 생성 권한이 없어요. Slack 앱에 channels:manage·groups:write 스코프를 추가하세요.",
            "invalid_name": "채널 이름이 유효하지 않아요(소문자·공백 없이).",
            "invalid_name_specials": "채널 이름에 쓸 수 없는 문자가 있어요.",
            "restricted_action": "이 워크스페이스에서 채널 생성이 제한돼 있어요(관리자 정책). ‘기존 채널 선택’을 이용하세요.",
        }
        return {"ok": False, "error": err, "message": friendly.get(err, f"Slack 오류: {err}")}


# 콘솔 배치에 필요한 봇 스코프(채널 찾기·참여·생성·초대·메시지)
REQUIRED_SCOPES = ("chat:write", "channels:read", "groups:read", "channels:join", "channels:manage", "groups:write")


def diagnose() -> dict:
    """Slack 연결 상태 점검 — 토큰 값은 돌려주지 않는다.
    반환: token(bool) · ok · team · bot · scopes · missing_scopes · error"""
    token = _bot_token()
    if not token:
        return {"token": False, "ok": False, "error": "no_token"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"token": True, "ok": False, "error": "no_sdk"}
    client = WebClient(token=token)
    try:
        r = client.auth_test()
    except SlackApiError as e:
        return {"token": True, "ok": False, "error": e.response.get("error", "unknown")}
    scopes = [x.strip() for x in (r.headers.get("x-oauth-scopes") or "").split(",") if x.strip()]
    return {
        "token": True, "ok": True,
        "team": r.get("team"), "bot": r.get("user"),
        "scopes": scopes,
        "missing_scopes": [x for x in REQUIRED_SCOPES if x not in scopes],
    }


def list_channels() -> dict:
    """배치용 채널 목록 — 보관되지 않은 공개 채널 + 봇이 들어가 있는 비공개 채널.
    반환: {ok, channels:[{name, private, member}]} | {ok: False, error}"""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "no_token_or_channel"}
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
    except ImportError:
        return {"ok": False, "error": "no_sdk"}
    client = WebClient(token=token)
    out, cursor = [], None
    try:
        while True:
            r = client.conversations_list(limit=200, cursor=cursor,
                                          types="public_channel,private_channel", exclude_archived=True)
            for ch in r["channels"]:
                out.append({"name": ch["name"], "private": bool(ch.get("is_private")),
                            "member": bool(ch.get("is_member"))})
            cursor = r.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
    except SlackApiError as e:
        return {"ok": False, "error": e.response.get("error", "unknown")}
    out.sort(key=lambda c: c["name"])
    return {"ok": True, "channels": out}
