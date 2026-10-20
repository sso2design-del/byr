import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { CalendarClock, Trash2 } from 'lucide-react'
import { ModalCloseButton, ModalFooter, MODAL_BUTTON_STYLE } from './ModalComponents'
import { type Team, type TeamFlow, formatSchedule } from '../utils/teamFlow'

// 내 에이전트 상세의 스케줄(routine) 주기 설정과 동일한 UI 패턴을 흐름 트리거에 재사용.
// 설정 결과는 해당 흐름의 trigger(type=schedule)로 저장(PUT update_flow 재사용).

interface Props {
  teamId: string
  flow: TeamFlow
  onClose: () => void
  onSaved: (team: Team) => void
}

type Freq = 'daily' | 'weekly' | 'monthly'

// 실행 시각 옵션 (30분 단위) — RoutineWizard와 동일 규격
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const hh = String(h).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${hh}:${m}`, label: `${ampm} ${h12}:${m}` }
})

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function PillBtn({ label, active, onClick, width }: { label: string; active: boolean; onClick: () => void; width?: number | string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: width ? '8px 0' : '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 14,
        width, minWidth: width ? undefined : 'auto',
        border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--color-on-accent)' : 'var(--color-text-primary)',
        fontWeight: active ? 600 : 400, fontFamily: 'inherit', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

const subLabel = (text: string) => (
  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, fontFamily: 'inherit' }}>{text}</div>
)

export default function FlowScheduleDialog({ teamId, flow, onClose, onSaved }: Props) {
  const t = flow.trigger
  const hadSchedule = t.type === 'schedule'

  const [frequency, setFrequency] = useState<Freq>(t.frequency ?? 'weekly')
  const [dayOfWeek, setDayOfWeek] = useState(t.dayOfWeek ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState(t.dayOfMonth ?? 1)
  const [timeVal, setTimeVal] = useState(t.time ?? '09:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const put = async (trigger: TeamFlow['trigger']) => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: flow.name,
          description: flow.description,
          trigger,
          steps: flow.steps.map(s => ({ agent_id: s.agent_id, task: s.task, high_risk: s.high_risk })),
        }),
      })
      if (!res.ok) throw new Error()
      onSaved(await res.json() as Team)
    } catch {
      setError('저장에 실패했습니다.')
      setSaving(false)
    }
  }

  const handleSave = () => {
    const config = formatSchedule(frequency, dayOfWeek, dayOfMonth, timeVal)
    put({ type: 'schedule', config, frequency, dayOfWeek, dayOfMonth, time: timeVal })
  }
  const handleRemove = () => {
    put({ type: 'messenger', config: '메신저 채널에서 이 흐름을 호출하면 시작합니다.' })
  }

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: 480, maxWidth: '100%', maxHeight: '85vh',
        background: 'var(--color-background-surface)', borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AstryxIcon icon={CalendarClock} size="xsm" color="secondary" strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  {hadSchedule ? '스케줄 편집' : '스케줄 추가'}
                </div>
                <Heading level={3}>{flow.name}</Heading>
              </div>
            </div>
            <ModalCloseButton onClose={onClose} />
          </div>
        </div>

        {/* 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <VStack gap={4}>
            <Text type="supporting" color="secondary">정해진 주기에 이 흐름이 자동으로 실행됩니다. 실제 실행·승인은 메신저에서 이뤄집니다.</Text>

            {/* 실행 주기 */}
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <PillBtn label="매일" active={frequency === 'daily'} onClick={() => setFrequency('daily')} />
                <PillBtn label="매주" active={frequency === 'weekly'} onClick={() => setFrequency('weekly')} />
                <PillBtn label="매월" active={frequency === 'monthly'} onClick={() => setFrequency('monthly')} />
              </div>

              {frequency === 'weekly' && (
                <div style={{ marginBottom: 16 }}>
                  {subLabel('요일')}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {DOW_LABELS.map((d, i) => (
                      <PillBtn key={i} label={d} active={dayOfWeek === i + 1} onClick={() => setDayOfWeek(i + 1)} width={36} />
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'monthly' && (
                <div style={{ marginBottom: 16 }}>
                  {subLabel('날짜')}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '0 16px', height: 40, borderRadius: 999,
                      border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', width: 'fit-content',
                    }}>
                      <input
                        type="number" min={1} max={31} value={dayOfMonth}
                        onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                        style={{ width: 36, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>일</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>1 – 31 입력</span>
                  </div>
                </div>
              )}

              <div style={{ maxWidth: 160 }}>
                {subLabel('실행 시각')}
                <Selector
                  label="실행 시각"
                  isLabelHidden
                  value={timeVal}
                  onChange={v => setTimeVal((v as string) ?? '09:00')}
                  options={TIME_OPTIONS}
                />
              </div>
            </div>

            {/* 미리보기 */}
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AstryxIcon icon={CalendarClock} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <Text type="supporting" color="secondary">{formatSchedule(frequency, dayOfWeek, dayOfMonth, timeVal)}</Text>
            </div>
          </VStack>
        </div>

        {/* 푸터 */}
        <ModalFooter
          leftAction={hadSchedule
            ? (
              <button
                onClick={saving ? undefined : handleRemove}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-error)', background: 'transparent',
                  fontSize: 13, fontWeight: 500, color: 'var(--color-error)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <AstryxIcon icon={Trash2} size="xsm" color="error" strokeWidth={2} />
                스케줄 제거
              </button>
            )
            : undefined
          }
        >
          {error && <span style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>{error}</span>}
          <Button label="취소" variant="secondary" size="lg" style={MODAL_BUTTON_STYLE} onClick={onClose} />
          <Button label={saving ? '저장 중...' : '저장'} variant="primary" size="lg" style={MODAL_BUTTON_STYLE} isDisabled={saving} onClick={handleSave} />
        </ModalFooter>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
