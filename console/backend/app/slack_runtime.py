"""메신저 봇 상시 실행 — 웹 서버(FastAPI)와 같은 프로세스에서 Slack Socket Mode를 켠다.

배경: slack_bot.py는 로컬에서 `python slack_bot.py`로만 돌아서, 배포 환경에서는
채널에서 말을 걸어도 봇이 대답하지 않았다. Render 무료 플랜은 백그라운드 워커가
없으므로 웹 서비스 안에서 소켓 연결을 띄운다.

- 켜지는 조건: 봇 토큰(BYR_SLACK_BOT_TOKEN)과 앱 토큰(BYR_SLACK_APP_TOKEN, xapp-) 둘 다 있을 때.
- 무료 플랜은 15분간 들어오는 요청이 없으면 잠든다(소켓도 끊김) → 봇이 켜져 있을 때만
  10분마다 자기 공개 주소(RENDER_EXTERNAL_URL)의 /api/meta를 불러 깨어 있게 한다.
- 같은 앱 토큰으로 로컬에서도 slack_bot.py를 켜면 이벤트가 둘로 나뉜다 → 한 곳에서만 켠다.
"""
import os
import threading
import time
import urllib.request

STATE = {"socket": "disabled", "error": None, "keepalive": False}


def _keepalive(url: str) -> None:
    while True:
        time.sleep(600)
        try:
            urllib.request.urlopen(url.rstrip("/") + "/api/meta", timeout=20).read()
        except Exception:
            pass


def start() -> None:
    bot = os.environ.get("BYR_SLACK_BOT_TOKEN") or os.environ.get("SLACK_BOT_TOKEN")
    app_token = os.environ.get("BYR_SLACK_APP_TOKEN") or os.environ.get("SLACK_APP_TOKEN")
    if not (bot and app_token):
        STATE.update(socket="disabled", error="no_app_token" if bot else "no_token")
        return

    def run():
        try:
            import slack_bot  # 앱(App)과 이벤트 핸들러를 등록만 한다(__main__ 아님)
            from slack_bolt.adapter.socket_mode import SocketModeHandler
            SocketModeHandler(slack_bot.app, slack_bot.APP_TOKEN).connect()
            STATE.update(socket="connected", error=None)
        except BaseException as e:  # slack_bot 임포트의 SystemExit까지 잡는다
            STATE.update(socket="error", error=f"{type(e).__name__}: {e}"[:200])

    threading.Thread(target=run, name="slack-socket", daemon=True).start()
    url = os.environ.get("RENDER_EXTERNAL_URL")
    if url:
        threading.Thread(target=_keepalive, args=(url,), name="keepalive", daemon=True).start()
        STATE["keepalive"] = True
