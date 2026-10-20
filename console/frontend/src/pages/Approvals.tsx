import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Banner } from '@astryxdesign/core/Banner'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'
import { FileText, Send, Trash2, Database, Lock, ChevronRight } from 'lucide-react'
import { SearchBar } from '../components/SearchBar'
import { FilterDropdown } from '../components/FilterDropdown'
import { ReviewTabs } from '../components/ReviewTabs'
import { AgentIconBadge } from '../utils/agentIcon'

/* ─────────────────────────────────────────────────────────────────
 * 승인 게이트 — 돌이키기 어려운 작업은 사람이 승인해야 진행된다.
 *
 * 경계(2026-10-18 기획팀 합의): 콘솔 = 대기 건 확인·기록 열람.
 *       승인·반려는 메신저 스레드에서 지정 승인자가 '승인' 또는 '반려: 사유'로 답한다
 *       (approval_policy.py — 승인자는 메신저 사용자 ID로 확인). 콘솔에는 승인 버튼을 두지 않는다.
 * 주의: "고위험" 판정 기준·임계치는 미확정(D-29)이라 화면에 쓰지 않는다.
 *       화면 문구는 "돌이키기 어려운 작업"까지만.
 * 데이터: 프로토타입 목업(프론트 로컬 상태). 백엔드 데이터 파일 변경 없음.
 * ───────────────────────────────────────────────────────────────── */

type ApprovalStatus = 'pending' | 'approved' | 'rejected'
type ApprovalKind = 'file' | 'send' | 'delete' | 'external'

interface HistoryEntry {
  label: string
  actor: string
  at: string
  tone?: 'normal' | 'decision'
}

interface ApprovalRequest {
  id: string
  title: string
  kind: ApprovalKind
  summary: string
  agentName: string
  agentIcon: string
  requestedAt: string
  scope: { label: string; value: string }[]
  status: ApprovalStatus
  approver?: string
  decidedAt?: string
  history: HistoryEntry[]
  hasPreview?: boolean
}

const KIND_META: Record<ApprovalKind, { label: string; Icon: IconType }> = {
  file:     { label: '파일 변경',     Icon: FileText },
  send:     { label: '외부 발송',     Icon: Send },
  delete:   { label: '일괄 삭제',     Icon: Trash2 },
  external: { label: '외부 시스템 반영', Icon: Database },
}

const STATUS_META: Record<ApprovalStatus, { label: string; dot: string }> = {
  pending:  { label: '승인 대기', dot: 'var(--color-icon-orange)' },
  approved: { label: '승인됨',   dot: 'var(--color-status-active)' },
  rejected: { label: '반려됨',   dot: 'var(--color-error)' },
}

/** 지정 승인자 — 프로토타입 표기용 가상 인물 */
const APPROVER = '김지훈 매니저'

const INITIAL_REQUESTS: ApprovalRequest[] = [
  {
    id: 'ap-01',
    title: '3분기 사업계획 초안 수정',
    kind: 'file',
    summary: '기존 계획 파일의 목표 수치 5곳을 새 초안 값으로 바꿉니다.',
    agentName: '기획 어시스턴트', agentIcon: '📋',
    requestedAt: '2026-07-27 14:02',
    scope: [
      { label: '대상',     value: '2026_3분기_사업계획.xlsx' },
      { label: '위치',     value: '공유 드라이브 · 전략기획 > 2026 계획' },
      { label: '변경 범위', value: '시트 1개 · 셀 5곳' },
    ],
    status: 'pending',
    history: [{ label: '승인 요청 생성', actor: '기획 어시스턴트', at: '2026-07-27 14:02' }],
    hasPreview: true,
  },
  {
    id: 'ap-02',
    title: '분기 검토 요청 메일 발송',
    kind: 'send',
    summary: '작성된 검토 요청 메일을 수신자에게 한 번에 보냅니다. 보내고 나면 회수할 수 없습니다.',
    agentName: '메일 도우미', agentIcon: '✉️',
    requestedAt: '2026-07-27 11:40',
    scope: [
      { label: '대상',   value: '사내 수신자 12명' },
      { label: '첨부',   value: '3분기_검토요청.pdf 1개' },
      { label: '발송 방식', value: '즉시 1회 발송' },
    ],
    status: 'pending',
    history: [{ label: '승인 요청 생성', actor: '메일 도우미', at: '2026-07-27 11:40' }],
  },
  {
    id: 'ap-03',
    title: '임시 작업 폴더 정리',
    kind: 'delete',
    summary: '지난 분기 임시 폴더의 작업 파일을 지웁니다. 삭제한 파일은 되돌리기 어렵습니다.',
    agentName: '파일 정리봇', agentIcon: '📂',
    requestedAt: '2026-07-26 18:15',
    scope: [
      { label: '대상',   value: '임시작업 > 2026Q2' },
      { label: '삭제 범위', value: '폴더 1개 · 파일 24개' },
      { label: '보관 여부', value: '휴지통 이동 없음' },
    ],
    status: 'pending',
    history: [{ label: '승인 요청 생성', actor: '파일 정리봇', at: '2026-07-26 18:15' }],
  },
  {
    id: 'ap-04',
    title: '거래처 연락처 일괄 업데이트',
    kind: 'external',
    summary: '정리된 연락처를 외부 관리 시스템에 한 번에 반영합니다.',
    agentName: '영업 지원봇', agentIcon: '🏢',
    requestedAt: '2026-07-26 09:12',
    scope: [
      { label: '대상',   value: '거래처 관리 시스템' },
      { label: '반영 범위', value: '레코드 38건' },
      { label: '반영 방식', value: '일괄 덮어쓰기' },
    ],
    status: 'approved',
    approver: APPROVER,
    decidedAt: '2026-07-26 09:31',
    history: [
      { label: '승인 요청 생성', actor: '영업 지원봇', at: '2026-07-26 09:12' },
      { label: '승인', actor: APPROVER, at: '2026-07-26 09:31', tone: 'decision' },
      { label: '작업 실행 완료', actor: '영업 지원봇', at: '2026-07-26 09:33' },
    ],
  },
  {
    id: 'ap-05',
    title: '외부 공유 링크 생성',
    kind: 'send',
    summary: '분기 실적 자료를 사외에서 열람할 수 있는 링크로 공개합니다.',
    agentName: '문서 도우미', agentIcon: '📄',
    requestedAt: '2026-07-25 16:48',
    scope: [
      { label: '대상',   value: '3분기_실적요약.pdf' },
      { label: '공개 범위', value: '링크가 있는 누구나' },
      { label: '만료',   value: '설정 없음' },
    ],
    status: 'rejected',
    approver: APPROVER,
    decidedAt: '2026-07-25 17:05',
    history: [
      { label: '승인 요청 생성', actor: '문서 도우미', at: '2026-07-25 16:48' },
      { label: '반려', actor: APPROVER, at: '2026-07-25 17:05', tone: 'decision' },
    ],
  },
]

const STATUS_FILTER = ['전체', '승인 대기', '승인됨', '반려됨'] as const
type StatusFilter = typeof STATUS_FILTER[number]

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
  letterSpacing: '0.06em', textTransform: 'uppercase',
  fontFamily: 'inherit', marginBottom: 8,
}

/** 되돌리기 어려운 작업 배지 — 판정 기준·임계치는 표기하지 않는다(D-29 미확정). */
function IrreversibleBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px 2px 7px', borderRadius: 'var(--radius-full)',
      background: 'var(--color-warning-muted)',
      border: '1px solid var(--color-warning-muted)',
      color: 'var(--color-warning)',
      fontSize: 11, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>
      <AstryxIcon icon={Lock} size="xsm" color="inherit" strokeWidth={2.2} />
      돌이키기 어려운 작업
    </span>
  )
}

function StatusPill({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_META[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
    </span>
  )
}

export default function Approvals() {
  const navigate = useNavigate()
  const [requests] = useState<ApprovalRequest[]>(INITIAL_REQUESTS)
  const [selectedId, setSelectedId] = useState<string>('ap-01')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체')
  const [search, setSearch] = useState('')

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const visible = useMemo(() => {
    let list = requests
    if (statusFilter !== '전체') {
      const want: ApprovalStatus = statusFilter === '승인 대기' ? 'pending' : statusFilter === '승인됨' ? 'approved' : 'rejected'
      list = list.filter(r => r.status === want)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
      )
    }
    return list
  }, [requests, statusFilter, search])

  const selected = requests.find(r => r.id === selectedId) ?? visible[0] ?? null

  // 프로토타입: 실제 스레드 링크가 없어 메신저 앱을 연다.
  const openThread = () => window.open('https://app.slack.com/client', '_blank', 'noopener')


  return (
    <VStack gap={5} style={{ padding: '32px 40px' }}>

      {/* ① 헤더 */}
      <VStack gap={1}>
        <Heading level={2}>검토 · 승인</Heading>
        <Text type="supporting" color="secondary">
          돌이키기 어려운 작업은 사용자가 승인해야 진행됩니다. 승인 전까지 에이전트는 기다립니다.
        </Text>
      </VStack>

      {/* ② 상위 탭 */}
      <ReviewTabs active="approvals" pendingCount={pendingCount} />

      {/* ③ 필터 + 검색 */}
      <div className="m-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FilterDropdown
          label="상태"
          options={[...STATUS_FILTER]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="작업 이름, 요청한 에이전트 검색..."
        />
      </div>

      {/* ④ 좌: 대기 목록 / 우: 상세 — 좁은 화면에서는 위아래로 쌓는다(mobile.css) */}
      <div className="m-split" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── 목록 ── */}
        <div className="m-split__list" style={{
          width: 380, flexShrink: 0,
          border: '1px solid var(--color-border-emphasized)',
          borderRadius: 'var(--radius-element)', overflow: 'hidden',
          background: 'var(--color-background-surface)',
        }}>
          {visible.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
              조건에 맞는 요청이 없습니다.
            </div>
          ) : visible.map((r, i) => {
            const kind = KIND_META[r.kind]
            const on = selected?.id === r.id
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                  padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                  fontFamily: 'inherit', border: 'none',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  background: on ? 'var(--color-background-muted)' : 'transparent',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1,
                  background: 'var(--color-background-muted)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AstryxIcon icon={kind.Icon} size="sm" color="secondary" strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {kind.label} · {r.agentName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusPill status={r.status} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', fontFamily: 'inherit' }}>{r.requestedAt}</span>
                  </div>
                </div>
                <AstryxIcon icon={ChevronRight} size="sm" color="secondary" style={{ flexShrink: 0, marginTop: 8 }} />
              </button>
            )
          })}
        </div>

        {/* ── 상세 ── */}
        {selected && (
          <div className="m-split__detail" style={{
            flex: 1, minWidth: 0,
            border: '1px solid var(--color-border-emphasized)',
            borderRadius: 'var(--radius-element)',
            background: 'var(--color-background-surface)',
            padding: 24,
          }}>
            {/* 제목 줄 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <AgentIconBadge emoji={selected.agentIcon} boxSize={44} iconSize={20} radius={12} mono />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                    {selected.title}
                  </span>
                  <StatusPill status={selected.status} />
                  <IrreversibleBadge />
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                  {selected.summary}
                </div>
              </div>
            </div>

            {/* 승인 대기 안내 — 결정은 메신저에서. 판정 기준은 쓰지 않는다 */}
            {selected.status === 'pending' && (
              <div style={{ marginBottom: 20 }}>
                <Banner
                  status="warning"
                  title="메신저 응답 대기 · 아직 실행되지 않았습니다"
                  description="승인·반려는 메신저 스레드에서 지정 승인자가 '승인' 또는 '반려: 사유'로 답합니다. 콘솔에서는 내용과 기록만 확인합니다."
                />
              </div>
            )}

            {/* 결정 결과 */}
            {selected.status !== 'pending' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', borderRadius: 10, marginBottom: 20,
                background: 'var(--color-background-muted)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[selected.status].dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                  {STATUS_META[selected.status].label} · {selected.approver} · {selected.decidedAt}
                </span>
              </div>
            )}

            {/* 요청 정보 */}
            <div style={SECTION_LABEL}>요청 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
              {[
                { label: '작업 종류',   value: KIND_META[selected.kind].label },
                { label: '요청한 에이전트', value: selected.agentName },
                { label: '요청 시각',   value: selected.requestedAt },
                { label: '지정 승인자', value: APPROVER },
                ...selected.scope,
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', wordBreak: 'break-all' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* 파일 변경 건 → 쓰기 전 미리보기로 이동 */}
            {selected.hasPreview && (
              <div style={{ marginBottom: 22 }}>
                <button
                  onClick={() => navigate('/approvals/preview')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-emphasized)',
                    background: 'var(--color-background-surface)',
                    fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <AstryxIcon icon={FileText} size="xsm" color="secondary" strokeWidth={2} />
                  바뀔 내용 보기 (쓰기 전 미리보기)
                </button>
              </div>
            )}

            {/* 승인 이력 */}
            <div style={SECTION_LABEL}>승인 이력</div>
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: 10,
              overflow: 'hidden', marginBottom: 8,
            }}>
              {selected.history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: h.tone === 'decision' ? 'var(--color-warning)' : 'var(--color-border-emphasized)',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', minWidth: 96, flexShrink: 0 }}>
                    {h.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.actor}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flexShrink: 0 }}>
                    {h.at}
                  </span>
                </div>
              ))}
            </div>
            <Text type="supporting" color="secondary">
              누가 · 언제 승인했는지 그대로 남습니다. 이력은 고치거나 지울 수 없습니다.
            </Text>

            {/* 결정은 메신저에서 — 스레드로 이동 */}
            {selected.status === 'pending' && (
              <>
                <div style={{ height: 1, background: 'var(--color-border)', margin: '22px 0 18px' }} />
                <HStack gap={3} vAlign="center" style={{ flexWrap: 'wrap' }}>
                  <Button label="메신저 스레드 열기" variant="primary" size="lg" style={{ paddingInline: 22 }} onClick={openThread} />
                  <Text type="supporting" color="secondary">
                    결정은 메신저 스레드에서 지정 승인자가 답합니다. 결과는 이 이력에 그대로 남습니다.
                  </Text>
                </HStack>
              </>
            )}
          </div>
        )}
      </div>
    </VStack>
  )
}
