# Unsplash 이미지 연결

서비스 소개 사이트와 콘솔의 공개 화면(블로그·도입 상담)에서 쓰는 사진은
Unsplash API 로 가져온다. 사진 파일을 저장소에 두지 않는다.

공식 문서: <https://unsplash.com/documentation>

## 1. 키 넣기

Unsplash 앱 페이지(<https://unsplash.com/oauth/applications>)의 **Access Key** 하나만 쓴다.
Secret Key 는 이 연동에 필요 없다(사용자 로그인 없이 Client-ID 인증만 쓴다).

두 곳에 각각 넣는다. 둘 다 `.gitignore` 대상이라 커밋되지 않는다.

| 대상 | 파일 | 형식 |
|---|---|---|
| 콘솔(Vite) | `console-prototype/frontend/.env.local` | `VITE_UNSPLASH_ACCESS_KEY=...` |
| 랜딩(정적) | `byr-homepage/config.local.js` | `window.BYR_UNSPLASH_KEY = '...'` |

예시 파일(`.env.example`, `config.example.js`)을 복사해서 값만 채우면 된다.
**키가 없어도 사이트는 그대로 뜬다** — 사진 자리가 기존 모노톤 면으로 남는다.

## 2. 지키고 있는 것 (API Guidelines)

| 요구 | 어떻게 |
|---|---|
| 이미지 핫링크 | API 가 준 `urls.raw` 를 그대로 `<img src>` 에 쓴다. 내려받아 저장소에 두지 않는다 |
| `ixid` 유지 | `urls.raw` 뒤에 `&w=&q=&fm=&fit=` 만 덧붙인다. 기존 파라미터를 지우지 않는다 |
| 출처 표기 | 사진이 보이는 자리마다 「사진 {사진가} · Unsplash」 링크를 함께 낸다 |
| UTM | 두 링크 모두 `?utm_source=byr&utm_medium=referral` |
| 다운로드 트래킹 | 해당 없음 — 표시만 한다. '사진 내려받기' 기능을 붙이면 그때 `/photos/:id/download` 를 호출해야 한다 |

크레딧은 컴포넌트 안에서 사진과 한 몸으로 렌더한다(`UnsplashImage`),
크레딧 없이 사진만 내보내는 경로를 만들지 않는다.

## 3. 요청 한도

데모 앱은 **시간당 50건**(승인 후 프로덕션은 1,000건). 그래서:

- 질의별로 `sessionStorage` 에 결과를 캐시한다.
- 같은 질의가 동시에 여러 카드에서 불리면 요청을 하나로 합친다.
- 실패(403 등)하면 조용히 대체 면으로 떨어진다. 화면이 깨지지 않는다.

한도를 넘기면 그 시간 동안 사진이 안 보이는 것으로 끝난다.
공개 배포 전에는 Unsplash 앱을 **프로덕션 승인** 신청해야 한다.

## 4. 어디에 쓰고 있나

| 화면 | 자리 | 검색어 |
|---|---|---|
| 랜딩 `#blog` | 카드 썸네일 3장 | `blogPosts` 의 `photo` (index.html `data-photo`) |
| 콘솔 `/blog` | 목록 카드 썸네일 | `data/blogPosts.ts` 의 `photo` |
| 콘솔 `/blog/:id` | 히어로 · 「다른 글」 썸네일 | 같은 필드 |
| 콘솔 `/contact` | 왼쪽 이미지 | `team meeting discussion office` |

사진을 바꾸려면 검색어만 고치면 된다. 파일을 갈아끼울 필요가 없다.

## 5. 코드

| 파일 | 무엇 |
|---|---|
| `console-prototype/frontend/src/lib/unsplash.ts` | 검색·캐시·중복요청 합치기 |
| `console-prototype/frontend/src/components/UnsplashImage.tsx` | 사진 + 크레딧 렌더 |
| `byr-homepage/unsplash.js` | 랜딩용(빌드 없음, 순수 JS) |
