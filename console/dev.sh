#!/usr/bin/env bash
#
# Byr 콘솔 프로토타입 — 어느 Mac에서든 한 방 실행/자가복구 스크립트
#
# 왜 필요한가:
#   백엔드 Python venv 는 생성한 Mac의 "절대경로"를 내부에 저장한다.
#   그래서 iCloud로 다른 Mac에 동기화되면 venv 의 python 링크가 깨지고,
#   백엔드(:8000)가 안 뜬다 → 프론트 콘텐츠가 "불러오기 중..."에서 멈춘다.
#   이 스크립트는 실행할 때마다 venv가 정상인지 확인하고, 깨졌으면 자동 재생성한다.
#
# 사용법 (새 Mac 포함):
#   cd console
#   ./dev.sh          # 없으면: chmod +x dev.sh && ./dev.sh
#   → 백엔드 http://localhost:8000 · 프론트 http://localhost:5173
#   Ctrl+C 로 둘 다 종료.
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/backend/.venv"

# python3.11 우선(백엔드 requires-python >=3.11), 없으면 python3
PYBIN="$(command -v python3.11 || command -v python3 || true)"
if [ -z "$PYBIN" ]; then
  echo "✗ python3.11(또는 python3)이 필요합니다. 설치 후 다시 실행하세요." >&2
  exit 1
fi

# 1) 백엔드 venv: 없거나 python 링크가 깨졌으면 재생성
if [ ! -x "$VENV/bin/python" ]; then
  echo "▶ 백엔드 venv 재생성 (기존 venv가 없거나 다른 Mac 경로로 깨짐)…"
  rm -rf "$VENV"
  "$PYBIN" -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q fastapi "uvicorn[standard]"
  echo "  ✓ venv 준비 완료"
fi

# 2) 프론트 의존성
if [ ! -d "$DIR/frontend/node_modules" ]; then
  echo "▶ 프론트 의존성 설치 (npm install)…"
  ( cd "$DIR/frontend" && npm install )
fi

# 3) 백엔드 + 프론트 동시 기동
echo "▶ 백엔드 :8000 · 프론트 :5173 기동 (Ctrl+C 로 종료)"
( cd "$DIR/backend" && exec "$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 ) &
BACK_PID=$!
trap 'kill "$BACK_PID" 2>/dev/null || true' EXIT INT TERM
( cd "$DIR/frontend" && npm run dev )
