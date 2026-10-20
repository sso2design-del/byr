import { useNavigate } from 'react-router-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Banner } from '@astryxdesign/core/Banner'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { FileSpreadsheet, FileText, ArrowLeft, ArrowRight, ChevronRight, History } from 'lucide-react'
import { ReviewTabs } from '../components/ReviewTabs'

/* ─────────────────────────────────────────────────────────────────
 * 쓰기 전 미리보기 — 에이전트가 파일을 바꾸기 전에 바뀔 셀과 값을 먼저 보여준다.
 *
 * 역할(2026-10-18 기획팀 합의): 콘솔은 넓은 화면에서 바뀔 내용을 확인하는 곳이다.
 *   승인·반려는 메신저 스레드에서 지정 승인자가 '승인' 또는 '반려: 사유'로 답한다
 *   (approval_policy.py — 승인자는 메신저 사용자 ID로 확인). 그래서 이 화면에는
 *   승인 버튼을 두지 않고, 메신저 스레드로 가는 버튼 하나만 둔다.
 * 정책(확정): 확인 없이 직접 쓰지 않는다. 초안만 만들고 원본은 그대로 둔다.
 * 주의: "고위험" 판정 기준·임계치는 미확정(D-29)이라 화면에 쓰지 않는다.
 * 데이터: 프로토타입 목업. 백엔드 데이터 파일 변경 없음.
 * ───────────────────────────────────────────────────────────────── */

const TARGET = {
  file: '2026_3분기_사업계획.xlsx',
  sheet: 'Sheet1 (분기 목표)',
  location: '공유 드라이브 › 전략기획 › 2026 계획',
  agent: '기획 어시스턴트',
  requestedAt: '2026-07-27 14:02',
  channel: '#기획팀',
}

/** 지정 승인자 — 프로토타입 표기용 가상 인물 */
const REVIEWER = '김지훈 매니저'

type Change = 'up' | 'down' | 'new' | 'renew'
interface CellDiff {
  cell: string
  field: string
  before: string
  after: string
  delta: string
  change: Change
  basis: string[]
}

const DIFF: CellDiff[] = [
  { cell: 'D12', field: '3분기 매출 목표',  before: '1.2억',       after: '1.45억',     delta: '+20.8%', change: 'up',    basis: ['3분기 영업회의록 07-24', '파이프라인 현황'] },
  { cell: 'D13', field: '신규 계약 목표',   before: '40건',        after: '46건',       delta: '+15.0%', change: 'up',    basis: ['파이프라인 현황'] },
  { cell: 'E12', field: '목표 달성률 기준', before: '95%',         after: '92%',        delta: '−3.0%p', change: 'down',  basis: ['목표 설정 가이드 v2'] },
  { cell: 'F4',  field: '검토 담당',       before: '(비어 있음)', after: '전략기획팀', delta: '신규',   change: 'new',   basis: ['조직도 2026-07'] },
  { cell: 'F5',  field: '갱신일',          before: '2026-04-02',  after: '2026-07-27', delta: '갱신',   change: 'renew', basis: ['자동 기입'] },
]

const AUDIT: { at: string; label: string; current?: boolean }[] = [
  { at: '14:02', label: '요청 접수' },
  { at: '14:03', label: '참조 문서 4건' },
  { at: '14:04', label: '초안 생성' },
  { at: '대기', label: `승인 대기 · 메신저(${TARGET.channel})`, current: true },
]

const DELTA_VARIANT = { up: 'green', down: 'red', new: 'neutral', renew: 'neutral' } as const

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', whiteSpace: 'nowrap',
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
  borderBottom: '1px solid var(--color-border)',
}
const TD: React.CSSProperties = {
  padding: '12px', verticalAlign: 'middle',
  borderBottom: '1px solid var(--color-border)', fontFamily: 'inherit',
}

function Person({ name, role }: { name: string; role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar name={name.split(' ')[0]} size={32} />
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{role}</div>
      </div>
    </div>
  )
}

export default function WritePreview() {
  const navigate = useNavigate()
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
      <ReviewTabs active="preview" />

      <div style={{ maxWidth: 1100, width: '100%' }}>

        {/* ③ 경로 — 승인 대기 목록으로 돌아가기 */}
        <button
          onClick={() => navigate('/approvals')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
            fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
          }}
        >
          <AstryxIcon icon={ArrowLeft} size="xsm" color="secondary" strokeWidth={2} />
          검토 · 승인
          <AstryxIcon icon={ChevronRight} size="xsm" color="secondary" strokeWidth={2} />
          <span style={{ color: 'var(--color-text-primary)' }}>쓰기 전 미리보기</span>
        </button>

        {/* ④ 제목 + 요청자 → 승인자 */}
        <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Heading level={3}>3분기 사업계획 초안 수정</Heading>
            <Badge variant="yellow" label="메신저 응답 대기" />
            <Badge variant="neutral" label="돌이키기 어려운 작업" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Person name={TARGET.agent} role={`요청 · ${TARGET.requestedAt.slice(11)}`} />
            <AstryxIcon icon={ArrowRight} size="sm" color="secondary" strokeWidth={2} />
            <Person name={REVIEWER} role="지정 승인자" />
          </div>
        </div>

        {/* ⑤ 바뀔 파일 */}
        <div className="m-wrap" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px', borderRadius: 12, marginBottom: 16,
          background: 'var(--color-background-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'var(--color-background-green)', color: 'var(--color-text-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AstryxIcon icon={FileSpreadsheet} size="md" color="inherit" strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{TARGET.file}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>{TARGET.location} · {TARGET.sheet}</div>
            </div>
          </div>
          <Badge variant="green" label="원본 유지 · 새 버전으로 저장" />
        </div>

        {/* ⑥ 상태 — 결정은 메신저에서 */}
        <div style={{ marginBottom: 16 }}>
          <Banner
            status="warning"
            title={`메신저 응답 대기 · 셀 ${DIFF.length}곳 변경 초안`}
            description="아직 반영되지 않았습니다. 승인·반려는 메신저 스레드에서 지정 승인자가 '승인' 또는 '반려: 사유'로 답합니다."
          />
        </div>

        {/* ⑦ 셀 단위 전후 비교 */}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 112 }}>셀 위치</th>
                <th style={{ ...TH, width: 150 }}>항목</th>
                <th style={TH}>기존 값 → 변경 후</th>
                <th style={{ ...TH, width: 90 }}>변화</th>
                <th style={TH}>변경 근거</th>
              </tr>
            </thead>
            <tbody>
              {DIFF.map((d, i) => (
                <tr key={d.cell} style={{ background: i % 2 === 1 ? 'var(--color-background-muted)' : undefined }}>
                  <td style={TD}><Badge variant="neutral" label={`Sheet1!${d.cell}`} /></td>
                  <td style={{ ...TD, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.field}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <Badge variant="red" label={<span style={{ textDecoration: 'line-through' }}>{d.before}</span>} />
                      <AstryxIcon icon={ArrowRight} size="xsm" color="secondary" strokeWidth={2} />
                      <Badge variant="green" label={<strong>{d.after}</strong>} />
                    </div>
                  </td>
                  <td style={TD}><Badge variant={DELTA_VARIANT[d.change]} label={d.delta} /></td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {d.basis.map(b => (
                        <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          <AstryxIcon icon={FileText} size="xsm" color="secondary" strokeWidth={2} />
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ⑧ 감사 기록 + 메신저로 이동 */}
        <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
              <AstryxIcon icon={History} size="xsm" color="secondary" strokeWidth={2} />
              감사 기록 · 수정 불가
            </span>
            {AUDIT.map(a => (
              <span key={a.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.current ? 'var(--color-warning)' : 'var(--color-border-emphasized)' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>{a.at}</span>
                <span style={{ fontWeight: 600, color: a.current ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>{a.label}</span>
              </span>
            ))}
          </div>
          <Button label="메신저 스레드 열기" variant="primary" size="lg" style={{ paddingInline: 22 }} onClick={openThread} />
        </div>
      </div>
    </VStack>
  )
}
