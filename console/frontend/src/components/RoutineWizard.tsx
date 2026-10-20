import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, ChevronRight, Check, CalendarClock } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Switch } from '@astryxdesign/core/Switch'
import { Selector } from '@astryxdesign/core/Selector'
import { AgentIconBadge } from '../utils/agentIcon'
import { SKILL_CATALOG } from '../utils/skillCatalog'
import { getSubOpts } from '../utils/skillSubOptions'
import type { SubOption } from '../utils/skillSubOptions'

// 직무별 기본 스킬 키 (에이전트 선택 시 초기 선택 상태)
const JOB_DEFAULT_SKILL_KEYS: Record<string, string[]> = {
  vat_reconcile:       ['file', 'analysis', 'report'],
  insurance_fp:        ['file', 'analysis', 'report', 'web'],
  securities_research: ['file', 'analysis', 'report', 'web'],
  compliance_aml:      ['file', 'analysis', 'report'],
  hr:                  ['file', 'analysis', 'report'],
  pm_brief:            ['file', 'analysis', 'report', 'web'],
  dev_incident:        ['file', 'analysis', 'report'],
  blank:               ['file', 'analysis', 'report'],
}

export interface AgentOption {
  id: string; name: string; icon: string; role: string; job?: string | null
}

export interface ScheduleTemplateValues {
  name: string
  message: string
  frequency: 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number
  dayOfMonth?: number
  timeVal?: string
  deliveryType?: 'dm' | 'channel'
  recipient?: string
}

export interface RoutineDef {
  id: string; name: string
  agentId: string; agentName: string; agentIcon: string
  initialMessage: string
  frequency: 'daily' | 'weekly' | 'monthly'
  dayOfWeek: number; dayOfMonth: number
  hour: number; minute: number
  deliveryType: 'dm' | 'channel'; recipient: string
  failureAlert: boolean; monthlyQuota: number
  skillSubOptions: Record<string, Record<string, boolean>>
  selectedSkillKeys: string[]
  status: 'active' | 'paused' | 'error'
  lastRun: string | null; nextRun: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (r: RoutineDef) => void
  agents: AgentOption[]
  initialAgentId?: string
  initialValues?: ScheduleTemplateValues
}

// ── 에이전트 선택 드롭다운 ─────────────────────────────────────

function AgentDropdown({ agents, value, onChange }: {
  agents: AgentOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = agents.find(a => a.id === value)

  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <button
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '0 14px', height: 40, borderRadius: 999,
          border: '1px solid var(--color-border)',
          background: 'var(--color-background-surface)',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, color: selected ? 'var(--color-text-primary)' : '#a3a3a3',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : '에이전트 선택...'}
        </span>
        <ChevronDown size={14} strokeWidth={2} color="var(--color-icon-secondary)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      {open && createPortal(
        <div ref={dropRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          zIndex: 9999, background: 'var(--color-background-surface)',
          border: '1px solid var(--color-border-emphasized)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          overflow: 'hidden auto', padding: '4px 0', maxHeight: 260,
        }}>
          {agents.map(a => (
            <button key={a.id} onClick={() => { onChange(a.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 14px',
                background: value === a.id ? 'var(--color-background-muted)' : 'none',
                border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <AgentIconBadge emoji={a.icon} boxSize={24} iconSize={11} radius={6} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              {value === a.id && <Check size={14} strokeWidth={2.5} color="var(--color-icon-primary)" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── 스킬 편집 패널 (선택 + 세부 옵션) ──────────────────────────

function SkillEditPanel({ agentJob, selectedSkills, onToggle, subOptions, onSubChange }: {
  agentJob?: string | null
  selectedSkills: Set<string>
  onToggle: (key: string) => void
  subOptions: Record<string, Record<string, boolean>>
  onSubChange: (next: Record<string, Record<string, boolean>>) => void
}) {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set([...selectedSkills])
  )
  const prevSkillsRef = useRef(selectedSkills)

  // 에이전트 변경 등 외부에서 selectedSkills 교체 시 expandedSet 동기화
  useEffect(() => {
    if (prevSkillsRef.current !== selectedSkills) {
      setExpandedSet(new Set([...selectedSkills]))
      prevSkillsRef.current = selectedSkills
    }
  }, [selectedSkills])

  const handleToggle = (key: string) => {
    if (selectedSkills.has(key)) {
      setExpandedSet(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      setExpandedSet(prev => new Set([...prev, key]))
    }
    onToggle(key)
  }

  const toggleExpand = (key: string) => {
    setExpandedSet(prev => {
      const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
    })
  }

  const setOpt = (skillKey: string, optKey: string, val: boolean) => {
    onSubChange({ ...subOptions, [skillKey]: { ...(subOptions[skillKey] ?? {}), [optKey]: val } })
  }

  return (
    <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 12, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
      {SKILL_CATALOG.map((skill, idx) => {
        const on = selectedSkills.has(skill.key)
        const opts: SubOption[] = getSubOpts(skill.key, agentJob)
        const hasSubOpts = on && opts.length > 0
        const isExpanded = expandedSet.has(skill.key)
        const subVals = subOptions[skill.key] ?? {}

        return (
          <div key={skill.key} style={{ borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none' }}>
            {/* 스킬 행 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '11px 14px' }}>
              {/* 펼치기 화살표 — ON 스킬에만 표시 */}
              <button
                onClick={() => { if (hasSubOpts) toggleExpand(skill.key) }}
                style={{
                  flexShrink: 0, width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', padding: 0, borderRadius: 4,
                  cursor: hasSubOpts ? 'pointer' : 'default',
                  color: hasSubOpts ? 'var(--color-icon-secondary)' : 'transparent',
                }}
              >
                {hasSubOpts && (isExpanded
                  ? <ChevronDown size={13} strokeWidth={2} />
                  : <ChevronRight size={13} strokeWidth={2} />
                )}
              </button>
              {/* 아이콘 */}
              <div style={{ flexShrink: 0, opacity: on ? 1 : 0.35 }}>
                <AstryxIcon icon={skill.icon} size="sm" color="primary" strokeWidth={on ? 2 : 1.6} />
              </div>
              {/* 레이블 */}
              <div style={{ flex: 1, marginLeft: 4 }}>
                <div style={{ fontSize: 14, fontWeight: on ? 600 : 400, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                  {skill.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>
                  {skill.detail}
                </div>
              </div>
              {/* 스위치 */}
              <Switch label="" value={on} onChange={() => handleToggle(skill.key)} />
            </div>
            {/* 세부 옵션 — ON + 펼침 상태일 때 노출 */}
            {hasSubOpts && isExpanded && (
              <div style={{
                margin: '0 14px 10px 38px',
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--color-background-muted)',
                border: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column', gap: 9,
              }}>
                {opts.map(opt => {
                  const checked = subVals[opt.key] ?? opt.defaultOn
                  return (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <input
                        type="checkbox" checked={checked}
                        onChange={e => setOpt(skill.key, opt.key, e.target.checked)}
                        style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-accent)' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{opt.label}</span>
                      {opt.description && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>{opt.description}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// 실행 시각 옵션 (30분 단위)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const hh = String(h).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${hh}:${m}`, label: `${ampm} ${h12}:${m}` }
})

// ── pill 버튼 공통 스타일 헬퍼 ────────────────────────────────

function PillBtn({ label, active, onClick, width }: {
  label: string; active: boolean; onClick: () => void; width?: number | string
}) {
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
        fontWeight: active ? 600 : 400, fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export default function RoutineWizard({ isOpen, onClose, onSave, agents, initialAgentId, initialValues }: Props) {
  const [name, setName]               = useState('')
  const [agentId, setAgentId]         = useState(initialAgentId ?? '')
  const [message, setMessage]         = useState('')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(['file', 'analysis', 'report']))
  const [subOptions, setSubOptions]   = useState<Record<string, Record<string, boolean>>>({})
  const [saving, setSaving]           = useState(false)
  const [atBottom, setAtBottom]       = useState(false)
  const scrollRef                     = useRef<HTMLDivElement>(null)

  // 스케줄 state
  const [frequency, setFrequency]     = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek]     = useState(1)   // 1=월
  const [dayOfMonth, setDayOfMonth]   = useState(1)
  const [timeVal, setTimeVal]         = useState('09:00')  // HH:MM
  const [deliveryType, setDeliveryType] = useState<'dm' | 'channel'>('dm')
  const [recipient, setRecipient]     = useState('')
  const [failureAlert, setFailureAlert] = useState(true)

  const getDefaultSkills = (job?: string | null) =>
    new Set<string>(JOB_DEFAULT_SKILL_KEYS[job ?? ''] ?? ['file', 'analysis', 'report'])

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? '')
      setAgentId(initialAgentId ?? '')
      setMessage(initialValues?.message ?? '')
      const initJob = agents.find(a => a.id === initialAgentId)?.job
      setSelectedSkills(getDefaultSkills(initJob))
      setSubOptions({})
      setSaving(false)
      setFrequency(initialValues?.frequency ?? 'weekly')
      setDayOfWeek(initialValues?.dayOfWeek ?? 1)
      setDayOfMonth(initialValues?.dayOfMonth ?? 1)
      setTimeVal(initialValues?.timeVal ?? '09:00')
      setDeliveryType(initialValues?.deliveryType ?? 'dm')
      setRecipient(initialValues?.recipient ?? '')
      setFailureAlert(true)
      setAtBottom(false)
    }
  }, [isOpen, initialAgentId, initialValues])

  const selectedAgent = agents.find(a => a.id === agentId)

  const handleAgentChange = (id: string) => {
    setAgentId(id)
    const job = agents.find(a => a.id === id)?.job
    setSelectedSkills(getDefaultSkills(job))
    setSubOptions({})
  }

  const toggleSkill = (key: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const canSave = name.trim().length > 0 && agentId.length > 0

  const handleSave = () => {
    setSaving(true)
    const [h, m] = timeVal.split(':').map(Number)
    setTimeout(() => {
      onSave({
        id: `s_${Math.random().toString(36).slice(2, 8)}`,
        name, agentId,
        agentName: selectedAgent?.name ?? '',
        agentIcon: selectedAgent?.icon ?? '🤖',
        initialMessage: message,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : 1,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : 1,
        hour: h || 0, minute: m || 0,
        deliveryType, recipient,
        failureAlert, monthlyQuota: 50,
        skillSubOptions: subOptions,
        selectedSkillKeys: [...selectedSkills],
        status: 'active', lastRun: null, nextRun: '—',
      })
      setSaving(false)
    }, 500)
  }

  if (!isOpen) return null

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8, fontFamily: 'inherit' }}>
      {text}
    </div>
  )

  const subLabel = (text: string) => (
    <div style={{ fontSize: 12, color: '#a3a3a3', marginBottom: 8, fontFamily: 'inherit' }}>{text}</div>
  )

  const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true"
        style={{
          background: 'var(--color-background-surface)', borderRadius: 20,
          width: 540, maxWidth: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', position: 'relative',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button onClick={onClose} aria-label="닫기" style={{
          position: 'absolute', top: 16, right: 16, zIndex: 1,
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-secondary)',
        }}>
          <X size={14} strokeWidth={2} />
        </button>

        {/* 헤더 */}
        <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-background-muted)', border: '1px solid #e5e5e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252',
            }}>
              <AstryxIcon icon={CalendarClock} size="sm" color="inherit" strokeWidth={1.8} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontFamily: 'Figtree, -apple-system, sans-serif', marginBottom: 6, lineHeight: 1.2 }}>
            스케줄 만들기
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 24 }}>
            반복 실행 주기와 결과 전달 방식을 설정합니다.
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
          <div
            ref={scrollRef}
            onScroll={e => {
              const el = e.currentTarget
              setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
            }}
            style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}
          >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>

            {/* ── 스케줄 이름 ── */}
            <div>
              {sectionLabel('스케줄 이름')}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '0 16px', height: 40, borderRadius: 999,
                border: '1px solid var(--color-border)',
                background: 'var(--color-background-surface)',
              }}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 주간 매출 요약"
                  autoFocus
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent',
                    fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* ── 실행할 에이전트 ── */}
            <div>
              {sectionLabel('실행할 에이전트')}
              <AgentDropdown agents={agents} value={agentId} onChange={handleAgentChange} />
              {selectedAgent && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginTop: 8, padding: '8px 12px', borderRadius: 10,
                  background: 'var(--color-background-muted)', border: '1px solid #e5e5e5',
                }}>
                  <AgentIconBadge emoji={selectedAgent.icon} boxSize={28} iconSize={13} radius={7} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', fontFamily: 'inherit', lineHeight: 1.3 }}>
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#a3a3a3', fontFamily: 'inherit' }}>
                      {selectedAgent.role}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 초기 메시지 ── */}
            <div>
              {sectionLabel('초기 메시지')}
              {subLabel('스케줄 실행 시 에이전트에게 전달되는 메시지입니다.')}
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="예: 지난 7일간 주요 매출 지표와 이상 거래 건수를 요약해줘"
                rows={3}
                style={{
                  width: '100%', padding: '12px 18px', borderRadius: 16,
                  border: '1.5px solid var(--color-border-emphasized)',
                  background: 'var(--color-background-surface)',
                  fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
                }}
              />
            </div>

            {/* ── 실행 주기 ── */}
            <div>
              {sectionLabel('실행 주기')}

              {/* 주기 pill */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <PillBtn label="매일" active={frequency === 'daily'}   onClick={() => setFrequency('daily')} />
                <PillBtn label="매주" active={frequency === 'weekly'}  onClick={() => setFrequency('weekly')} />
                <PillBtn label="매월" active={frequency === 'monthly'} onClick={() => setFrequency('monthly')} />
              </div>

              {/* 요일 (매주) */}
              {frequency === 'weekly' && (
                <div style={{ marginBottom: 16 }}>
                  {subLabel('요일')}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {DOW_LABELS.map((d, i) => (
                      <PillBtn
                        key={i}
                        label={d}
                        active={dayOfWeek === i + 1}
                        onClick={() => setDayOfWeek(i + 1)}
                        width={36}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 날짜 (매월) */}
              {frequency === 'monthly' && (
                <div style={{ marginBottom: 16 }}>
                  {subLabel('날짜')}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '0 16px', height: 40, borderRadius: 999,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-background-surface)',
                      width: 'fit-content',
                    }}>
                      <input
                        type="number" min={1} max={31}
                        value={dayOfMonth}
                        onChange={e => {
                          const v = Math.min(31, Math.max(1, Number(e.target.value) || 1))
                          setDayOfMonth(v)
                        }}
                        style={{
                          width: 36, border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>일</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#a3a3a3', fontFamily: 'inherit' }}>1 – 31 입력</span>
                  </div>
                </div>
              )}

              {/* 실행 시각 */}
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

            {/* ── 스킬 세부 옵션 ── */}
            {selectedAgent && (
              <div>
                {sectionLabel('스킬 세부 옵션')}
                {subLabel('이 스케줄에서 활성화할 세부 동작을 선택하세요.')}
                <SkillEditPanel
                  agentJob={selectedAgent.job}
                  selectedSkills={selectedSkills}
                  onToggle={toggleSkill}
                  subOptions={subOptions}
                  onSubChange={setSubOptions}
                />
              </div>
            )}

            {/* ── 결과 전달 ── */}
            <div>
              {sectionLabel('결과 전달')}
              {subLabel('실행 결과를 받을 방식을 선택하세요.')}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <PillBtn label="DM 수신" active={deliveryType === 'dm'} onClick={() => setDeliveryType('dm')} />
                <PillBtn label="채널 발송" active={deliveryType === 'channel'} onClick={() => setDeliveryType('channel')} />
              </div>
              {deliveryType === 'channel' && (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 16px', height: 40, borderRadius: 999,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background-surface)',
                }}>
                  <input
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="#채널명 (예: #재무팀-알림)"
                    style={{
                      flex: 1, border: 'none', outline: 'none',
                      background: 'transparent',
                      fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── 실패 시 알림 ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                  실패 시 알림
                </div>
                <div style={{ fontSize: 12, color: '#a3a3a3', fontFamily: 'inherit', marginTop: 2 }}>
                  실행 오류 발생 시 DM으로 알립니다.
                </div>
              </div>
              <Switch label="" value={failureAlert} onChange={setFailureAlert} />
            </div>

          </div>
          </div>
          {/* 하단 페이드 그라디언트 — 스크롤 끝에 닿으면 사라짐 */}
          {!atBottom && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
              background: 'linear-gradient(to bottom, transparent, var(--color-background-surface))',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          borderTop: '1px solid var(--color-border)', padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          flexShrink: 0, background: 'var(--color-background-surface)', borderRadius: '0 0 20px 20px',
        }}>
          <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 999, border: '1.5px solid #e5e5e5', background: 'white', fontSize: 14, fontWeight: 500, color: '#525252', cursor: 'pointer', fontFamily: 'inherit' }}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              padding: '10px 22px', borderRadius: 999, border: 'none',
              background: '#1a1a1a', fontSize: 14, fontWeight: 600,
              color: 'var(--color-on-accent)',
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', opacity: canSave && !saving ? 1 : 0.4,
            }}
          >
            {saving ? '저장 중...' : '스케줄 저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
