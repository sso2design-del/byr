import React from 'react'
import { useNavigate } from 'react-router-dom'

/* ── 검토·승인 상위 탭 ───────────────────────────────────────────
 * 두 화면(승인 대기 / 쓰기 전 미리보기)이 같은 섹션임을 보여주는 공용 탭.
 * 내 에이전트(AgentList)의 상위 탭과 동일 규격(필 모양·7px 18px).
 * 각 탭은 독립 URL이라 바로 접근·공유·캡처가 된다.
 */

export type ReviewTabKey = 'approvals' | 'preview'

const TABS: [ReviewTabKey, string, string][] = [
  ['approvals', '승인 대기', '/approvals'],
  ['preview',   '쓰기 전 미리보기', '/approvals/preview'],
]

export function ReviewTabs({ active, pendingCount }: { active: ReviewTabKey; pendingCount?: number }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {TABS.map(([key, label, path]) => {
        const on = active === key
        return (
          <button
            key={key}
            onClick={() => navigate(path)}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: on ? 'var(--color-background-muted)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: on ? 600 : 400,
              color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {label}
            {key === 'approvals' && (pendingCount ?? 0) > 0 && (
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 'var(--radius-full)',
                background: on ? 'rgba(0,0,0,0.1)' : 'var(--color-background-muted)',
                fontSize: 12, fontWeight: 600,
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
