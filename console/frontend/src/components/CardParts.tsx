/* ── 목록 카드 공통 부품 — 내 에이전트·팀 에이전트가 같은 규칙을 쓴다 ──
 * 머리(아이콘·이름·직무) → 설명 → 정보 줄(채널 칩 + 배지) → 하단(7일 실행·마지막 실행)
 */
import type { ReactNode } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { RESULT_LABEL, type AgentDemoOps, type RunResult } from '../data/agentDemoOps'

/** 7일 실행 막대 — 오늘만 진하게 */
export function MiniBars({ data, width, height }: { data: number[]; width: number; height: number }) {
  const max = Math.max(1, ...data)
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 3, width, height, flexShrink: 0 }}>
      {data.map((v, i) => (
        <span key={i} style={{
          flex: 1, borderRadius: 2, height: v === 0 ? 2 : Math.max(3, (v / max) * height),
          background: 'var(--color-text-primary)', opacity: i === data.length - 1 ? 1 : 0.22,
        }} />
      ))}
    </div>
  )
}

/** 배치 채널 칩 — 배치됨(초록 점 + 채널명) / 미배치(회색 점) */
export function ChannelChip({ channel }: { channel?: string | null }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, maxWidth: 170,
      height: 22, padding: '0 10px 0 8px', boxSizing: 'border-box',
      borderRadius: 'var(--radius-full)', background: 'var(--color-background-surface)',
      border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)',
      fontSize: 12, fontWeight: channel ? 500 : 400, fontFamily: 'inherit',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: channel ? 'var(--color-status-active)' : 'var(--color-border-emphasized)' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel || '미배치'}</span>
    </span>
  )
}

/** 카드 하단 — 마지막 실행 결과만(7일 실행 내역은 개요에서 본다) */
export function RunFooter({ ops }: { ops: AgentDemoOps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>마지막 실행</span>
      <ResultBadge result={ops.lastRun.result} />
    </div>
  )
}

const RESULT_VARIANT: Record<RunResult, 'neutral' | 'yellow'> = { approved: 'neutral', auto: 'neutral', awaiting: 'yellow' }

/** 마지막 실행 결과 배지 — 승인 완료·자동 완료(회색) · 승인 대기(노랑) */
export function ResultBadge({ result }: { result: RunResult }) {
  return <Badge variant={RESULT_VARIANT[result]} label={RESULT_LABEL[result]} />
}

/** 요약 숫자 카드 — Astryx Card(배경 card, 라운드 20) 톤. onClick이 있으면 누를 수 있다 */
export function KpiCard({ label, value, unit, tone, chart, onClick }: {
  label: string; value: string | number; unit?: string; tone?: 'yellow'; chart?: ReactNode; onClick?: () => void
}) {
  const yellow = tone === 'yellow'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} style={{
      flex: '1 1 200px', minWidth: 0, padding: '16px 18px', borderRadius: 20, border: 'none', textAlign: 'left',
      background: yellow ? 'var(--color-background-yellow)' : 'var(--color-background-card)',
      display: 'flex', flexDirection: 'column', gap: 10, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: yellow ? 'var(--color-text-yellow)' : 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, width: '100%' }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: yellow ? 'var(--color-text-yellow)' : 'var(--color-text-primary)' }}>{value}</span>
          {unit && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{unit}</span>}
        </span>
        {chart && <span className="kpi-chart" style={{ flexShrink: 0 }}>{chart}</span>}
      </span>
    </Tag>
  )
}
