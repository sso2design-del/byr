"""네이버·카카오 소셜 로그인 — OAuth 2.0 인가 코드 방식.

문서
- 네이버 로그인 개발가이드 3.4: https://developers.naver.com/docs/login/devguide/devguide.md
  인가  GET https://nid.naver.com/oauth2.0/authorize   (response_type=code, client_id, redirect_uri, state — 모두 필수)
  토큰  GET https://nid.naver.com/oauth2.0/token       (grant_type=authorization_code, client_id, client_secret, code, state)
  프로필 GET https://openapi.naver.com/v1/nid/me       (Authorization: Bearer) → {resultcode, message, response:{id, name, email, ...}}
- 카카오 로그인 REST API: https://developers.kakao.com/docs/ko/kakaologin/rest-api
  인가  GET  https://kauth.kakao.com/oauth/authorize   (client_id=REST API 키, redirect_uri, response_type=code, state)
  토큰  POST https://kauth.kakao.com/oauth/token       (form: grant_type, client_id, redirect_uri, code, client_secret)
  사용자 GET  https://kapi.kakao.com/v2/user/me        (Authorization: Bearer) → {id, kakao_account:{email, profile:{nickname, ...}}}

흐름: /api/auth/{provider}/start → 공급자 로그인·동의 화면 → /api/auth/{provider}/callback
      → 서버에서 code를 토큰으로 바꾸고(클라이언트 시크릿은 서버에만 둔다) 프로필 조회
      → 콘솔 /auth/callback#… 으로 돌려보낸다(프로필은 URL 조각에 실어 서버 로그·Referer에 남지 않게).
state 는 요청마다 새로 만들고 HttpOnly 쿠키에 담아 콜백에서 대조한다(CSRF 방지).
회원 식별은 공급자의 고유 ID(네이버 id, 카카오 회원번호)로 한다 — 이메일은 바뀔 수 있다(카카오 문서 권고).

환경변수(Render 대시보드에서 넣는다. 코드·저장소에는 두지 않는다)
  NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
  KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET
  GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET   (Google Cloud > 사용자 인증 정보 > OAuth 클라이언트 ID, 웹 애플리케이션)
- Google 로그인(OpenID Connect): https://developers.google.com/identity/openid-connect/openid-connect
  인가  GET  https://accounts.google.com/o/oauth2/v2/auth  (scope=openid email profile, state)
  토큰  POST https://oauth2.googleapis.com/token
  사용자 GET  https://openidconnect.googleapis.com/v1/userinfo → {sub, email, email_verified, name, picture}
  로그인 정보 입력은 Google 페이지에서만 한다(우리 화면에서 Google 아이디·비밀번호를 받지 않는다 — OAuth 2.0 정책).
  BYR_PUBLIC_URL   콘솔 주소(기본 https://byr-console.vercel.app). 콜백 = {BYR_PUBLIC_URL}/api/auth/{provider}/callback
"""
from __future__ import annotations

import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse, RedirectResponse

from . import account_approval

router = APIRouter()

STATE_COOKIE = "byr_oauth_state"
TIMEOUT = 10


def _public_url() -> str:
    return os.getenv("BYR_PUBLIC_URL", "https://byr-console.vercel.app").rstrip("/")


def _redirect_uri(provider: str) -> str:
    return f"{_public_url()}/api/auth/{provider}/callback"


def _conf(provider: str) -> tuple[str, str] | None:
    if provider == "naver":
        cid, sec = os.getenv("NAVER_CLIENT_ID"), os.getenv("NAVER_CLIENT_SECRET")
    elif provider == "kakao":
        cid, sec = os.getenv("KAKAO_REST_API_KEY"), os.getenv("KAKAO_CLIENT_SECRET")
    elif provider == "google":
        cid, sec = os.getenv("GOOGLE_LOGIN_CLIENT_ID"), os.getenv("GOOGLE_LOGIN_CLIENT_SECRET")
    else:
        return None
    return (cid, sec) if cid and sec else None


def _http_json(url: str, *, data: dict | None = None, headers: dict | None = None) -> dict:
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers or {}, method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"error": f"http_{e.code}"}
    except Exception as e:  # 네트워크 오류·시간 초과
        return {"error": "network", "error_description": str(e)[:200]}


def _back_to_login(reason: str) -> RedirectResponse:
    resp = RedirectResponse(f"{_public_url()}/login?oauth_error={urllib.parse.quote(reason)}", status_code=302)
    resp.delete_cookie(STATE_COOKIE, path="/api/auth")
    return resp


@router.get("/api/auth/providers")
def providers():
    """프런트가 실제 연동으로 보낼지 정할 때 쓴다(키 값은 내보내지 않는다)."""
    return {p: _conf(p) is not None for p in ("google", "naver", "kakao")}


@router.get("/api/auth/{provider}/start")
def start(provider: str):
    conf = _conf(provider)
    if not conf:
        return JSONResponse({"error": "not_configured", "provider": provider}, status_code=400)
    cid, _ = conf
    state = secrets.token_urlsafe(24)
    q = {"response_type": "code", "client_id": cid, "redirect_uri": _redirect_uri(provider), "state": state}
    if provider == "google":
        q.update(scope="openid email profile", prompt="select_account")
    base = {"naver": "https://nid.naver.com/oauth2.0/authorize",
            "kakao": "https://kauth.kakao.com/oauth/authorize",
            "google": "https://accounts.google.com/o/oauth2/v2/auth"}[provider]
    resp = RedirectResponse(f"{base}?{urllib.parse.urlencode(q)}", status_code=302)
    resp.set_cookie(STATE_COOKIE, f"{provider}:{state}", max_age=600, httponly=True,
                    secure=_public_url().startswith("https"), samesite="lax", path="/api/auth")
    return resp


@router.get("/api/auth/{provider}/callback")
def callback(provider: str, request: Request, code: str = "", state: str = "", error: str = "", error_description: str = ""):
    conf = _conf(provider)
    if not conf:
        return _back_to_login("not_configured")
    if error:
        # 사용자가 동의를 취소하면 카카오 access_denied, 네이버도 error 로 돌아온다
        return _back_to_login("cancelled" if error in ("access_denied", "user_cancel") else error)
    expected = request.cookies.get(STATE_COOKIE, "")
    if not code or not state or expected != f"{provider}:{state}":
        return _back_to_login("state_mismatch")

    cid, sec = conf
    if provider == "naver":
        tok = _http_json("https://nid.naver.com/oauth2.0/token?" + urllib.parse.urlencode({
            "grant_type": "authorization_code", "client_id": cid, "client_secret": sec, "code": code, "state": state}))
    elif provider == "google":
        tok = _http_json("https://oauth2.googleapis.com/token", data={
            "grant_type": "authorization_code", "client_id": cid, "client_secret": sec,
            "redirect_uri": _redirect_uri(provider), "code": code},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
    else:
        tok = _http_json("https://kauth.kakao.com/oauth/token", data={
            "grant_type": "authorization_code", "client_id": cid, "redirect_uri": _redirect_uri(provider),
            "code": code, "client_secret": sec},
            headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"})
    access = tok.get("access_token")
    if not access:
        return _back_to_login("token")

    auth = {"Authorization": f"Bearer {access}"}
    if provider == "naver":
        me = _http_json("https://openapi.naver.com/v1/nid/me", headers=auth)
        r = me.get("response") or {}
        if me.get("resultcode") != "00" or not r.get("id"):
            return _back_to_login("profile")
        user = {"provider": "naver", "id": r["id"], "name": r.get("name") or r.get("nickname") or "",
                "email": r.get("email") or "", "image": r.get("profile_image") or ""}
    elif provider == "google":
        me = _http_json("https://openidconnect.googleapis.com/v1/userinfo", headers=auth)
        if not me.get("sub"):
            return _back_to_login("profile")
        if not me.get("email_verified"):   # Google이 확인한 이메일만 승인 목록과 대조한다
            return _back_to_login("not_approved")
        user = {"provider": "google", "id": me["sub"], "name": me.get("name") or "",
                "email": me.get("email") or "", "image": me.get("picture") or ""}
    else:
        me = _http_json("https://kapi.kakao.com/v2/user/me", headers=auth)
        if not me.get("id"):
            return _back_to_login("profile")
        acc = me.get("kakao_account") or {}
        prof = acc.get("profile") or {}
        if not (acc.get("is_email_valid") and acc.get("is_email_verified")):   # 유효·인증된 이메일만 승인 목록과 대조
            return _back_to_login("not_approved")
        user = {"provider": "kakao", "id": str(me["id"]), "name": prof.get("nickname") or "",
                "email": acc.get("email") or "", "image": prof.get("profile_image_url") or ""}

    # 관리자가 승인한 계정(이메일)만 들여보낸다 — 이메일 로그인과 같은 기준
    if not account_approval.is_approved_email(user.get("email", "")):
        return _back_to_login("not_approved")
    frag = urllib.parse.urlencode({k: v for k, v in user.items()})
    resp = RedirectResponse(f"{_public_url()}/auth/callback#{frag}", status_code=302)
    resp.delete_cookie(STATE_COOKIE, path="/api/auth")
    return resp


@router.post("/api/auth/login")
def email_login(payload: dict = Body(...)):
    """이메일 로그인 — 관리자가 승인한 계정만 통과. 틀린 이유(이메일/비밀번호)는 구분해 알리지 않는다."""
    prof = account_approval.verify(str(payload.get("email", "")), str(payload.get("password", "")))
    if not prof:
        return JSONResponse({"ok": False, "reason": "not_approved"}, status_code=401)
    return {"ok": True, "profile": prof}


@router.api_route("/api/auth/kakao/unlink", methods=["GET", "POST"])
async def kakao_unlink(request: Request):
    """카카오 연결 해제 웹훅 — 사용자가 카카오에서 앱 연결을 끊으면 호출된다.
    이 콘솔은 소셜 회원 정보를 서버에 저장하지 않는다(로그인 프로필은 방문자 브라우저에만 있다).
    그래서 지울 데이터는 없고, 요청을 확인해 200으로 응답만 한다.
    KAKAO_ADMIN_KEY가 있으면 카카오가 보내는 'Authorization: KakaoAK {어드민 키}'를 대조한다."""
    admin = os.getenv("KAKAO_ADMIN_KEY")
    if admin and request.headers.get("authorization", "") != f"KakaoAK {admin}":
        return JSONResponse({"ok": False}, status_code=401)
    return {"ok": True}
