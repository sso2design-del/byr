/* ── Unsplash 이미지 연결 ────────────────────────────────────────
 * 공식 문서: https://unsplash.com/documentation
 *
 * 지켜야 하는 것(API Guidelines):
 *   1) 핫링크 — "We require the image URLs returned by the API to be directly
 *      used or embedded in your applications." 받아서 우리 서버에 두지 않는다.
 *   2) ixid 유지 — "All resizing and manipulations of image URLs must keep
 *      this parameter." urls.raw 에 파라미터를 덧붙이기만 한다.
 *   3) 출처 표기 — 사진가와 Unsplash 를 링크로 밝히고 UTM 을 붙인다.
 *   4) 다운로드 트래킹 — 사용자가 사진을 '내려받는' 기능이 있을 때만 필요하다.
 *      우리는 표시만 하므로 해당 없음(다운로드 기능을 붙이면 그때 호출한다).
 *
 * 키: Access Key 만 쓴다(Client-ID 인증). 브라우저에 노출되는 값이라
 *     Secret Key 는 여기에 두지 않는다. .env.local 에 넣고 커밋하지 않는다.
 *     VITE_UNSPLASH_ACCESS_KEY=...
 *
 * 요청 한도: 데모 앱 시간당 50건. 그래서 질의별로 sessionStorage 에 캐시하고,
 *           키가 없거나 실패하면 조용히 null 을 반환해 기존 모노톤 면으로 떨어진다.
 * ---------------------------------------------------------------- */

const KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined
const API = 'https://api.unsplash.com'
const UTM = 'utm_source=byr&utm_medium=referral'

export interface Shot {
  /** 핫링크용 이미지 주소(ixid 유지) */
  url: string
  alt: string
  /** 사진가 이름 */
  name: string
  /** 사진가 프로필 — 출처 표기 링크 */
  profileUrl: string
  /** Unsplash 사진 페이지 */
  photoUrl: string
}

export const hasUnsplashKey = Boolean(KEY)

interface RawPhoto {
  urls: { raw: string }
  alt_description: string | null
  description: string | null
  links: { html: string }
  user: { name: string; links: { html: string } }
}

const memo = new Map<string, Shot | null>()
/** 같은 질의가 동시에 여러 카드에서 불릴 때 요청을 한 번으로 합친다.
    데모 앱 한도가 시간당 50건이라 중복 호출을 그냥 두면 금방 막힌다. */
const inflight = new Map<string, Promise<Shot | null>>()

function cacheKey(query: string, w: number) {
  return `byr.unsplash.${w}.${query}`
}

function toShot(p: RawPhoto, w: number): Shot {
  // urls.raw 에는 ixid 가 이미 붙어 있다. 덧붙이기만 하고 지우지 않는다.
  const url = `${p.urls.raw}&w=${w}&q=80&fm=jpg&fit=crop`
  return {
    url,
    alt: p.alt_description ?? p.description ?? '',
    name: p.user.name,
    profileUrl: `${p.user.links.html}?${UTM}`,
    photoUrl: `${p.links.html}?${UTM}`,
  }
}

/**
 * 질의어로 사진 한 장을 찾는다. 키가 없거나 실패하면 null.
 * @param query  검색어(영문이 결과가 좋다)
 * @param w      내려받을 가로 크기(px)
 */
export async function findPhoto(query: string, w = 1200): Promise<Shot | null> {
  if (!KEY || !query) return null

  const ck = cacheKey(query, w)
  if (memo.has(ck)) return memo.get(ck) ?? null

  const running = inflight.get(ck)
  if (running) return running

  try {
    const cached = sessionStorage.getItem(ck)
    if (cached) {
      const shot = JSON.parse(cached) as Shot
      memo.set(ck, shot)
      return shot
    }
  } catch {
    /* sessionStorage 를 못 쓰는 환경이면 그냥 요청한다 */
  }

  const task = (async (): Promise<Shot | null> => {
  try {
    const res = await fetch(
      `${API}/search/photos?query=${encodeURIComponent(query)}` +
        '&per_page=1&orientation=landscape&content_filter=high',
      { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' } }
    )
    if (!res.ok) {
      // 403 이면 시간당 한도(데모 50건)를 넘긴 경우가 대부분이다
      memo.set(ck, null)
      return null
    }
    const json = (await res.json()) as { results: RawPhoto[] }
    const first = json.results?.[0]
    if (!first) {
      memo.set(ck, null)
      return null
    }
    const shot = toShot(first, w)
    memo.set(ck, shot)
    try {
      sessionStorage.setItem(ck, JSON.stringify(shot))
    } catch {
      /* 저장 실패는 무시 — 이번 세션 메모리 캐시로 충분하다 */
    }
    return shot
  } catch {
    memo.set(ck, null)
    return null
  }
  })()

  inflight.set(ck, task)
  try {
    return await task
  } finally {
    inflight.delete(ck)
  }
}
