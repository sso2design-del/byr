import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Badge } from '@astryxdesign/core/Badge'
import { GitBranch, Plus, GripVertical, Trash2, Sparkles } from 'lucide-react'
import { ModalCloseButton, ModalFooter, MODAL_BUTTON_STYLE } from './ModalComponents'
import { type Team, type AgentRef, type TeamFlow } from '../utils/teamFlow'
import { AgentIconBadge } from '../utils/agentIcon'

// 스텝 전용 편집 모달. 트리거는 여기서 다루지 않는다
// (생성=기본 메신저 호출로 자동 설정 / 편집=기존 트리거 값 보존).

interface Props {
  teamId: string
  teamName?: string
  members: AgentRef[]
  flow?: TeamFlow        // 있으면 편집 모드(값 pre-load), 없으면 생성(자동 초안)
  onClose: () => void
  onSaved: (team: Team) => void
}

// 승인(highRisk)은 모달에서 편집하지 않음 — 흐름 목록(Process)의 인라인 스위치로 관리.
interface StepForm { agentId: string; task: string; highRisk: boolean }

// /api/agents 응답에는 스킬·근거 문서·승인자도 들어 있다(AgentRef 타입엔 없음).
type MemberDetail = AgentRef & {
  capabilities?: { on: boolean }[]
  file_paths?: string[]
  approvers?: string[]
}

// 승인 정책(approval_policy.py): 지정 승인자가 없으면 요청자 본인이 승인한다.
// 승인자는 메신저 사용자 ID로 저장되므로 이름 대신 인원수만 보여준다.
function gateLabel(m?: MemberDetail): string {
  const n = (m?.approvers ?? []).filter(Boolean).length
  return n > 0 ? `승인 필요 · 지정 승인자 ${n}명` : '승인 필요 · 요청자 승인'
}

// 멤버 기반 초안 단계의 할 일 플레이스홀더(역할 근거)
function memberTaskSeed(m: AgentRef): string {
  return m.purpose?.trim() || `${m.name} 담당 업무를 처리합니다`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid var(--color-border)',
  borderRadius: 10, background: 'var(--color-background-surface)',
  color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}

const fieldLabel = (text: string, required = false) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
    {text}{required && <span style={{ color: 'var(--color-error)' }}> *</span>}
  </span>
)

export default function FlowCreateModal({ teamId, teamName, members, flow, onClose, onSaved }: Props) {
  const isEdit = !!flow

  // 초기 단계: 편집=기존 값 / 생성=팀 멤버 순서 자동 초안
  const initialSteps: StepForm[] = flow
    ? flow.steps.map(s => ({ agentId: s.agent_id, task: s.task, highRisk: s.high_risk }))
    : members.length > 0
      ? members.map(m => ({ agentId: m.id, task: memberTaskSeed(m), highRisk: false }))
      : [{ agentId: '', task: '', highRisk: false }]

  const [name, setName] = useState(flow?.name ?? '')
  const [description, setDescription] = useState(flow?.description ?? '')
  const [steps, setSteps] = useState<StepForm[]>(initialSteps)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 네이티브 드래그 재정렬 상태
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const memberOf = (id: string) => members.find(m => m.id === id) as MemberDetail | undefined
  const gateCount = steps.filter(s => s.highRisk).length

  const agentOptions = [
    { value: '', label: '담당 에이전트 선택' },
    ...members.map(m => ({ value: m.id, label: m.name })),
  ]

  // 할 일 설명은 담당 에이전트에서 자동으로 따라온다(읽기 전용, 직접 편집 불가).
  const descFor = (agentId: string): string => {
    const m = members.find(x => x.id === agentId)
    return m ? memberTaskSeed(m) : ''
  }

  const setStep = (idx: number, patch: Partial<StepForm>) =>
    setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  // 새 단계는 지정 위치에 삽입("+" 버튼이 각 카드 아래에 있으므로)
  const addStepAt = (pos: number) => setSteps(prev => {
    const next = [...prev]
    next.splice(pos, 0, { agentId: '', task: '', highRisk: false })
    return next
  })
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx))
  const moveStep = (idx: number, dir: -1 | 1) => setSteps(prev => {
    const next = [...prev]
    const j = idx + dir
    if (j < 0 || j >= next.length) return prev
    ;[next[idx], next[j]] = [next[j], next[idx]]
    return next
  })
  // 드래그: from 위치의 단계를 to 위치로 이동
  const reorderStep = (from: number, to: number) => setSteps(prev => {
    if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  })
  const handleDrop = (to: number) => {
    if (dragIdx !== null) reorderStep(dragIdx, to)
    setDragIdx(null); setOverIdx(null)
  }

  // 할 일은 담당 에이전트에서 자동 파생 → 담당 에이전트만 선택되면 유효.
  const valid =
    name.trim().length > 0 &&
    steps.length >= 1 &&
    steps.every(s => !!s.agentId)

  const handleSave = async () => {
    if (!valid) {
      setError('흐름 이름과 각 단계의 담당 에이전트를 선택해주세요.')
      return
    }
    setError('')
    setSaving(true)
    try {
      // 트리거: 편집=기존 값 보존 / 생성=기본 메신저 호출
      const trigger = isEdit
        ? flow!.trigger
        : { type: 'messenger', config: '메신저 채널에서 이 흐름을 호출하면 시작합니다.' }
      const body = {
        name: name.trim(),
        description: description.trim(),
        trigger,
        steps: steps.map(s => ({ agent_id: s.agentId, task: descFor(s.agentId), high_risk: s.highRisk })),
      }
      const url = isEdit ? `/api/teams/${teamId}/flows/${flow!.id}` : `/api/teams/${teamId}/flows`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const team = await res.json() as Team
      onSaved(team)
    } catch {
      setError(isEdit ? '협업 흐름 저장에 실패했습니다.' : '협업 흐름 생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 원형 "+" 추가 버튼 — 다크 배경 + 대비되는 밝은 아이콘(또렷하게).
  const circleBtn = (icon: typeof Plus, label: string, onClick: () => void, disabled = false) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        border: 'none',
        background: 'var(--color-accent)',
        color: 'var(--color-on-accent)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
      }}
    >
      <AstryxIcon icon={icon} size="xsm" color="inherit" strokeWidth={2.4} />
    </button>
  )

  // 커넥터 "+" 단계 추가 — 세로 연결선·"+"를 카드 가로 중앙에 정렬.
  // 스텝 행의 컬럼 폭(번호28 · 카드 flex1 · 오른쪽 컨트롤 54=그립26+gap2+휴지통26)과 gap(8)을
  // 그대로 복제해 "카드 영역" flex1 안에서 가운데 정렬 → 카드 세로 중심선 위에 놓임.
  // 다음 단계가 승인 단계면 "+" 옆에 승인 게이트 배지를 붙인다(버튼 위치는 그대로 가운데).
  const ConnectorAdd = ({ pos }: { pos: number }) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ width: 28, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 2, height: 8, background: 'var(--color-border-emphasized)' }} />
        <div style={{ position: 'relative', display: 'flex' }}>
          {circleBtn(Plus, '단계 추가', () => addStepAt(pos))}
          {steps[pos]?.highRisk && (
            <span style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
              <Badge variant="yellow" label={gateLabel(memberOf(steps[pos].agentId))} />
            </span>
          )}
        </div>
        <div style={{ width: 2, height: 8, background: 'var(--color-border-emphasized)' }} />
      </div>
      <div style={{ width: 54, flexShrink: 0 }} />
    </div>
  )

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: 580, maxWidth: '100%', maxHeight: '85vh',
        background: 'var(--color-background-surface)',
        borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--color-background-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AstryxIcon icon={GitBranch} size="xsm" color="secondary" strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0 }}>
                {isEdit && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'inherit' }}>스텝 편집</div>}
                <Heading level={3}>{isEdit ? flow!.name : '새 협업 흐름'}</Heading>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <Badge variant="neutral" label={`${teamName ? `${teamName} · ` : ''}${steps.length}단계`} />
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>
        </div>

        {/* 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <VStack gap={4}>
            {/* 자동 초안 안내 (생성 모드 + 멤버 시드가 있을 때만) */}
            {!isEdit && members.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--color-background-muted)',
              }}>
                <AstryxIcon icon={Sparkles} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
                <Text type="supporting" color="secondary">팀 멤버 순서로 초안을 구성했습니다. 순서·담당을 편집하세요. 트리거는 기본 메신저 호출이며, 스케줄은 저장 후 흐름의 트리거 영역에서 추가합니다.</Text>
              </div>
            )}

            {/* 이름·설명 — 생성 모드에서만 입력(편집은 헤더의 이름 표시로 대체) */}
            {!isEdit && (
              <>
                <VStack gap={2}>
                  {fieldLabel('흐름 이름', true)}
                  <input
                    style={inputStyle}
                    placeholder="예: 부가세 신고 마감"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </VStack>
                <VStack gap={2}>
                  {fieldLabel('목적 · 설명')}
                  <input
                    style={inputStyle}
                    placeholder="예: 원장 대사 → 승인 → 신고 초안 작성 (선택)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </VStack>
              </>
            )}

            {/* 큰 라운드 컨테이너 — Steps 편집 전용 (Sana식, 모노톤) */}
            <div style={{
              padding: 20, borderRadius: 20,
              background: 'var(--color-background-muted)',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {fieldLabel('Steps', true)}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                  승인 필요 {gateCount} · 자동 진행 {steps.length - gateCount}
                </span>
              </div>
              <div>
                {steps.map((step, idx) => {
                  const isDragging = dragIdx === idx
                  const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx
                  return (
                    <React.Fragment key={idx}>
                      <div
                        onDragOver={e => { if (dragIdx !== null) { e.preventDefault(); setOverIdx(idx) } }}
                        onDrop={e => { e.preventDefault(); handleDrop(idx) }}
                        style={{
                          display: 'flex', alignItems: 'stretch', gap: 8,
                          opacity: isDragging ? 0.4 : 1,
                          borderTop: isOver ? '2px solid var(--color-text-secondary)' : '2px solid transparent',
                          transition: 'opacity 0.12s',
                        }}
                      >
                        {/* 번호 레일 — 카드 높이 기준 세로 중앙 정렬 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 28 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: step.highRisk ? 'var(--color-background-yellow)' : 'var(--color-background-surface)',
                            border: step.highRisk ? 'none' : '1px solid var(--color-border-emphasized)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                            color: step.highRisk ? 'var(--color-text-yellow)' : 'var(--color-text-secondary)',
                          }}>{idx + 1}</div>
                        </div>

                        {/* 단계 카드 — 담당 에이전트(아이콘 + Selector)와 스킬·근거·승인 요약 */}
                        <div style={{
                          flex: 1, minWidth: 0, padding: '14px 16px',
                          display: 'flex', flexDirection: 'column', gap: 10,
                          border: '1px solid var(--color-border)', borderRadius: 16,
                          background: 'var(--color-background-surface)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {memberOf(step.agentId) && (
                              <AgentIconBadge emoji={memberOf(step.agentId)!.icon} boxSize={32} iconSize={16} radius={9} colored />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Selector
                                label="담당 에이전트"
                                isLabelHidden
                                value={step.agentId}
                                onChange={v => setStep(idx, { agentId: (v as string) ?? '' })}
                                options={agentOptions}
                              />
                            </div>
                          </div>
                          {memberOf(step.agentId) && (() => {
                            const m = memberOf(step.agentId)!
                            const skills = (m.capabilities ?? []).filter(c => c.on).length
                            const docs = (m.file_paths ?? []).length
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Badge variant="neutral" label={`스킬 ${skills}`} />
                                <Badge variant="neutral" label={`참조 ${docs}`} />
                                <span style={{ marginLeft: 'auto' }}>
                                  <Badge variant={step.highRisk ? 'yellow' : 'neutral'} label={step.highRisk ? '사용자 승인' : '자동 진행'} />
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        {/* 오른쪽 바깥: 그립(드래그 순서 변경) + 휴지통(삭제) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <div
                            draggable
                            onDragStart={() => { setDragIdx(idx); setOverIdx(idx) }}
                            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                            onClick={() => moveStep(idx, idx === steps.length - 1 ? -1 : 1)}
                            title="드래그해서 순서 변경"
                            aria-label="순서 변경 핸들"
                            style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'grab', color: 'var(--color-text-primary)',
                            }}
                          >
                            <AstryxIcon icon={GripVertical} size="sm" color="primary" strokeWidth={2} />
                          </div>
                          <button
                            onClick={steps.length === 1 ? undefined : () => removeStep(idx)}
                            disabled={steps.length === 1}
                            aria-label="단계 삭제"
                            title="단계 삭제"
                            style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                              border: 'none', background: 'none',
                              cursor: steps.length === 1 ? 'default' : 'pointer',
                              opacity: steps.length === 1 ? 0.35 : 1,
                            }}
                          >
                            <AstryxIcon icon={Trash2} size="sm" color="error" strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                      {/* 커넥터 중앙: "+" 추가만 */}
                      <ConnectorAdd pos={idx + 1} />
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </VStack>
        </div>

        {/* 푸터 */}
        <ModalFooter>
          {error && <span style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>{error}</span>}
          <Button label="취소" variant="secondary" size="lg" style={MODAL_BUTTON_STYLE} onClick={onClose} />
          <Button
            label={saving ? '저장 중...' : '변경 저장'}
            variant="primary"
            size="lg"
            style={MODAL_BUTTON_STYLE}
            isDisabled={!valid || saving}
            onClick={handleSave}
          />
        </ModalFooter>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
