/* ── 블로그 목록 ────────────────────────────────────────────────
 * 레이아웃은 paraform.com/blog 를 1440px 에서 실측해 옮겼다(구조·치수만).
 *   컨테이너   1248 (좌우 96)
 *   상단 밴드   어두운 면 · 카테고리 필터 15px 흰색 80% · 원형 검색 버튼
 *   머리 영역   좌 824 큰 카드(이미지 824×463) / 우 400 카드 2장(400×225)
 *   본문 그리드 400px × 3열 · gap 48(행) 24(열)
 *   카드       제목 18 / 26.1 / 500 / ls -.18 · 메타 「· 날짜   ⏱ N분」
 * 카피·사진·카테고리는 전부 Byr 것이고, 원본 자산은 쓰지 않았다.
 * 글 데이터는 data/blogPosts.ts — 상세(/blog/:id)·랜딩 카드와 같은 원본.
 * ---------------------------------------------------------------- */

import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { POSTS, CATEGORIES, THUMBS, formatDate, type Post } from '../data/blogPosts'
import { UnsplashImage } from '../components/UnsplashImage'
import { BrandMark } from '../components/BrandMark'

/* 배포 시 Vercel 환경변수로 주입한다(VITE_LANDING_URL). 없으면 로컬 서버 */
const LANDING = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:8960'

// ── 스타일 ────────────────────────────────────────────────────

const WRAP: CSSProperties = { width: 'min(1248px, 100% - 48px)', marginInline: 'auto' }

const S = {
  page: { background: '#FFFFFF', minHeight: '100vh', color: '#1A1A1A' } as CSSProperties,

  band: { background: '#0A0A0B', color: '#fff', paddingBottom: 72 } as CSSProperties,
  bar: { ...WRAP, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as CSSProperties,
  brand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff', fontWeight: 600 } as CSSProperties,
  home: { fontSize: 14, color: 'rgba(255,255,255,.7)', textDecoration: 'none' } as CSSProperties,

  /* 콘솔 전역 h1 색이 상속을 덮어 다크 밴드에서 안 보인다 — 색을 직접 준다 */
  h1: { ...WRAP, margin: '28px auto 0', fontSize: 44, lineHeight: '50px', fontWeight: 600,
        letterSpacing: '-1px', color: '#fff' } as CSSProperties,

  filters: { ...WRAP, marginTop: 34, display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' } as CSSProperties,
  filter: (on: boolean): CSSProperties => ({
    border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
    fontSize: 15, lineHeight: '15px',
    color: on ? '#fff' : 'rgba(255,255,255,.8)',
    fontWeight: on ? 600 : 400,
  }),
  searchBtn: {
    width: 34, height: 34, borderRadius: '50%', border: 0, cursor: 'pointer',
    background: 'rgba(255,255,255,.12)', color: '#fff',
    display: 'grid', placeItems: 'center', marginLeft: 6,
  } as CSSProperties,
  searchInput: {
    height: 34, minWidth: 200, borderRadius: 999, border: '1px solid rgba(255,255,255,.24)',
    background: 'rgba(255,255,255,.08)', color: '#fff', padding: '0 14px', font: 'inherit', fontSize: 14,
    outline: 'none',
  } as CSSProperties,

  /* 머리 — 좌 824 / 우 400 (실측 비율 그대로) */
  lead: { ...WRAP, marginTop: 40, display: 'grid', gridTemplateColumns: '824fr 400fr', gap: 24, alignItems: 'start' } as CSSProperties,
  side: { display: 'grid', gap: 24 } as CSSProperties,

  grid: { ...WRAP, padding: '56px 0 96px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px 24px' } as CSSProperties,

  card: { textDecoration: 'none', color: 'inherit', display: 'grid', alignContent: 'start' } as CSSProperties,
  title: (dark: boolean): CSSProperties => ({
    marginTop: 16, fontSize: 18, lineHeight: '26.1px', fontWeight: 500, letterSpacing: '-.18px',
    color: dark ? '#fff' : '#1A1A1A',
  }),
  meta: (dark: boolean): CSSProperties => ({
    marginTop: 10, display: 'flex', alignItems: 'center', gap: 18,
    fontSize: 13, color: dark ? 'rgba(255,255,255,.6)' : '#6B6B6B',
  }),
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 6 } as CSSProperties,
  dot: { width: 3, height: 3, borderRadius: '50%', background: 'currentColor', display: 'inline-block' } as CSSProperties,
  empty: { ...WRAP, padding: '80px 0 120px', textAlign: 'center', color: '#6B6B6B' } as CSSProperties,
}

/* 반응형·호버는 인라인 스타일로 못 쓴다 */
const SHEET = `
.bl-thumb { display: block; transition: transform .4s cubic-bezier(.22,1,.36,1); }
.bl-card:hover .bl-thumb { transform: translateY(-3px); }
.bl-filter:hover { color: #fff; }
@media (max-width: 1080px) {
  .bl-lead { grid-template-columns: 1fr !important; }
  .bl-side { grid-template-columns: 1fr 1fr !important; }
  .bl-grid { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 720px) {
  .bl-side { grid-template-columns: 1fr !important; }
  .bl-grid { grid-template-columns: 1fr !important; }
  .bl-h1 { font-size: 32px !important; line-height: 38px !important; }
}
`

// ── 카드 ──────────────────────────────────────────────────────

function PostCard({ post, dark = false, big = false }: { post: Post; dark?: boolean; big?: boolean }) {
  return (
    <Link to={`/blog/${post.id}`} style={S.card} className="bl-card">
      <span className="bl-thumb">
        <UnsplashImage
          query={post.photo}
          width={big ? 1200 : 800}
          fallback={THUMBS[post.tone]}
          alt={post.title}
          radius={16}   /* 사이트 이미지 카드 기준(--r-in) */
        />
      </span>
      <span style={S.title(dark)}>{post.title}</span>
      <span style={S.meta(dark)}>
        <span style={S.metaItem}><i style={S.dot} />{formatDate(post.date)}</span>
        <span style={S.metaItem}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          {post.readMin}분
        </span>
      </span>
    </Link>
  )
}

// ── 페이지 ────────────────────────────────────────────────────

export default function Blog() {
  const [tab, setTab] = useState<string>('전체')
  const [q, setQ] = useState('')
  const [openSearch, setOpenSearch] = useState(false)

  const list = useMemo(() => {
    let items = tab === '전체' ? POSTS : POSTS.filter(p => p.category === tab)
    if (q.trim()) {
      const s = q.toLowerCase()
      items = items.filter(p => p.title.toLowerCase().includes(s) || p.summary.toLowerCase().includes(s))
    }
    return [...items].sort((a, b) => b.date.localeCompare(a.date))
  }, [tab, q])

  const [featured, ...rest] = list
  const side = rest.slice(0, 2)
  const grid = rest.slice(2)

  return (
    <div style={S.page}>
      <style>{SHEET}</style>

      <header style={S.band}>
        <div style={S.bar}>
          <a href={`${LANDING}/`} style={S.brand}>
            <BrandMark size={24} />
            <span>Byr</span>
          </a>
          <a href={`${LANDING}/`} style={S.home}>홈으로</a>
        </div>

        <h1 style={S.h1} className="bl-h1">블로그</h1>

        <div style={S.filters}>
          {CATEGORIES.map(c => (
            <button key={c} type="button" className="bl-filter" style={S.filter(tab === c)} onClick={() => setTab(c)}>
              {c}
            </button>
          ))}
          {openSearch ? (
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              onBlur={() => { if (!q) setOpenSearch(false) }}
              placeholder="글 검색"
              style={S.searchInput}
            />
          ) : (
            <button type="button" aria-label="검색" style={S.searchBtn} onClick={() => setOpenSearch(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {featured && (
          <div style={S.lead} className="bl-lead">
            <PostCard post={featured} dark big />
            <div style={S.side} className="bl-side">
              {side.map(p => <PostCard key={p.id} post={p} dark />)}
            </div>
          </div>
        )}
      </header>

      {grid.length > 0 && (
        <div style={S.grid} className="bl-grid">
          {grid.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {list.length === 0 && <p style={S.empty}>찾는 글이 없습니다.</p>}
    </div>
  )
}
