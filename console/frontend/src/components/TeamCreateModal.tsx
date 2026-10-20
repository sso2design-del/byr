import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'
import { ModalCloseButton, StepChip, ModalFooter, MODAL_BUTTON_STYLE } from './ModalComponents'
import {
  Check, Users, Search, X,
  Receipt, FileCheck, BarChart2, AlertTriangle, ClipboardList, Terminal, Layers,
} from 'lucide-react'
import { AgentIconBadge } from '../utils/agentIcon'

interface AgentRef { id: string; name: string; icon: string; purpose: string; job?: string | null; role?: string }
interface JobTemplate { key: string; icon: string; name: string; purpose: string; category: string; job: string | null }
interface Team { id: string; name: string; purpose: string; agents: string[]; status: string; deployment: { platform: string | null; channel: string; status: string }; created_at: string; created_by: string }

interface Props {
  agents: AgentRef[]
  onClose: () => void
  onCreated: (team: Team) => void
}

type Step = 1 | 2 | 3

// ── 직무 카드 정의 (HireModal과 동일 패턴) ────────────────────
const JOB_ROLES: { key: string; label: string; desc: string; icon: IconType }[] = [
  { key: 'vat_reconcile',       label: '재무·회계',    desc: '부가세 대사·월마감·경비정산',          icon: Receipt       },
  { key: 'insurance_fp',        label: '보험 FP',      desc: '제안서 자동화·보장 갭 분석·약관 Q&A', icon: FileCheck     },
  { key: 'securities_research', label: '증권 리서치',  desc: '투자리포트 초안·DART 공시 분석',      icon: BarChart2     },
  { key: 'compliance_aml',      label: '준법·내부감사', desc: 'STR 초안·이상거래 조사',             icon: AlertTriangle },
  { key: 'hr',                  label: '인사·총무',    desc: '근태 요약·채용 공고·급여 명세',       icon: Users         },
  { key: 'pm_brief',            label: '기획/PM',      desc: '회의록 정리·기획서·경쟁사 리서치',    icon: ClipboardList },
  { key: 'dev_incident',        label: '개발·운영',    desc: '로그 분석·배포 현황·PR 리뷰 요약',   icon: Terminal      },
  { key: 'blank',               label: '직접 구성',    desc: '직무 없이 빈 팀으로 시작합니다',       icon: Layers        },
]

// 팀 아이콘(AgentIconBadge용 이모지 키 — 렌더는 Astryx 아이콘으로 변환)
const JOB_ICONS: Record<string, string> = {
  vat_reconcile: '🧮', insurance_fp: '📄', securities_research: '📊',
  compliance_aml: '⚠️', hr: '👥', pm_brief: '📋', dev_incident: '🔔',
}

// 직무별 팀 기본 목적(추천 초안)
const JOB_TEAM_PURPOSE: Record<string, string> = {
  vat_reconcile:       '부가세 대사·월마감·경비정산을 에이전트들이 나눠 처리합니다.',
  insurance_fp:        '제안서 작성·보장 갭 분석·약관 Q&A를 함께 처리합니다.',
  securities_research: '투자리포트 초안·공시 분석·리서치를 함께 처리합니다.',
  compliance_aml:      '이상거래 탐지·STR 초안·조사를 함께 처리합니다.',
  hr:                  '근태 요약·채용·급여 등 인사 업무를 함께 처리합니다.',
  pm_brief:            '회의록 정리·기획서·경쟁사 리서치 등 기획 업무를 함께 처리합니다.',
  dev_incident:        '로그 분석·배포 현황·PR 리뷰 등 개발 운영을 함께 처리합니다.',
}

export default function TeamCreateModal({ agents, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [selectedJob, setSelectedJob] = useState('')
  const [teamIcon, setTeamIcon] = useState('')
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 빈 직무에서 그 자리에서 만든 에이전트(부모 목록에 병합해 즉시 선택 가능)
  const [created, setCreated] = useState<AgentRef[]>([])
  const [creatingKey, setCreatingKey] = useState('')
  const [createdTemplateKeys, setCreatedTemplateKeys] = useState<string[]>([])
  const [templates, setTemplates] = useState<JobTemplate[]>([])

  // '내 에이전트 만들기'와 동일한 직무 템플릿 목록을 쓰기 위해 메타를 로드
  useEffect(() => {
    fetch('/api/meta').then(r => r.json())
      .then(m => setTemplates((m.templates ?? []) as JobTemplate[]))
      .catch(() => {})
  }, [])

  const allAgents = [...agents, ...created]
  const countForJob = (job: string) => allAgents.filter(a => a.job === job).length
  // 선택 직무의 업무-에이전트 템플릿(HireModal과 동일 규칙: 해당 직무, blank 제외)
  const jobTemplates = templates.filter(t => t.key !== 'blank' && t.job === selectedJob)
  // 기존(서버) 에이전트가 없는 직무인지 — 이때 템플릿에서 바로 만들기 제공
  const baseCountForJob = (job: string) => agents.filter(a => a.job === job).length

  // 직무 선택 시 해당 직무 에이전트를 기본 선택. agents가 늦게 로드돼도 1회 보장(방어).
  const appliedJob = useRef('')
  useEffect(() => {
    if (selectedJob && selectedJob !== 'blank' && appliedJob.current !== selectedJob && allAgents.length) {
      setSelected(allAgents.filter(a => a.job === selectedJob).map(a => a.id))
      appliedJob.current = selectedJob
    }
  }, [selectedJob, allAgents.length])

  const filtered = allAgents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.purpose.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // 직무 선택 → 팀명·목적·아이콘·추천 멤버 자동 세팅(이후 스텝에서 편집 가능). "직접 구성"은 빈 상태.
  const selectJob = (jobKey: string) => {
    setSelectedJob(jobKey)
    setError('')
    if (jobKey === 'blank') {
      setName(''); setPurpose(''); setTeamIcon(''); setSelected([])
    } else {
      const role = JOB_ROLES.find(r => r.key === jobKey)!
      setName(`${role.label} 팀`)
      setPurpose(JOB_TEAM_PURPOSE[jobKey] ?? '')
      setTeamIcon(JOB_ICONS[jobKey] ?? '👥')
      setSelected(allAgents.filter(a => a.job === jobKey).map(a => a.id))
    }
  }

  // 빈 직무에서 '내 에이전트 만들기'와 동일한 직무 템플릿으로 생성 → 목록 병합 + 자동 선택
  const handleCreateFromTemplate = async (t: JobTemplate) => {
    if (createdTemplateKeys.includes(t.key)) return
    setCreatingKey(t.key); setError('')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: t.key, name: t.name, job: selectedJob, tone: ['정중'] }),
      })
      if (!res.ok) throw new Error()
      const agent = await res.json() as AgentRef
      setCreated(prev => [...prev, agent])
      setSelected(prev => [...prev, agent.id])
      setCreatedTemplateKeys(prev => [...prev, t.key])
    } catch {
      setError('에이전트 생성에 실패했습니다.')
    } finally {
      setCreatingKey('')
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!selectedJob) { setError('직무를 선택해주세요.'); return }
      setError(''); setStep(2); return
    }
    if (step === 2) {
      if (!name.trim()) { setError('팀 이름을 입력해주세요.'); return }
      setError(''); setStep(3); return
    }
  }

  const handleBack = () => {
    setError('')
    setStep(s => (s === 3 ? 2 : 1) as Step)
  }

  const handleCreate = async () => {
    if (selected.length === 0) { setError('에이전트를 1명 이상 추가해주세요.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), purpose: purpose.trim(), agents: selected, icon: teamIcon || '👥' }),
      })
      if (!res.ok) throw new Error()
      const team = await res.json()
      onCreated(team)
    } catch {
      setError('팀 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 10, background: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }

  const recommendedCount = selectedJob && selectedJob !== 'blank'
    ? countForJob(selectedJob)
    : 0

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 540, maxHeight: '84vh',
        background: 'var(--color-background-surface)',
        borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--color-background-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AstryxIcon icon={Users} size="xsm" color="secondary" strokeWidth={2} />
              </div>
              <Heading level={3}>새 팀 만들기</Heading>
            </div>
            <ModalCloseButton onClose={onClose} />
          </div>
          {/* 스텝 인디케이터 */}
          <HStack gap={2}>
            <StepChip label="직무 선택" stepNum={1} currentStep={step} />
            <StepChip label="팀 정보" stepNum={2} currentStep={step} />
            <StepChip label="에이전트 추가" stepNum={3} currentStep={step} />
          </HStack>
        </div>

        {/* 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* ── Step 1: 직무 선택 ── */}
          {step === 1 && (
            <VStack gap={3}>
              <Text type="supporting" color="secondary">직무를 고르면 팀 이름·목적·추천 멤버가 자동으로 채워집니다. 이후 단계에서 편집할 수 있어요.</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {JOB_ROLES.map(role => {
                  const isSel = selectedJob === role.key
                  const cnt = role.key === 'blank' ? -1 : countForJob(role.key)
                  return (
                    <button
                      key={role.key}
                      onClick={() => selectJob(role.key)}
                      style={{
                        position: 'relative',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        gap: 8, padding: 16, borderRadius: 14, cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                        background: isSel ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                        border: `1.5px solid ${isSel ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                        transition: 'all 0.12s',
                      }}
                    >
                      {cnt >= 0 && (
                        <span style={{
                          position: 'absolute', top: 12, right: 12,
                          fontSize: 11, fontWeight: 600, lineHeight: 1,
                          padding: '3px 7px', borderRadius: 999,
                          background: isSel ? 'rgba(255,255,255,0.16)'
                            : cnt === 0 ? 'var(--color-background-surface)' : 'var(--color-background-surface)',
                          color: isSel ? 'rgba(255,255,255,0.85)'
                            : cnt === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                          border: `1px solid ${isSel ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'}`,
                        }}>
                          {cnt === 0 ? '0명' : `${cnt}명`}
                        </span>
                      )}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: isSel ? 'rgba(255,255,255,0.15)' : 'var(--color-background-surface)',
                        border: `1px solid ${isSel ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isSel ? 'var(--color-background-surface)' : 'var(--color-icon-primary)',
                      }}>
                        <AstryxIcon icon={role.icon} size="sm" color="inherit" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isSel ? 'var(--color-background-surface)' : 'var(--color-text-primary)', lineHeight: 1.2, marginBottom: 3 }}>
                          {role.label}
                        </div>
                        <div style={{ fontSize: 12, color: isSel ? 'rgba(255,255,255,0.65)' : 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                          {role.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedJob && selectedJob !== 'blank' && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-background-muted)' }}>
                  <Text type="supporting" color="secondary">
                    {recommendedCount === 0
                      ? '이 직무 에이전트가 아직 없어요 — 다음 단계(에이전트 추가)에서 바로 만들 수 있어요.'
                      : `추천 멤버 에이전트 ${recommendedCount}명이 자동 선택됩니다.`}
                  </Text>
                </div>
              )}
            </VStack>
          )}

          {/* ── Step 2: 팀 정보 ── */}
          {step === 2 && (
            <VStack gap={4}>
              <VStack gap={2}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                  팀 이름 <span style={{ color: 'var(--color-error)' }}>*</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AgentIconBadge emoji={teamIcon || '👥'} boxSize={44} iconSize={20} radius={12} colored />
                  <input
                    style={inputStyle}
                    placeholder="예: 재무·회계 팀"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                    autoFocus
                  />
                </div>
              </VStack>
              <VStack gap={2}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>팀 목적</span>
                <textarea
                  style={{ ...inputStyle, resize: 'none', height: 80, lineHeight: 1.5 }}
                  placeholder="예: 부가세 대사·월마감·경비정산을 처리합니다."
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                />
              </VStack>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--color-background-muted)' }}>
                <Text type="body" color="secondary">
                  팀 안 에이전트들이 협업 흐름(단계·승인)으로 나눠 처리합니다.
                </Text>
              </div>
            </VStack>
          )}

          {/* ── Step 3: 에이전트 추가 ── */}
          {step === 3 && (
            <VStack gap={3}>
              {/* 직무 에이전트가 없을 때 — '내 에이전트 만들기'와 동일한 직무 템플릿에서 바로 추가(A) */}
              {selectedJob !== 'blank' && baseCountForJob(selectedJob) === 0 && jobTemplates.length > 0 && (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--color-background-muted)', border: '1px dashed var(--color-border)' }}>
                  <Text type="body">
                    이 직무({JOB_ROLES.find(r => r.key === selectedJob)?.label}) 에이전트가 아직 없어요. 필요한 업무를 골라 바로 만들면 팀에 추가됩니다.
                  </Text>
                  <VStack gap={2} style={{ marginTop: 10 }}>
                    {jobTemplates.map(t => {
                      const added = createdTemplateKeys.includes(t.key)
                      return (
                        <div key={t.key} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 10,
                          background: 'var(--color-background-surface)',
                          border: `1px solid ${added ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                        }}>
                          <AgentIconBadge emoji={t.icon} boxSize={32} iconSize={15} radius={9} colored />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{t.purpose}</div>
                          </div>
                          <Button
                            label={added ? '추가됨' : (creatingKey === t.key ? '만드는 중' : '+ 추가')}
                            variant={added ? 'secondary' : 'primary'}
                            size="sm"
                            isDisabled={added || creatingKey === t.key}
                            onClick={() => handleCreateFromTemplate(t)}
                          />
                        </div>
                      )
                    })}
                  </VStack>
                </div>
              )}
              {/* 검색 */}
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 40, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
                <AstryxIcon icon={Search} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="에이전트 검색"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <AstryxIcon icon={X} size="sm" color="secondary" strokeWidth={2} />
                  </button>
                )}
              </div>
              {selected.length > 0 && (
                <Text type="supporting" color="secondary">{selected.length}명 선택됨{selectedJob && selectedJob !== 'blank' ? ' · 직무 추천 반영됨' : ''}</Text>
              )}
              {allAgents.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <Text type="body" color="secondary">생성된 에이전트가 없습니다.<br />먼저 에이전트를 만들어주세요.</Text>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <Text type="body" color="secondary">검색 결과가 없습니다.</Text>
                </div>
              ) : (
                <VStack gap={2}>
                  {filtered.map(agent => {
                    const isSelected = selected.includes(agent.id)
                    return (
                      <div
                        key={agent.id}
                        onClick={() => toggle(agent.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          border: `1.5px solid ${isSelected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                          background: isSelected ? 'var(--color-background-muted)' : 'var(--color-background-surface)',
                          transition: 'all 0.1s',
                        }}
                      >
                        <AgentIconBadge emoji={agent.icon} boxSize={36} iconSize={16} radius={10} colored />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {agent.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {agent.purpose}
                          </div>
                        </div>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: isSelected ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                          border: `1.5px solid ${isSelected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <AstryxIcon icon={Check} size="xsm" color="secondary" strokeWidth={3} style={{ color: 'var(--color-background-surface)' }} />}
                        </div>
                      </div>
                    )
                  })}
                </VStack>
              )}
            </VStack>
          )}
        </div>

        {/* 푸터 */}
        <ModalFooter
          leftAction={step > 1
            ? <Button label="이전" variant="ghost" size="lg" style={MODAL_BUTTON_STYLE} onClick={handleBack} />
            : undefined
          }
        >
          {error && (
            <span style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>{error}</span>
          )}
          <Button label="취소" variant="secondary" size="lg" style={MODAL_BUTTON_STYLE} onClick={onClose} />
          {step < 3
            ? <Button label="다음" variant="primary" size="lg" style={MODAL_BUTTON_STYLE} onClick={handleNext} />
            : <Button label={saving ? '생성 중...' : '팀 만들기'} variant="primary" size="lg" style={MODAL_BUTTON_STYLE} isDisabled={saving} onClick={handleCreate} />
          }
        </ModalFooter>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
