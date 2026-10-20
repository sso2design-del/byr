#!/usr/bin/env bash
# 랜딩(정적) 빌드 — Vercel 이 실행한다.
#  1) 콘솔 링크의 localhost 를 실제 주소로 바꾼다 (CONSOLE_URL)
#  2) Unsplash 키를 주입한다 (UNSPLASH_ACCESS_KEY) — 키가 없으면 사진 없이 그대로 뜬다
set -euo pipefail

# 콘솔 주소 — Vercel 환경변수 CONSOLE_URL 이 있으면 그것을 쓰고,
# 없으면 아래 기본값(콘솔 프로젝트를 byr-console 로 만들었을 때의 주소)을 쓴다.
# export 해야 아래 perl 이 $ENV{CONSOLE_URL} 로 읽는다
export CONSOLE_URL="${CONSOLE_URL:-https://byr-console.vercel.app}"

rm -rf dist && mkdir -p dist
# vendor/ 를 빠뜨리면 main.js(모듈)가 통째로 실패해 탭·타이핑·토글이 전부 죽는다
cp -R index.html styles.css main.js unsplash.js config.example.js favicon.svg assets support vendor dist/
[ -f UNSPLASH.md ] && cp UNSPLASH.md dist/ || true
# 모션 목업(단독 페이지) — README 같은 내부 문서는 올리지 않고 html 만 복사한다
mkdir -p dist/motion && cp motion/*.html dist/motion/

if [ -n "$CONSOLE_URL" ]; then
  # sed -i 는 macOS(BSD)와 Linux(GNU) 문법이 달라 perl 로 바꾼다 — 양쪽에서 그대로 돈다
  grep -rl 'http://localhost:5173' dist | while read -r f; do
    perl -pi -e 's|http://localhost:5173|$ENV{CONSOLE_URL}|g' "$f"
  done
  echo "콘솔 주소 → ${CONSOLE_URL}"
fi

printf "window.BYR_UNSPLASH_KEY = '%s'\n" "${UNSPLASH_ACCESS_KEY:-}" > dist/config.local.js
echo "빌드 완료 — dist/"
