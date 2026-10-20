import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Calendar, type DateRange, type ISODateString } from '@astryxdesign/core/Calendar'
import {
  Search, FileText, FileType2, MessageSquare, Mail, Users, History, X, ChevronDown, ArrowUpRight,
} from 'lucide-react'
import type { IconType } from '@astryxdesign/core/Icon'
import { SearchBar } from '../components/SearchBar'
import { FilterDropdown } from '../components/FilterDropdown'
import { McpLogoIcon } from '../utils/mcpLogos'
import { PlatformLogo } from '../utils/platformLogos'

// ── 목데이터 ──────────────────────────────────────────────────

type SourceKind = 'mcp' | 'platform'

interface Citation { doc: string; source: string; loc: string }
// [질문] 시 보여줄 짧은 답 미리보기(공통 목)
const ANSWER = {
  text:
    '2026년 2분기 부가세 확정신고 마감일은 7월 25일입니다. 준비 서류는 매입·매출 세금계산서 합계표, 대사 완료된 원장, 홈택스 신고서 초안입니다. ' +
    '재무팀 가이드 기준 마감 3영업일 전까지 대사를 끝내도록 권장합니다.',
  citations: [
    { doc: '2026 부가세 신고 가이드.pdf', source: 'Google Drive', loc: 'p.3 · 마감 일정' },
    { doc: '세금계산서 합계표 (2026Q2)',   source: '국세청 홈택스', loc: '요약' },
  ] as Citation[],
}

// 혼합 타입 통합검색 결과
type DocType = 'doc' | 'pdf' | 'meeting' | 'email'
const DOC_TYPE_META: Record<DocType, { icon: IconType; label: string }> = {
  doc:     { icon: FileText,  label: '문서' },
  pdf:     { icon: FileType2, label: 'PDF' },
  meeting: { icon: Users,     label: '회의·메시지' },
  email:   { icon: Mail,      label: '이메일' },
}
interface DocResult {
  id: string; type: DocType; title: string
  logoKey: string; logoKind: SourceKind; sourceName: string; folder: string
  modified: string; person?: string; ts?: string
  snip: { pre: string; hi: string; post: string }
}
const DOC_RESULTS: DocResult[] = [
  { id: 'r1', type: 'pdf', title: '2026 부가세 신고 가이드.pdf', logoKey: 'gdrive', logoKind: 'mcp', sourceName: 'Google Drive', folder: '재무팀', modified: '2026-07-10',
    snip: { pre: '2026년 2분기 부가세 확정신고 ', hi: '마감일은 7월 25일', post: '이며, 매입·매출 세금계산서 합계표가 필요합니다.' } },
  { id: 'r2', type: 'doc', title: '부가세 대사 에이전트 · 협업 흐름 설계서', logoKey: 'gdrive', logoKind: 'mcp', sourceName: 'Google Drive', folder: '프로젝트', modified: '2026-07-17',
    snip: { pre: '단계 3(홈택스 제출)은 ', hi: '고위험 · 사용자 승인 필요', post: '. 승인은 메신저에서 이뤄지고 실행 이력은 감사에 남습니다.' } },
  { id: 'r3', type: 'meeting', title: '재무팀 마감 점검 회의', logoKey: 'slack', logoKind: 'platform', sourceName: 'Slack', folder: '#재무팀-봇', modified: '2026-07-10', person: '김재무 팀장', ts: '05:06',
    snip: { pre: '김재무 팀장: 신고 ', hi: '마감 3영업일 전까지 대사', post: '를 끝내 주세요. 이상 항목은 승인 후 제출.' } },
  { id: 'r4', type: 'doc', title: 'PRD — 팀 에이전트 협업(스텝·승인) v1', logoKey: 'gdrive', logoKind: 'mcp', sourceName: 'Google Drive', folder: '프로젝트', modified: '2026-07-14',
    snip: { pre: '팀 = 직무 단위 에이전트 그룹, ', hi: '협업 흐름 = 핸드오프·승인', post: '으로 함께 하는 하나의 워크플로우.' } },
  { id: 'r5', type: 'meeting', title: '이수민 대리 · 대사 불일치 문의', logoKey: 'slack', logoKind: 'platform', sourceName: 'Slack', folder: '#재무팀-봇', modified: '2026-07-18', person: '이수민 대리', ts: '09:15',
    snip: { pre: '지난주 ', hi: '불일치 2건은 담당자 확인', post: ' 후 수정 세금계산서 수취로 해결됐어요.' } },
  { id: 'r6', type: 'email', title: '[발송 대기] 부가세 마감 안내 메일 초안', logoKey: 'gdrive', logoKind: 'mcp', sourceName: 'Google Drive', folder: '재무팀', modified: '2026-07-16',
    snip: { pre: '안녕하세요. 2분기 부가세 ', hi: '신고 마감(7/25)', post: '을 안내드립니다. 증빙 서류를 기한 내 제출 바랍니다.' } },
]
const RECENT_SEARCHES: { q: string; when: string }[] = [
  { q: '부가세 마감일', when: '방금 전' },
  { q: '협업 흐름 승인 정책', when: '오늘 09:12' },
  { q: '대사 불일치 처리', when: '어제' },
  { q: '월마감 결산 일정', when: '2일 전' },
  { q: '에이전트 템플릿 목록', when: '지난주' },
]

// ── 패싯 필터 (Apps · People · Modified · More) ────────────────
const F_SOURCE = ['소스 전체', 'Google Drive', '국세청 홈택스', 'Slack'] as const
const F_PERSON = ['사용자 전체', '김재무 팀장', '이수민 대리', '박도현 사원'] as const
const F_MORE   = ['더보기', '문서', 'PDF', '회의·메시지', '이메일'] as const

// ── 공용 조각 ─────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: 10 }}>{text}</div>
}

// 하이라이트: 검색어 토큰(공백 분리)을 텍스트에서 대소문자 무시로 강조
const MARK_STYLE: React.CSSProperties = { background: 'var(--color-warning-muted)', color: 'var(--color-text-primary)', padding: '0 2px', borderRadius: 3 }
const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  const tokens = q ? q.split(/\s+/).filter(Boolean) : []
  if (!tokens.length) return <>{text}</>
  const re = new RegExp(`(${tokens.map(escapeReg).join('|')})`, 'gi')
  const lower = new Set(tokens.map(t => t.toLowerCase()))
  return (
    <>
      {text.split(re).map((p, i) =>
        p && lower.has(p.toLowerCase())
          ? <mark key={i} style={MARK_STYLE}>{p}</mark>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  )
}

// 파일 형식 썸네일(좌측) — 형식별 아이콘 옅은 박스, PDF만 붉은 톤, 회의·메시지는 발언자 아바타
function FileThumb({ d, size = 40 }: { d: DocResult; size?: number }) {
  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-background-muted)', border: '1px solid var(--color-border)',
  }
  if (d.type === 'meeting') {
    return d.person
      ? <div style={{ width: size, height: size, borderRadius: '50%', background: '#3f3f46', color: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0 }}>{d.person.slice(0, 1)}</div>
      : <div style={box}><AstryxIcon icon={MessageSquare} size="md" color="secondary" strokeWidth={1.8} /></div>
  }
  if (d.type === 'pdf') {
    return (
      <div style={{ ...box, background: 'var(--color-error-muted)', border: '1px solid var(--color-error-muted)' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-error)', fontFamily: 'inherit', letterSpacing: '0.02em' }}>PDF</span>
      </div>
    )
  }
  const icon = d.type === 'email' ? Mail : FileText
  return <div style={box}><AstryxIcon icon={icon} size="md" color="secondary" strokeWidth={1.8} /></div>
}

// 소스 브랜드 로고(컬러) — MCP/플랫폼 재사용 (메타 줄에 배치)
function MiniLogo({ logoKey, kind, size = 30 }: { logoKey: string; kind: SourceKind; size?: number }) {
  if (kind === 'platform') {
    return (
      <div style={{ width: size, height: size, borderRadius: 4, background: '#fff', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PlatformLogo platform={logoKey} size={size * 0.62} />
      </div>
    )
  }
  return <McpLogoIcon mcpKey={logoKey} size={size} />
}

// ── 날짜 범위 필터 (FilterDropdown 룩 트리거 + 팝오버[프리셋 + Astryx Calendar]) ──
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtShort = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { my: `${MONTH_EN[m - 1]} ${d}`, y } }
const fmtRange = (r: DateRange) => {
  const s = fmtShort(r.start), e = fmtShort(r.end)
  return s.my === e.my && s.y === e.y ? `${s.my}, ${s.y}` : `${s.my} – ${e.my}, ${e.y}`
}
const toIso = (d: Date): ISODateString =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as ISODateString
const daysAgo = (n: number): Date => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const DATE_PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: '오늘',      getRange: () => ({ start: toIso(new Date()), end: toIso(new Date()) }) },
  { label: '지난 7일',  getRange: () => ({ start: toIso(daysAgo(6)),  end: toIso(new Date()) }) },
  { label: '지난 30일', getRange: () => ({ start: toIso(daysAgo(29)), end: toIso(new Date()) }) },
]

function DateRangePill({ value, onChange }: {
  value: DateRange | null; onChange: (r: DateRange | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const active = !!value

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = () => {
    if (!open && wrapRef.current) { const r = wrapRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 6, left: r.left }) }
    setOpen(v => !v)
  }

  return (
    <div ref={wrapRef} style={{ flexShrink: 0 }}>
      {/* FilterDropdown과 동일한 필 트리거 */}
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 14px', height: 40, borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)',
          background: active ? 'var(--color-background-muted)' : 'var(--color-background-surface)',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: active ? 600 : 400,
          color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
        }}
      >
        {active ? fmtRange(value) : '수정일'}
        <AstryxIcon icon={ChevronDown} size="sm" color="secondary" strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && createPortal(
        <div ref={popRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--color-background-surface)', border: '1px solid var(--color-border-emphasized)',
          borderRadius: 'var(--radius-element)', boxShadow: 'var(--shadow-med)', padding: 12,
        }}>
          {/* 프리셋 퀵버튼 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => onChange(p.getRange())}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid var(--color-border)', background: 'var(--color-background-surface)',
                  fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)',
                }}>{p.label}</button>
            ))}
            {active && (
              <button onClick={() => { onChange(null); setOpen(false) }}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid var(--color-border)', background: 'var(--color-background-surface)',
                  fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
                }}>
                <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />해제
              </button>
            )}
          </div>
          {/* Astryx Calendar (range, 2개월) */}
          <Calendar
            mode="range"
            numberOfMonths={2}
            value={value ?? undefined}
            onChange={(r: DateRange) => onChange(r)}
            focusDate={value?.start ?? '2026-07-01'}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', flexShrink: 0,
  padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
  background: 'var(--color-background-surface)', fontSize: 12, fontWeight: 500,
  color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
}
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  padding: '7px 14px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-accent)', color: 'var(--color-on-accent)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
const iconGhost: React.CSSProperties = {
  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', cursor: 'pointer',
}

// ── 페이지 ────────────────────────────────────────────────────

export default function Knowledge() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [fSource, setFSource] = useState<string>(F_SOURCE[0])
  const [fPerson, setFPerson] = useState<string>(F_PERSON[0])
  const [fMore, setFMore] = useState<string>(F_MORE[0])
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [answerDoc, setAnswerDoc] = useState<DocResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const runSearch = (q?: string) => { if (q !== undefined) setQuery(q); setSubmitted(true); setAnswerDoc(null) }

  const anyFilter = fSource !== F_SOURCE[0] || fPerson !== F_PERSON[0] || fMore !== F_MORE[0] || !!dateRange
  const resetFilters = () => { setFSource(F_SOURCE[0]); setFPerson(F_PERSON[0]); setFMore(F_MORE[0]); setDateRange(null) }
  // 결과 화면 전환: 검색 실행(버튼/Enter) OR 검색어 입력 OR 필터 적용 시 라이브로 결과 표시
  const showResults = submitted || query.trim().length > 0 || anyFilter

  // 결과 수정일(ISO 'YYYY-MM-DD')이 선택 범위 안인지 — ISO 문자열 사전식 비교
  const inDateRange = (mod: string) => {
    if (!dateRange) return true
    const { start, end } = dateRange
    const lo = start < end ? start : end
    const hi = start < end ? end : start
    return mod >= lo && mod <= hi
  }

  const results = DOC_RESULTS.filter(d => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || d.title.toLowerCase().includes(q) || (d.snip.pre + d.snip.hi + d.snip.post).toLowerCase().includes(q)
    const matchSrc = fSource === F_SOURCE[0] || d.sourceName === fSource
    const matchPerson = fPerson === F_PERSON[0] || d.person === fPerson
    const matchType = fMore === F_MORE[0] || DOC_TYPE_META[d.type].label === fMore
    return matchQ && matchSrc && matchPerson && matchType && inDateRange(d.modified)
  })

  const renderRow = (d: DocResult, i: number) => {
    const qStr = query.trim()
    return (
      <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
        {/* 좌측 = 파일 형식 썸네일 */}
        <FileThumb d={d} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{qStr ? <Highlight text={d.title} query={qStr} /> : d.title}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 5 }}>
            {qStr
              ? <Highlight text={d.snip.pre + d.snip.hi + d.snip.post} query={qStr} />
              : <>{d.snip.pre}<mark style={MARK_STYLE}>{d.snip.hi}</mark>{d.snip.post}</>}
          </div>
          {/* 메타 = 소스 브랜드 로고 + 소스명 · 폴더 · (수정일/발언자·시각) */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: 'inherit' }}>
            <MiniLogo logoKey={d.logoKey} kind={d.logoKind} size={16} />
            <span>{d.sourceName} · {d.folder}</span>
            <span>·</span>
            {d.type === 'meeting' && d.person
              ? <span>{d.person} · {d.modified}{d.ts ? ` ${d.ts}` : ''}</span>
              : <span>수정 {d.modified}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => { setAnswerDoc(d); showToast('지식봇에게 Slack DM으로 질문을 보냈어요.') }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '7px 16px', borderRadius: 'var(--radius-full)', border: 'none',
              background: 'var(--color-accent-muted)', color: 'var(--color-accent)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <AstryxIcon icon={MessageSquare} size="xsm" color="inherit" strokeWidth={2} />질문
          </button>
        </div>
      </div>
    )
  }

  return (
    <VStack gap={4} style={{ padding: '32px 40px' }}>

      {/* 헤딩 */}
      <VStack gap={1}>
        <Heading level={2}>지식 검색</Heading>
        <Text type="supporting" color="secondary">파일·문서·과거 팀 메시지를 한 번에 검색하고, 링크가 아니라 근거와 함께 답을 받습니다.</Text>
      </VStack>

      {/* 검색바 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <SearchBar value={query} onChange={setQuery} onSubmit={() => runSearch()} placeholder="무엇이든 검색 (예: 부가세 마감일, 협업 흐름 승인)" />
        <Button label="검색" variant="primary" onClick={() => runSearch()} />
      </div>

      {/* 패싯 필터 (소스 · 사람 · 수정일[캘린더] · 더보기) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FilterDropdown label="소스" options={[...F_SOURCE]} value={fSource} onChange={setFSource} />
        <FilterDropdown label="사용자" options={[...F_PERSON]} value={fPerson} onChange={setFPerson} />
        <DateRangePill value={dateRange} onChange={setDateRange} />
        <FilterDropdown label="더보기" options={[...F_MORE]} value={fMore} onChange={setFMore} />
        {anyFilter && (
          <button
            onClick={resetFilters}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
              height: 40, padding: '0 14px', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)', background: 'var(--color-background-surface)',
              fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />
            필터 초기화
          </button>
        )}
      </div>

      {/* 옅은 경계 캡션 */}
      <Text type="supporting" color="secondary">에이전트와의 업무·긴 대화는 메신저에서 이어집니다.</Text>

      {!showResults ? (
        /* 검색 전 — 최근 검색 결과 (문서 행 리스트) */
        <VStack gap={3}>
          <SectionLabel text="최근 검색 결과" />
          <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
            {DOC_RESULTS.slice(0, 4).map((d, i) => renderRow(d, i))}
          </div>
        </VStack>
      ) : (
        <VStack gap={3}>
          {/* [질문] 시 답 + 출처 미리보기 (상단) */}
          {answerDoc && (
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', padding: 20, background: 'var(--color-background-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PlatformLogo platform="slack" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>Slack 지식봇에서 이어집니다</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>아래는 콘솔 미리보기 · “{answerDoc.title}”</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', background: 'var(--color-accent-muted)', padding: '3px 8px', borderRadius: 'var(--radius-full)', flexShrink: 0, fontFamily: 'inherit' }}>미리보기</span>
                <button onClick={() => setAnswerDoc(null)} style={iconGhost}><AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} /></button>
              </div>
              <div style={{ fontSize: 15, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1.65, marginBottom: 14 }}>
                {ANSWER.text}
              </div>
              <SectionLabel text="출처" />
              <VStack gap={2}>
                {ANSWER.citations.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-background-muted)',
                  }}>
                    <AstryxIcon icon={FileText} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.doc}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>{c.source} · {c.loc}</div>
                    </div>
                  </div>
                ))}
              </VStack>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <button onClick={() => showToast('Slack DM을 여는 중… (데모)')} style={primaryBtn}>
                  <AstryxIcon icon={MessageSquare} size="xsm" color="inherit" strokeWidth={2} />Slack에서 이어가기
                  <AstryxIcon icon={ArrowUpRight} size="xsm" color="inherit" strokeWidth={2} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>긴 업무·후속 대화는 Slack에서 이어집니다.</span>
              </div>
            </div>
          )}

          {/* 결과 리스트 (혼합 타입, 구분선 행) */}
          <SectionLabel text={`${results.length}개 결과`} />
          {results.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'inherit', border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-element)' }}>
              결과 없음 — 검색어나 필터를 바꿔보세요.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
              {results.map((d, i) => renderRow(d, i))}
            </div>
          )}
        </VStack>
      )}

      {/* ── 전송 토스트 (Slack 핸드오프 피드백) ── */}
      {toast && createPortal(
        <div style={{
          position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 10000,
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px 12px 16px', borderRadius: 12,
          background: '#1f2430', color: '#fff', boxShadow: 'var(--shadow-med)', maxWidth: '92vw',
        }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PlatformLogo platform="slack" size={15} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>{toast}</span>
          <button onClick={() => showToast('Slack DM을 여는 중… (데모)')}
            style={{ background: 'none', border: 'none', color: '#7db8ff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>열기</button>
          <button onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, color: '#9aa4b2' }}>
            <AstryxIcon icon={X} size="xsm" color="inherit" strokeWidth={2} />
          </button>
        </div>,
        document.body
      )}
    </VStack>
  )
}
