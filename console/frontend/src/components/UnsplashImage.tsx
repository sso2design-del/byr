/* ── Unsplash 사진 ───────────────────────────────────────────────
 * 사진 출처 표기는 2026-10-16 요청으로 화면에서 뺐다.
 * 사진을 못 받으면(키 없음·한도 초과·검색 결과 없음) 모노톤 면으로 떨어진다.
 * ---------------------------------------------------------------- */

import { useEffect, useState, type CSSProperties } from 'react'
import { findPhoto, type Shot } from '../lib/unsplash'

const box: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '16 / 9',
  overflow: 'hidden',
}
const img: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  // 사진 가장자리가 흰 배경에 묻히지 않게 얇은 윤곽만 준다
  outline: '1px solid rgba(0, 0, 0, .1)',
  outlineOffset: -1,
}

export function useShot(query: string, width = 1200) {
  const [shot, setShot] = useState<Shot | null>(null)
  useEffect(() => {
    let alive = true
    findPhoto(query, width).then(s => {
      if (alive) setShot(s)
    })
    return () => {
      alive = false
    }
  }, [query, width])
  return shot
}

/**
 * 사진 한 장. 못 받으면 fallback(모노톤 그라데이션)으로 같은 자리를 채운다.
 */
export function UnsplashImage({
  query,
  width = 1200,
  fallback,
  alt = '',
  radius = 0,
  ratio = '16 / 9',
}: {
  query: string
  width?: number
  fallback: string
  alt?: string
  radius?: number
  /** CSS aspect-ratio 값. 기본 16/9 */
  ratio?: string
}) {
  const shot = useShot(query, width)

  if (!shot) {
    return <span style={{ ...box, aspectRatio: ratio, background: fallback, borderRadius: radius }} />
  }
  return (
    <>
      <span style={{ ...box, aspectRatio: ratio, borderRadius: radius }}>
        <img src={shot.url} alt={shot.alt || alt} loading="lazy" style={{ ...img, borderRadius: radius }} />
      </span>
    </>
  )
}
