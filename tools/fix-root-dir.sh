#!/usr/bin/env bash
# byr-web 프로젝트의 Root Directory 를 web 으로 바꾸고 재배포한다.
#
#   사용법: VERCEL_TOKEN=... bash tools/fix-root-dir.sh
#   토큰 발급: vercel.com → Account Settings → Tokens → Create
#
# 하는 일
#   1) byr-web 프로젝트를 찾는다
#   2) rootDirectory = web, framework = null 로 바꾼다
#   3) 최신 배포를 다시 굽는다
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN 이 필요합니다}"
PROJECT="${PROJECT:-byr-web}"
API="https://api.vercel.com"
H=(-H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json")

echo "1) 프로젝트 조회 — $PROJECT"
info=$(curl -sf "${H[@]}" "$API/v9/projects/$PROJECT")
id=$(printf '%s' "$info" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
cur=$(printf '%s' "$info" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("rootDirectory") or "(비어 있음 = 저장소 루트)")')
echo "   id=$id · 현재 Root Directory=$cur"

echo "2) Root Directory 를 web 으로"
curl -sf -X PATCH "${H[@]}" "$API/v9/projects/$id" \
  -d '{"rootDirectory":"web","framework":null,"buildCommand":null,"outputDirectory":null}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("   →", d.get("rootDirectory"), "· framework:", d.get("framework"))'

echo "3) 재배포"
dep=$(curl -sf "${H[@]}" "$API/v6/deployments?projectId=$id&limit=1&state=READY")
url=$(printf '%s' "$dep" | python3 -c 'import json,sys; ds=json.load(sys.stdin).get("deployments",[]); print(ds[0]["url"] if ds else "")')
if [ -n "$url" ]; then
  curl -sf -X POST "${H[@]}" "$API/v13/deployments" \
    -d "{\"name\":\"$PROJECT\",\"deploymentId\":\"$(printf '%s' "$dep" | python3 -c 'import json,sys; print(json.load(sys.stdin)["deployments"][0]["uid"])')\",\"target\":\"production\"}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("   새 배포:", d.get("url","(응답 확인 필요)"))'
else
  echo "   이전 배포가 없어 재배포는 대시보드에서 눌러 주세요"
fi
echo "완료 — 잠시 뒤 https://byr-web.vercel.app 확인"
