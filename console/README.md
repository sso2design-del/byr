# Byr 콘솔 프로토타입

React(Vite, :5173) 프론트 + FastAPI(:8000) 백엔드. 로그인 화면 오른쪽 목업은 두 시안을 토글한다.

## ▶ 실행 (어느 Mac에서든 한 방)

```bash
cd console
./dev.sh          # 최초엔: chmod +x dev.sh && ./dev.sh
```

→ 백엔드 http://localhost:8000 · 프론트 **http://localhost:5173** (로그인: `/login`). Ctrl+C 로 종료.

`dev.sh`가 매번 확인·자가복구한다: 백엔드 venv가 없거나 다른 Mac 경로로 깨졌으면 자동 재생성하고, 프론트 의존성도 없으면 설치한 뒤 두 서버를 함께 띄운다.

## ⚠️ "콘텐츠가 불러오기 중…"에서 멈출 때

원인은 하나다: **백엔드(:8000)가 안 떠 있음.** 프론트는 `/api`를 백엔드로 프록시하는데, 백엔드가 없으면 데이터 로드가 멈춘다.

가장 흔한 트리거는 **다른 Mac 접속**이다. Python `venv`는 만든 Mac의 절대경로를 내부에 저장하므로, iCloud로 동기화되면 다른 Mac에서 python 링크가 깨져 백엔드가 안 뜬다.

**해결:** 위 `./dev.sh` 실행. (venv를 자동 재생성하고 백엔드를 띄운다.) 백엔드가 꺼진 상태면 이제 프론트가 무한 로딩 대신 "백엔드에 연결할 수 없습니다 — dev.sh 실행" 안내를 띄운다.

## 기기별 파일 (git 제외 · 맥마다 재생성)

`backend/.venv`, `frontend/node_modules`, `dist` 등은 `.gitignore` 처리되어 있고 **동기화하지 않는다.** 새 Mac에선 `dev.sh`가 알아서 만든다.

## 로그인 목업 두 시안 (토글)

`frontend/src/pages/Login.tsx` 상단 `MOCKUP_VARIANT`:
- `1` = 1시안 — 실제 콘솔 UI가 살아 움직이는 커서 목업(`ProductMockupV1`)
- `2` = 2시안 — 레퍼런스 영상 스타일 키네틱 위저드(`ProductMockupV2`, 현재 기본값)
