"""
이메일 발송 — 여러 provider SMTP 지원(Gmail·Outlook·네이버·다음·기타).

자격증명은 저장소가 아니라 로컬 보안 파일(~/.hermes/byr_connectors.json, 600)에 보관.
콘솔에서 'provider + 이메일 + 비밀번호'를 연결하면 SMTP 로그인으로 검증 후 저장한다.
자격증명이 없으면 발송하지 않고 안내를 돌려준다(데모 비차단).
개발용 .env 폴백(BYR_SMTP_USER/PASS/HOST/PORT/SECURE)도 지원.
"""
import os
import json
import smtplib
from email.message import EmailMessage
from pathlib import Path

CONNECTOR_FILE = Path.home() / ".hermes" / "byr_connectors.json"

# provider별 SMTP 기본값
PROVIDERS: dict[str, dict] = {
    "gmail":   {"label": "Gmail",             "host": "smtp.gmail.com",         "port": 465, "secure": "ssl",
                "note": "2단계 인증 후 앱 비밀번호(16자)를 발급해 입력하세요.",
                "help": "https://myaccount.google.com/apppasswords"},
    "outlook": {"label": "Outlook / Office365", "host": "smtp-mail.outlook.com", "port": 587, "secure": "starttls",
                "note": "계정 비밀번호(또는 앱 비밀번호)를 입력하세요.", "help": ""},
    "naver":   {"label": "네이버",             "host": "smtp.naver.com",         "port": 465, "secure": "ssl",
                "note": "메일함 설정에서 IMAP/SMTP 사용을 켠 뒤 계정 비밀번호를 입력하세요.", "help": ""},
    "daum":    {"label": "다음 / 카카오메일",   "host": "smtp.daum.net",          "port": 465, "secure": "ssl",
                "note": "메일 환경설정에서 IMAP/SMTP를 켠 뒤 계정 비밀번호를 입력하세요.", "help": ""},
    "custom":  {"label": "기타(직접 입력)",     "host": None,                     "port": None, "secure": None,
                "note": "SMTP 서버 주소와 포트를 직접 입력하세요(465=SSL, 587=STARTTLS).", "help": ""},
}


def providers_public() -> list[dict]:
    """UI용 provider 목록(비밀 없음). oauth_ready = 실제 OAuth 로그인 가능 여부."""
    from . import google_oauth
    oauth_ready = {"gmail": google_oauth.configured()}
    return [{"key": k, "label": v["label"], "note": v["note"], "help": v["help"],
             "needs_server": k == "custom",
             "oauth": k in ("gmail", "outlook"),
             "oauth_ready": oauth_ready.get(k, False)} for k, v in PROVIDERS.items()]


def connect_oauth(provider: str, email: str, refresh_token: str | None) -> dict:
    """OAuth 연결 결과 저장(refresh_token). 비밀번호 없이 발송."""
    if not (email and refresh_token):
        return {"ok": False, "message": "OAuth 토큰을 받지 못했습니다(재동의 필요)."}
    data = _load_connectors()
    data["email"] = {"provider": provider, "auth": "oauth", "user": email, "refresh_token": refresh_token}
    _save_connectors(data)
    return {"ok": True, "address": email, "provider": provider}


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


def _load_connectors() -> dict:
    if CONNECTOR_FILE.exists():
        try:
            return json.loads(CONNECTOR_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_connectors(data: dict) -> None:
    CONNECTOR_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONNECTOR_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    try:
        os.chmod(CONNECTOR_FILE, 0o600)
    except Exception:
        pass


def _config() -> dict | None:
    """저장된 이메일 설정({provider,host,port,secure,user,pass}) 또는 .env 폴백."""
    email = _load_connectors().get("email") or {}
    # OAuth 연결(비밀번호 없음, refresh_token 사용)
    if email.get("auth") == "oauth" and email.get("user") and email.get("refresh_token"):
        return email
    if email.get("user") and email.get("pass"):
        # 구버전 저장({user,pass}만)엔 서버 정보 보강
        if not email.get("host"):
            h, p, sec = _resolve(email.get("provider", "gmail"), None, None, None)
            email = {**email, "provider": email.get("provider", "gmail"), "host": h, "port": p, "secure": sec}
        return email
    # .env 폴백(개발용) — 기본 Gmail
    _load_hermes_env()
    user = os.environ.get("BYR_SMTP_USER") or os.environ.get("GMAIL_USER")
    pw = os.environ.get("BYR_SMTP_PASS") or os.environ.get("GMAIL_APP_PASSWORD")
    if user and pw:
        return {
            "provider": "gmail",
            "host": os.environ.get("BYR_SMTP_HOST", "smtp.gmail.com"),
            "port": int(os.environ.get("BYR_SMTP_PORT", "465")),
            "secure": os.environ.get("BYR_SMTP_SECURE", "ssl"),
            "user": user, "pass": pw.replace(" ", ""),
        }
    return None


def creds_present() -> bool:
    return _config() is not None


def connected_address() -> str | None:
    c = _config()
    return c.get("user") if c else None


def connected_provider() -> str | None:
    c = _config()
    return c.get("provider") if c else None


def _resolve(provider: str, host: str | None, port, secure: str | None) -> tuple[str, int, str]:
    p = PROVIDERS.get(provider, PROVIDERS["custom"])
    h = host or p["host"]
    pt = int(port or p["port"] or 0)
    sec = secure or p["secure"] or ("ssl" if pt == 465 else "starttls")
    return h, pt, sec


def _smtp(host: str, port: int, secure: str, user: str, pw: str, msg: EmailMessage | None = None) -> None:
    """로그인(+옵션 발송). 예외는 상위에서 처리."""
    pw = pw.replace(" ", "")
    if secure == "ssl":
        srv = smtplib.SMTP_SSL(host, port, timeout=25)
    else:
        srv = smtplib.SMTP(host, port, timeout=25)
        srv.ehlo(); srv.starttls(); srv.ehlo()
    try:
        srv.login(user, pw)
        if msg is not None:
            srv.send_message(msg)
    finally:
        try:
            srv.quit()
        except Exception:
            pass


def _friendly_error(e: Exception) -> str:
    if isinstance(e, smtplib.SMTPAuthenticationError):
        return "인증 실패 — 이메일/비밀번호(또는 앱 비밀번호)를 확인하세요. Gmail·네이버·다음은 SMTP 사용 설정이 필요합니다."
    return f"연결 실패: {type(e).__name__}"


def connect_email(payload: dict) -> dict:
    """콘솔에서 이메일 연결 — 검증 성공 시에만 저장. payload: {provider,address,password,host?,port?,secure?}."""
    provider = (payload.get("provider") or "gmail").strip()
    user = (payload.get("address") or "").strip()
    pw = (payload.get("password") or payload.get("app_password") or "").replace(" ", "")
    if not (user and pw):
        return {"ok": False, "message": "이메일 주소와 비밀번호를 모두 입력하세요."}
    host, port, secure = _resolve(provider, payload.get("host"), payload.get("port"), payload.get("secure"))
    if not (host and port):
        return {"ok": False, "message": "SMTP 서버 주소와 포트를 입력하세요."}
    try:
        _smtp(host, port, secure, user, pw)  # 로그인 검증
    except Exception as e:
        return {"ok": False, "message": _friendly_error(e)}
    data = _load_connectors()
    data["email"] = {"provider": provider, "host": host, "port": port, "secure": secure, "user": user, "pass": pw}
    _save_connectors(data)
    return {"ok": True, "address": user, "provider": provider}


def disconnect_email() -> None:
    data = _load_connectors()
    data.pop("email", None)
    _save_connectors(data)


def send(to: str, subject: str, body: str, attachment_path: str | None = None,
         attachment_name: str | None = None) -> dict:
    """이메일 발송. 자격증명 없으면 발송하지 않고 안내 반환."""
    if not (to or "").strip():
        return {"ok": False, "error": "no_recipient", "message": "받는사람 이메일이 없습니다."}
    c = _config()
    if not c:
        return {"ok": False, "error": "no_creds",
                "message": "이메일 계정이 연결되지 않아 발송 대기입니다. 콘솔에서 이메일을 연결하세요."}

    msg = EmailMessage()
    msg["From"] = c["user"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if attachment_path and Path(attachment_path).exists():
        data = Path(attachment_path).read_bytes()
        msg.add_attachment(data, maintype="application", subtype="pdf",
                           filename=attachment_name or Path(attachment_path).name)

    # OAuth 연결(Gmail) → Gmail API로 발송
    if c.get("auth") == "oauth":
        from . import google_oauth
        r = google_oauth.gmail_send(c.get("refresh_token", ""), msg)
        if r.get("ok"):
            return {"ok": True, "message": f"{to} 로 발송 완료", "from": c["user"]}
        return {"ok": False, "error": "send_failed", "message": r.get("message", "발송 실패")}

    # SMTP(앱 비밀번호) 발송
    try:
        _smtp(c["host"], int(c["port"]), c.get("secure", "ssl"), c["user"], c["pass"], msg)
        return {"ok": True, "message": f"{to} 로 발송 완료", "from": c["user"]}
    except Exception as e:
        return {"ok": False, "error": "send_failed", "message": _friendly_error(e)}
