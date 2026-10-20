/* ── 블로그 상세 ────────────────────────────────────────────────
 * 레이아웃은 paraform.com/blog/<post> 를 1440px 에서 실측해 옮겼다(구조·치수만).
 *   「← 목록」   x=148 — 본문 컬럼 바깥
 *   본문 컬럼    x=234 · w=684
 *   H1          48 / 52.8 / ls -1.2
 *   작성자 줄    14 / 21 · 역할은 검정 65%
 *   커버        684 × 384 (16:9)   ※ 라운드는 사이트 기준 16
 *   본문        16 / 26 · 단락 사이 24
 *   H2          24 / 32 / 500 · 위 여백 56
 *   목차        x=948 · w≈260 · 제목 24/32/500 · 항목 14/19.25
 * 폰트만 우리 것이다 — 원본 제목은 커스텀 세리프라 쓸 수 없다.
 * 카피·사진은 전부 Byr 것이고 원본 자산은 쓰지 않았다.
 * ---------------------------------------------------------------- */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { POSTS, THUMBS, getPost, formatDate, type Block, type Post } from '../data/blogPosts'
import { BrandMark } from '../components/BrandMark'
import { UnsplashImage } from '../components/UnsplashImage'

/* 배포 시 Vercel 환경변수로 주입한다(VITE_LANDING_URL). 없으면 로컬 서버 */
const LANDING = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:8960'

// ── 스타일 ────────────────────────────────────────────────────

const S = {
  page: { background: '#fff', color: '#1A1A1A', minHeight: '100vh' } as CSSProperties,
  bar: {
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', gap: 10,
    height: 60, padding: '0 24px',
    borderBottom: '1px solid var(--color-border)',
    background: '#fff', textDecoration: 'none', color: 'inherit',
  } as CSSProperties,

  /* 1440 에서 본문 x=234 / 목차 x=948 — 컨테이너 1248(x=96) 안에서 잡는다 */
  shell: { width: 'min(1248px, 100% - 48px)', marginInline: 'auto', paddingBottom: 96 } as CSSProperties,

  back: {
    display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
    fontSize: 16, lineHeight: '24px', color: '#1A1A1A', textDecoration: 'none',
  } as CSSProperties,
  who: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 } as CSSProperties,
  avatar: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: '#F1F1F2', display: 'grid', placeItems: 'center',
  } as CSSProperties,
  name: { fontSize: 14, lineHeight: '21px' } as CSSProperties,
  role: { fontSize: 14, lineHeight: '21px', color: 'rgba(26,26,26,.65)' } as CSSProperties,
  dot: { color: 'rgba(26,26,26,.4)' } as CSSProperties,
  date: { marginTop: 8, fontSize: 13, lineHeight: '19px', color: 'rgba(26,26,26,.6)' } as CSSProperties,

  cover: { display: 'block', width: '100%', aspectRatio: '16 / 9', borderRadius: 16 } as CSSProperties,

  p: { margin: '24px 0 0', fontSize: 16, lineHeight: '26px', textWrap: 'pretty' } as CSSProperties,
  h2: { margin: '56px 0 0', fontSize: 24, lineHeight: '32px', fontWeight: 500, letterSpacing: '-.2px' } as CSSProperties,
  quote: {
    margin: '36px 0 0', padding: '0 0 0 20px', borderLeft: '2px solid #6E6E6E',
    fontSize: 21, lineHeight: '30px', fontStyle: 'italic', color: '#5A5A5C',
  } as CSSProperties,
  ul: { margin: '20px 0 0', paddingLeft: 20, fontSize: 16, lineHeight: '26px' } as CSSProperties,
  li: { marginTop: 8 } as CSSProperties,

  /* 목차 — 원본은 sticky 가 아니라 흐르는 목록이다. 길어질 때를 대비해 sticky 만 얹었다 */
  tocH: { margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 500 } as CSSProperties,
  tocList: { margin: '18px 0 0', display: 'grid', gap: 14 } as CSSProperties,
  tocLink: (on: boolean): CSSProperties => ({
    fontSize: 14, lineHeight: '19.25px', textAlign: 'left',
    color: on ? '#1A1A1A' : 'rgba(26,26,26,.75)', fontWeight: on ? 600 : 400,
    background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  }),

  srcH: { margin: '56px 0 0', fontSize: 13, fontWeight: 600, color: 'rgba(26,26,26,.6)' } as CSSProperties,
  src: { marginTop: 8, fontSize: 13, lineHeight: '20px' } as CSSProperties,
  srcA: { color: 'rgba(26,26,26,.7)', textDecoration: 'underline' } as CSSProperties,

  rule: { margin: '72px 0 0', border: 0, borderTop: '1px solid #E6E6E6' } as CSSProperties,
  relH: { margin: '44px 0 22px', fontSize: 24, lineHeight: '32px', fontWeight: 500 } as CSSProperties,
  relCard: { textDecoration: 'none', color: 'inherit', display: 'grid', alignContent: 'start' } as CSSProperties,
  relT: { marginTop: 16, fontSize: 18, lineHeight: '26.1px', fontWeight: 500, letterSpacing: '-.18px' } as CSSProperties,
  relM: { marginTop: 10, fontSize: 13, color: '#6B6B6B' } as CSSProperties,

  cta: { marginTop: 72, padding: '56px 24px', borderRadius: 16, background: '#F5F5F5', textAlign: 'center' } as CSSProperties,
  ctaH: { margin: 0, fontSize: 30, lineHeight: '38px', fontWeight: 600, letterSpacing: '-.6px' } as CSSProperties,
  ctaP: { margin: '10px 0 0', color: '#6B6B6B' } as CSSProperties,
  ctaActs: { marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' } as CSSProperties,
  btn: {
    display: 'inline-flex', alignItems: 'center', height: 46, padding: '0 22px',
    borderRadius: 999, fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer',
    border: 0, fontFamily: 'inherit',
  } as CSSProperties,
}

const btnFill: CSSProperties = { ...S.btn, background: '#111', color: '#fff' }
const btnLine: CSSProperties = { ...S.btn, background: '#fff', color: '#1A1A1A', boxShadow: 'inset 0 0 0 1px #D4D4D8' }

/* 반응형 — 원본은 1440 기준 2단이다. 좁아지면 목차를 본문 위로 접는다 */
const SHEET = `
/* 원본 기하: 컨테이너 96 + 138 = 본문 x=234 · 684 + 30 + 260 → 목차 x=948 */
.bp-head { padding-top: 56px; margin-left: 138px; }
.bp-back { margin-left: -138px; }
.bp-h1 { margin: 0; max-width: 780px; font-size: 48px; line-height: 52.8px;
  font-weight: 600; letter-spacing: -1.2px; text-wrap: balance; }
.bp-cols { margin: 44px 0 0 138px; display: grid; grid-template-columns: 684px 260px;
  gap: 30px; align-items: start; }
.bp-toc { position: sticky; top: 84px; }
.bp-rel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px 24px; }

@media (max-width: 1180px) {
  .bp-head, .bp-cols { margin-left: 0; }
  .bp-back { margin-left: 0; }
  .bp-cols { grid-template-columns: minmax(0, 684px) 260px; }
}
@media (max-width: 1000px) {
  .bp-cols { grid-template-columns: 1fr; }
  .bp-toc { position: static; order: -1; }
}
@media (max-width: 720px) {
  .bp-h1 { font-size: 32px; line-height: 38px; letter-spacing: -.6px; }
  .bp-rel { grid-template-columns: 1fr; }
}
`

// ── 본문 ──────────────────────────────────────────────────────

function Body({ blocks }: { blocks: Block[] }) {
  let n = 0
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'h2') {
          n += 1
          return <h2 key={i} id={`s${n}`} style={S.h2}>{b.text}</h2>
        }
        if (b.t === 'quote') return <blockquote key={i} style={S.quote}>{b.text}</blockquote>
        if (b.t === 'ul')
          return (
            <ul key={i} style={S.ul}>
              {b.items.map((it, j) => <li key={j} style={S.li}>{it}</li>)}
            </ul>
          )
        return <p key={i} style={S.p}>{b.text}</p>
      })}
    </>
  )
}

// ── 페이지 ────────────────────────────────────────────────────

export default function BlogPost() {
  const { id } = useParams()
  const navigate = useNavigate()
  const post = getPost(id)

  const toc = useMemo(
    () => (post ? post.body.filter(b => b.t === 'h2').map((b, i) => ({ id: `s${i + 1}`, label: (b as { text: string }).text })) : []),
    [post]
  )
  const [active, setActive] = useState<string | undefined>(undefined)

  /* 라우터 전환이라 스크롤이 남는다 — 글이 바뀌면 맨 위에서 시작 */
  useEffect(() => { window.scrollTo(0, 0); setActive(undefined) }, [id])

  /* 읽는 위치에 맞춰 목차 항목을 표시 */
  useEffect(() => {
    if (!toc.length) return
    const ob = new IntersectionObserver(
      es => { for (const e of es) if (e.isIntersecting) setActive(e.target.id) },
      { rootMargin: '-15% 0px -70% 0px' }
    )
    toc.forEach(t => { const el = document.getElementById(t.id); if (el) ob.observe(el) })
    return () => ob.disconnect()
  }, [toc, id])

  if (!post) {
    return (
      <div style={S.page}>
        <Link to="/blog" style={S.bar}><BrandMark size={22} /><span style={{ fontWeight: 600 }}>Byr 블로그</span></Link>
        <div style={S.shell} className="bp-head">
          <h1 className="bp-h1">글을 찾을 수 없습니다</h1>
          <p style={S.p}>주소가 바뀌었거나 아직 공개되지 않은 글입니다.</p>
          <p style={S.p}><Link to="/blog">목록으로 돌아가기</Link></p>
        </div>
      </div>
    )
  }

  const related: Post[] = POSTS.filter(p => p.id !== post.id).slice(0, 3)

  return (
    <div style={S.page}>
      <style>{SHEET}</style>
      <Link to="/blog" style={S.bar}>
        <BrandMark size={22} />
        <span style={{ fontWeight: 600 }}>Byr 블로그</span>
      </Link>

      <div style={S.shell}>
        <div className="bp-head">
          <Link to="/blog" style={S.back} className="bp-back">← 목록</Link>
          <h1 className="bp-h1">{post.title}</h1>
          <div style={S.who}>
            <span style={S.avatar}><BrandMark size={18} radius={50} /></span>
            <span style={S.name}>{post.author}</span>
            <span style={S.dot}>·</span>
            <span style={S.role}>{post.keyword}</span>
          </div>
          <div style={S.date}>{formatDate(post.date)} · 읽는 데 약 {post.readMin}분</div>
        </div>

        <div className="bp-cols">
          <article>
            <UnsplashImage
              query={post.photo}
              width={1400}
              fallback={THUMBS[post.tone]}
              alt={post.title}
              radius={16}
            />

            <Body blocks={post.body} />

            {post.sources && post.sources.length > 0 && (
              <>
                <p style={S.srcH}>참고한 자료</p>
                {post.sources.map(src => (
                  <p key={src.url} style={S.src}>
                    <a href={src.url} target="_blank" rel="noreferrer noopener" style={S.srcA}>{src.label}</a>
                  </p>
                ))}
              </>
            )}
          </article>

          {toc.length > 0 && (
            <aside className="bp-toc">
              <p style={S.tocH}>이 글에서</p>
              <nav style={S.tocList}>
                {toc.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    style={S.tocLink(active === t.id)}
                    onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </aside>
          )}
        </div>

        <hr style={S.rule} />

        <h2 style={S.relH}>다른 글</h2>
        <div className="bp-rel">
          {related.map(r => (
            <Link key={r.id} to={`/blog/${r.id}`} style={S.relCard}>
              <UnsplashImage
                query={r.photo}
                width={600}
                fallback={THUMBS[r.tone]}
                alt={r.title}
                radius={16}
              />
              <span style={S.relT}>{r.title}</span>
              <span style={S.relM}>{formatDate(r.date)} · {r.readMin}분</span>
            </Link>
          ))}
        </div>

        <section style={S.cta}>
          <h2 style={S.ctaH}>반복 업무 하나로 시작하세요</h2>
          <p style={S.ctaP}>메신저로 요청한 업무를 에이전트가 처리합니다.</p>
          <div style={S.ctaActs}>
            <button type="button" style={btnFill} onClick={() => navigate('/login?signup=1')}>가입하고 시작하기</button>
            <a href={`${LANDING}/#pricing`} style={btnLine}>요금 안내</a>
          </div>
        </section>
      </div>
    </div>
  )
}
