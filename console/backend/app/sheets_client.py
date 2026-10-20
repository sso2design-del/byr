"""구글 시트 실 커넥터 — 승인된 산출물을 구글 스프레드시트에 append.

자격증명(기밀): ~/.hermes/.env 에서만 읽는다.
  GOOGLE_SHEETS_SA_JSON      = 서비스 계정 키 JSON 파일 경로
  BYR_SHEETS_SPREADSHEET_ID  = 대상 스프레드시트 ID (시트 URL /d/ 와 /edit 사이)
대상 시트는 서비스 계정 이메일(JSON의 client_email)에 '편집자'로 공유돼 있어야 한다.

configured()가 False면 호출측(action_connectors.update_sheet)이 스텁으로 폴백한다.
"""
import os
from pathlib import Path

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


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


def _config() -> tuple[str, str]:
    _load_hermes_env()
    return os.getenv("GOOGLE_SHEETS_SA_JSON", ""), os.getenv("BYR_SHEETS_SPREADSHEET_ID", "")


def configured() -> bool:
    key, sid = _config()
    return bool(key and sid and os.path.exists(key))


def _service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    key, _ = _config()
    creds = service_account.Credentials.from_service_account_file(key, scopes=_SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def append_rows(rows: list, tab: str | None = None) -> dict:
    """rows(2차원 배열)를 시트 끝에 추가. 성공 {ok, updated_range, title}, 실패 예외."""
    _, sid = _config()
    svc = _service()
    rng = f"{tab}!A1" if tab else "A1"
    meta = svc.spreadsheets().get(spreadsheetId=sid).execute()
    r = svc.spreadsheets().values().append(
        spreadsheetId=sid, range=rng, valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS", body={"values": rows},
    ).execute()
    return {"ok": True,
            "updated_range": r.get("updates", {}).get("updatedRange"),
            "title": meta.get("properties", {}).get("title")}
