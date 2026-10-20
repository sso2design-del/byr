"""
Google OAuth (Gmail 발송) — 실제 로그인·동의 플로우.

버튼 → Google 로그인/동의 팝업 → 콜백 → refresh_token 저장 → Gmail API로 발송.

앱 레벨 자격증명(사용자 비번 아님)은 ~/.hermes/.env 에서만 읽는다:
  GOOGLE_OAUTH_CLIENT_ID=...
  GOOGLE_OAUTH_CLIENT_SECRET=...
  (선택) BYR_OAUTH_REDIRECT=http://localhost:8000/api/oauth/google/callback

Google Cloud 준비(소이님, 1회):
  1) console.cloud.google.com → 프로젝트 생성
  2) 'Gmail API' 사용 설정(Enable)
  3) OAuth 동의 화면: External, 게시 상태 'Testing', 테스트 사용자에 본인 Gmail 추가
  4) 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)
     - 승인된 리디렉션 URI: http://localhost:8000/api/oauth/google/callback
  5) 발급된 클라이언트 ID/시크릿을 ~/.hermes/.env 에 위 이름으로 저장
"""
import os
import json
import base64
import urllib.parse
import urllib.request
from pathlib import Path
from email.message import EmailMessage

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
SCOPES = "openid email https://www.googleapis.com/auth/gmail.send"


def _load_env() -> None:
    env = Path.home() / ".hermes" / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _client() -> tuple[str | None, str | None, str]:
    _load_env()
    cid = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    sec = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    redirect = os.environ.get("BYR_OAUTH_REDIRECT", "http://localhost:8000/api/oauth/google/callback")
    return cid, sec, redirect


def configured() -> bool:
    cid, sec, _ = _client()
    return bool(cid and sec)


def authorize_url(state: str) -> str | None:
    cid, _, redirect = _client()
    if not cid:
        return None
    q = urllib.parse.urlencode({
        "client_id": cid,
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",       # refresh_token 발급
        "prompt": "consent",            # 매번 동의 → refresh_token 보장
        "include_granted_scopes": "true",
        "state": state,
    })
    return f"{AUTH_URL}?{q}"


def _post_form(url: str, data: dict) -> dict:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"content-type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def exchange_code(code: str) -> dict:
    """code → {ok, email, refresh_token} 또는 {ok:False, message}."""
    cid, sec, redirect = _client()
    if not (cid and sec):
        return {"ok": False, "message": "Google OAuth 클라이언트가 설정되지 않았습니다."}
    try:
        tok = _post_form(TOKEN_URL, {
            "code": code, "client_id": cid, "client_secret": sec,
            "redirect_uri": redirect, "grant_type": "authorization_code",
        })
    except Exception as e:
        return {"ok": False, "message": f"토큰 교환 실패: {type(e).__name__}"}
    access = tok.get("access_token")
    refresh = tok.get("refresh_token")
    if not access:
        return {"ok": False, "message": "액세스 토큰을 받지 못했습니다."}
    email = _email_from(access, tok.get("id_token"))
    if not email:
        return {"ok": False, "message": "계정 이메일을 확인하지 못했습니다."}
    return {"ok": True, "email": email, "refresh_token": refresh, "access_token": access}


def _email_from(access_token: str, id_token: str | None) -> str | None:
    # userinfo 우선, 실패 시 id_token 페이로드
    try:
        req = urllib.request.Request(USERINFO_URL, headers={"authorization": f"Bearer {access_token}"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode()).get("email")
    except Exception:
        pass
    if id_token and id_token.count(".") == 2:
        try:
            payload = id_token.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            return json.loads(base64.urlsafe_b64decode(payload)).get("email")
        except Exception:
            pass
    return None


def access_token(refresh_token: str) -> str | None:
    cid, sec, _ = _client()
    if not (cid and sec and refresh_token):
        return None
    try:
        tok = _post_form(TOKEN_URL, {
            "client_id": cid, "client_secret": sec,
            "refresh_token": refresh_token, "grant_type": "refresh_token",
        })
        return tok.get("access_token")
    except Exception:
        return None


def gmail_send(refresh_token: str, msg: EmailMessage) -> dict:
    """Gmail API로 발송(refresh_token → access_token)."""
    at = access_token(refresh_token)
    if not at:
        return {"ok": False, "message": "액세스 토큰 갱신 실패 — 재연결이 필요합니다."}
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    req = urllib.request.Request(
        GMAIL_SEND_URL, data=json.dumps({"raw": raw}).encode(), method="POST",
        headers={"authorization": f"Bearer {at}", "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.loads(r.read().decode())
        return {"ok": True}
    except urllib.error.HTTPError as e:
        return {"ok": False, "message": f"Gmail 발송 실패: {e.code}"}
    except Exception as e:
        return {"ok": False, "message": f"Gmail 발송 실패: {type(e).__name__}"}
