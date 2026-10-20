"""관리자가 승인한 콘솔 계정 — 이메일 로그인과 소셜 로그인 모두 이 목록으로 들여보낸다.

- 비밀번호는 원문을 두지 않고 PBKDF2-SHA256(솔트 16바이트, 20만 회) 해시만 둔다.
  확인은 서버에서만 한다(브라우저 코드에는 비밀번호도 해시도 내려가지 않는다).
- 목록에 없는 계정은 형식이 맞아도 '관리자가 승인한 계정이 아님'으로 돌려보낸다.
- 소셜 로그인(Google·네이버·카카오)은 공급자가 확인해 준 이메일이 목록(또는 BYR_APPROVED_EMAILS)에 있을 때만 통과한다.
"""
from __future__ import annotations
import hashlib
import hmac
import os

_ITER = 200_000
def _admin_account() -> dict:
    """데모 관리자 계정. 공개 저장소에는 해시를 두지 않고 배포 환경 변수에서 읽는다.

    BYR_ADMIN_EMAIL · BYR_ADMIN_SALT(hex) · BYR_ADMIN_HASH(hex) 가 모두 있어야 이메일 로그인이 열린다.
    없으면 이메일 로그인은 막히고, /demo 경로의 데모 보기는 그대로 동작한다.
    """
    email = os.environ.get("BYR_ADMIN_EMAIL", "").strip().lower()
    salt = os.environ.get("BYR_ADMIN_SALT", "").strip()
    hsh = os.environ.get("BYR_ADMIN_HASH", "").strip()
    if not (email and salt and hsh):
        return {}
    return {email: {"name": os.environ.get("BYR_ADMIN_NAME", "데모 관리자"), "salt": salt, "hash": hsh}}


APPROVED = _admin_account()


def _extra_emails() -> set:
    """소셜 로그인으로 들일 실제 계정 이메일 — Render 환경 변수 BYR_APPROVED_EMAILS(쉼표 구분)에만 둔다."""
    return {e.strip().lower() for e in os.environ.get("BYR_APPROVED_EMAILS", "").split(",") if e.strip()}


def is_approved_email(email: str) -> bool:
    e = (email or "").strip().lower()
    return bool(e) and (e in APPROVED or e in _extra_emails())


def verify(email: str, password: str) -> dict | None:
    """승인 계정이고 비밀번호가 맞으면 프로필, 아니면 None(어느 쪽이 틀렸는지는 알려주지 않는다)."""
    acc = APPROVED.get((email or "").strip().lower())
    if not acc:
        hashlib.pbkdf2_hmac("sha256", (password or "").encode(), b"0" * 16, _ITER)  # 응답 시간을 맞춘다
        return None
    got = hashlib.pbkdf2_hmac("sha256", (password or "").encode(), bytes.fromhex(acc["salt"]), _ITER).hex()
    if not hmac.compare_digest(got, acc["hash"]):
        return None
    e = (email or "").strip().lower()
    return {"provider": "email", "id": e, "name": acc["name"], "email": e}
