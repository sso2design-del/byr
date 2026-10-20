import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Switch } from '@astryxdesign/core/Switch'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import {
  ChevronLeft, ChevronRight, Trash2, Plus, X, UserPlus,
  GitBranch, MessageSquare, Lock, CalendarClock, Check,
  CircleCheck, TriangleAlert,
} from 'lucide-react'
import { AgentIconBadge } from '../utils/agentIcon'
import { PlatformLogo } from '../utils/platformLogos'
import FlowCreateModal from '../components/FlowCreateModal'
import FlowScheduleDialog from '../components/FlowScheduleDialog'
import {
  type Team, type AgentRef, type TeamFlow,
  teamJobLabel, aggregateRuns, RunStatusPill, ApprovalBadge,
  evaluateTeam, teamDeployedChannels, memberOwnChannel, josa,
} from '../utils/teamFlow'
import { FilterDropdown } from '../components/FilterDropdown'
import { SearchBar } from '../components/SearchBar'

// 워크스페이스 기존 채널(목) + 채널명 슬러그화(Slack 규칙)
const EXISTING_CHANNELS = ['#일반', '#공지', '#재무팀', '#재무팀-봇', '#프로젝트-x']
const slugifyChannel = (s: string) =>
  s.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

export default function TeamAgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [team, setTeam] = useState<Team | null>(null)
  const [allAgents, setAllAgents] = useState<AgentRef[]>([])
  const [loading, setLoading] = useState(true)

  const [deployPlatform, setDeployPlatform] = useState('')
  const [deployChannel, setDeployChannel] = useState('')
  const [channelManuallyEdited, setChannelManuallyEdited] = useState(false)
  const [deploying, setDeploying] = useState(false)
  // 워크스페이스 연동 → 채널 생성/선택 (목 인터랙션)
  const [wsConnected, setWsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [channelMode, setChannelMode] = useState<'create' | 'existing'>('create')
  const [channelPrivate, setChannelPrivate] = useState(false)
  const [addingChannel, setAddingChannel] = useState(false) // 다채널: 채널 추가 플로우 열림
  const [deployError, setDeployError] = useState<string | null>(null)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [editingFlow, setEditingFlow] = useState<TeamFlow | null>(null)
  const [scheduleFlow, setScheduleFlow] = useState<TeamFlow | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // 멤버 편집 — 추가 패널 / 제거 확인
  const [addingMember, setAddingMember] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [removing, setRemoving] = useState<{ agent: AgentRef; usedIn: { flow: string; orders: number[] }[] } | null>(null)
  const [memberBusy, setMemberBusy] = useState(false)
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false)
  const [schedulePickerPos, setSchedulePickerPos] = useState({ top: 0, left: 0, width: 240 })
  const scheduleBtnRef = useRef<HTMLButtonElement>(null)
  const schedulePickerRef = useRef<HTMLDivElement>(null)

  // 팀 이름 → 채널명 슬러그(공백·중점·특수문자 정리, 한글 유지). 값에는 표시용 "#" 접두.
  const teamChannelSlug = (name: string): string => {
    const s = (name || '').replace(/\s+/g, '').replace(/[·・]/g, '').replace(/[^\w가-힣]/g, '')
    return s ? `#${s}` : ''
  }

  const reloadTeam = async () => {
    const t = await fetch(`/api/teams/${id}`).then(r => r.json())
    setTeam(t)
  }

  const handleAddMember = async (agentId: string) => {
    setMemberBusy(true)
    try {
      await fetch(`/api/teams/${id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      })
      await reloadTeam()
    } finally { setMemberBusy(false) }
  }

  // 제거는 협업 흐름을 바꾸므로 조용히 처리하지 않는다 — 어디에 쓰이는지 먼저 알린다.
  const askRemoveMember = async (agent: AgentRef) => {
    const r = await fetch(`/api/teams/${id}/members/${agent.id}/usage`).then(r => r.json())
    setRemoving({ agent, usedIn: r.used_in || [] })
  }

  const confirmRemoveMember = async () => {
    if (!removing) return
    setMemberBusy(true)
    try {
      await fetch(`/api/teams/${id}/members/${removing.agent.id}`, { method: 'DELETE' })
      await reloadTeam()
      setRemoving(null)
    } finally { setMemberBusy(false) }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/teams/${id}`).then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
    ]).then(([t, a]) => {
      setTeam(t)
      setAllAgents(a)
      if (t.deployment?.platform) setDeployPlatform(t.deployment.platform)
      if (t.deployment?.channel) {
        setDeployChannel(t.deployment.channel)
        setChannelManuallyEdited(true)
      } else {
        // 미배치: 팀 이름 기반 채널명 자동 채움(시작점)
        setDeployChannel(teamChannelSlug(t.name))
        setChannelManuallyEdited(false)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  // 팀 이름이 바뀌면 자동값도 따라감(미배치 + 사용자가 직접 고치지 않았을 때만)
  useEffect(() => {
    if (!team || team.deployment.platform || channelManuallyEdited) return
    setDeployChannel(teamChannelSlug(team.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.name])

  useEffect(() => {
    if (!schedulePickerOpen) return
    const handler = (e: MouseEvent) => {
      if (!scheduleBtnRef.current?.contains(e.target as Node) && !schedulePickerRef.current?.contains(e.target as Node))
        setSchedulePickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [schedulePickerOpen])

  const teamAgents = allAgents.filter(a => team?.agents.includes(a.id))
  const flows: TeamFlow[] = team?.flows ?? []
  const runs = aggregateRuns(flows)
  const agentById = (aid: string) => allAgents.find(a => a.id === aid)

  // 스케줄 추가 CTA — 흐름 여럿이면 선택 드롭다운, 1개면 바로 다이얼로그, 0개면 비활성.
  const openSchedulePicker = () => {
    if (flows.length === 0) return
    if (flows.length === 1) { setScheduleFlow(flows[0]); return }
    if (scheduleBtnRef.current) {
      const r = scheduleBtnRef.current.getBoundingClientRect()
      setSchedulePickerPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 260) })
    }
    setSchedulePickerOpen(v => !v)
  }

  // 단계 승인(고위험) 인라인 토글 — 옵티미스틱 반영 후 PUT으로 저장, 실패 시 롤백.
  const toggleStepApproval = async (flow: TeamFlow, stepIndex: number, value: boolean) => {
    if (!team) return
    const prevTeam = team
    const nextFlows = (team.flows ?? []).map(f =>
      f.id === flow.id
        ? { ...f, steps: f.steps.map((s, i) => (i === stepIndex ? { ...s, high_risk: value } : s)) }
        : f
    )
    setTeam({ ...team, flows: nextFlows })
    try {
      const updatedFlow = nextFlows.find(f => f.id === flow.id)!
      const res = await fetch(`/api/teams/${team.id}/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedFlow.name,
          description: updatedFlow.description,
          trigger: updatedFlow.trigger,
          steps: updatedFlow.steps.map(s => ({ agent_id: s.agent_id, task: s.task, high_risk: s.high_risk })),
        }),
      })
      if (!res.ok) throw new Error()
      setTeam(await res.json())
    } catch {
      setTeam(prevTeam) // 롤백
    }
  }

  const handleToggleStatus = async () => {
    if (!team) return
    const next = team.status === 'active' ? 'paused' : 'active'
    const updated = await fetch(`/api/teams/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    }).then(r => r.json())
    setTeam(updated)
  }

  // 팀 메타(이름·설명 등) 저장 — 흐름 스텝·승인·스케줄은 각자 즉시 저장되므로 이 버튼은 메타 저장용.
  const handleSaveMeta = async () => {
    if (!team) return
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: team.name, purpose: team.purpose }),
      })
      if (res.ok) setTeam(await res.json())
    } catch { /* silent — UI는 현재 값 유지 */ }
    setSaveState('saved')
    setTimeout(() => navigate('/teams'), 1200)   // 저장 후 목록으로 (AgentDetail과 동일)
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    navigate('/teams')
  }

  const connectWorkspace = () => {
    setConnecting(true)
    window.setTimeout(() => { setConnecting(false); setWsConnected(true) }, 900)
  }

  const handleDeploy = async () => {
    if (!deployPlatform || !deployChannel.trim()) return
    const isCreate = channelMode === 'create'
    const channel = isCreate ? deployChannel : deployChannel.trim()
    setDeploying(true)
    setDeployError(null)
    try {
      const res = await fetch(`/api/teams/${id}/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: deployPlatform, channel, create: isCreate, private: channelPrivate, topic: `Byr · ${team?.name ?? '이 팀'} 운영` }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || '배치에 실패했습니다.')
      }
      setTeam(await res.json())
      // 배치 후 추가 플로우 닫고 입력 초기화(다음 채널 추가 대비)
      setAddingChannel(false)
      setDeployPlatform('')
      setDeployChannel('')
      setChannelMode('create')
      setChannelManuallyEdited(false)
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : '배치에 실패했습니다.')
    } finally { setDeploying(false) }
  }

  const handleUndeploy = async (channel: string) => {
    const res = await fetch(`/api/teams/${id}/undeploy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    })
    setTeam(await res.json())
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spinner size="md" />
      </div>
    )
  }

  if (!team) {
    return (
      <VStack gap={3} style={{ padding: 40 }}>
        <Text type="body">팀을 찾을 수 없습니다.</Text>
        <Button label="돌아가기" variant="secondary" onClick={() => navigate('/teams')} />
      </VStack>
    )
  }

  const isActive = team.status === 'active'

  const PLATFORMS = [
    { key: 'slack', name: 'Slack' },
    { key: 'dooray', name: 'Dooray' },
    { key: 'discord', name: 'Discord' },
    { key: 'telegram', name: 'Telegram' },
  ]

  // ── 팀 준비 상태 ──
  // "이 팀이 지금 일할 수 있나"를 한 줄로 답하고, 막힌 것만 펼친다.
  const teamChannels = teamDeployedChannels(team)
  const issues = evaluateTeam(team, teamAgents)
  const blockers = issues.filter(i => i.severity === 'blocker')
  const ready = blockers.length === 0

  // 메타 스트립 항목
  // 헤더 메타 = 정체성만(연결 정보는 우측 "채널 배치" 섹션이 담당).
  const metaItems: { label: string; node: React.ReactNode }[] = [
    { label: '직무', node: teamJobLabel(teamAgents) },
    { label: '멤버', node: `에이전트 ${teamAgents.length}명` },
    { label: '만든 사용자', node: team.created_by },
    { label: '만든 날짜', node: team.created_at.replace(/-/g, '.') },
  ]

  return (
    <>
    <VStack gap={0} style={{ padding: '32px 40px', maxWidth: 1100 }}>

      {/* 뒤로가기 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          label="팀 에이전트"
          icon={<AstryxIcon icon={ChevronLeft} size="sm" />}
          variant="ghost"
          size="sm"
          onClick={() => navigate('/teams')}
        />
      </div>

      {/* ── 히어로 헤더 — 좁은 화면에서는 버튼을 아래 줄로(mobile.css .m-hero) ── */}
      <div className="m-hero">
      <HStack gap={5} vAlign="start" style={{ marginBottom: 24 }}>
        <AgentIconBadge emoji={team.icon || '👥'} boxSize={72} iconSize={30} radius={18} colored glyphScale={1.5} />
        <VStack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Heading level={1}>{team.name}</Heading>
            {/* 활성/일시중지 토글 (Sana-style pill) */}
            <button
              onClick={handleToggleStatus}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 4px 4px 12px', borderRadius: 'var(--radius-full)', flexShrink: 0,
                background: isActive ? 'var(--color-status-active)' : 'var(--color-text-disabled)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1 }}>
                {isActive ? '활성' : '일시중지'}
              </span>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
            </button>
          </div>
          {team.purpose && <Text type="body" color="secondary" style={{ maxWidth: 620 }}>{team.purpose}</Text>}
        </VStack>

        {/* ── 상단 CTA (AgentDetail 패턴 통일) ── */}
        <HStack gap={2} style={{ flexShrink: 0, paddingTop: 4 }}>
          {/* 스케줄 추가 (보조 톤) — 흐름 선택 후 FlowScheduleDialog */}
          <button
            ref={scheduleBtnRef}
            onClick={openSchedulePicker}
            disabled={flows.length === 0}
            title={flows.length === 0 ? '흐름을 먼저 만드세요' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 'var(--radius-full)',
              background: 'transparent', border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: flows.length === 0 ? 'default' : 'pointer', opacity: flows.length === 0 ? 0.45 : 1,
            }}
          >
            <AstryxIcon icon={CalendarClock} size="xsm" color="secondary" strokeWidth={2} />
            스케줄 추가
          </button>
          {/* 팀 에이전트 삭제 (위험 액션) */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 22px', borderRadius: 'var(--radius-full)',
              background: 'transparent', border: '1.5px solid var(--color-error)',
              color: 'var(--color-error)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            팀 에이전트 삭제
          </button>
          {/* 저장 (팀 메타) */}
          <button
            onClick={handleSaveMeta}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 22px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent)', border: 'none',
              color: 'var(--color-on-accent)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            {saveState === 'saved'
              ? <><AstryxIcon icon={Check} size="sm" style={{ marginRight: 6 }} />저장됨</>
              : '저장'}
          </button>
        </HStack>
      </HStack>
      </div>

      {/* ── 메타 스트립 ── */}
      <div style={{
        display: 'flex', gap: 0, flexWrap: 'wrap',
        paddingBottom: 24, marginBottom: 28,
        borderBottom: '1px solid var(--color-border)',
      }}>
        {metaItems.map((item, i, arr) => (
          <div key={item.label} style={{
            paddingRight: 28, marginRight: 28, marginBottom: 4,
            borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'inherit' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
              {item.node}
            </div>
          </div>
        ))}
      </div>

      {/* ── 준비 상태 ──
          다 정상이면 한 줄로 끝내고, 막힌 것만 펼친다.
          항상 체크리스트를 펼쳐두면 화면만 무거워지고 진짜 문제가 묻힌다. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: issues.length ? 14 : 0,
        padding: issues.length ? '16px 18px' : '12px 18px',
        marginBottom: 24,
        border: `1px solid ${ready ? 'var(--color-border)' : 'var(--color-warning)'}`,
        borderRadius: 'var(--radius-element)',
        background: ready ? 'var(--color-background-surface)' : 'var(--color-background-muted)',
      }}>
        {/* 한 줄 요약 */}
        <HStack gap={2} style={{ alignItems: 'center' }}>
          <AstryxIcon
            icon={ready ? CircleCheck : TriangleAlert}
            size="sm"
            color={ready ? 'success' : 'warning'}
            strokeWidth={2}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
            {ready ? '일할 준비가 됐어요' : '아직 일을 시작할 수 없어요'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
            멤버 {teamAgents.length}명 · 협업 흐름 {flows.length}개
            {teamChannels.length > 0 ? ` · ${teamChannels.join(', ')}` : ' · 채널 없음'}
          </span>
        </HStack>

        {/* 막힌 것만 */}
        {issues.length > 0 && (
          <VStack gap={2}>
            {issues.map((issue, i) => (
              <div key={issue.key + i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)',
              }}>
                <span style={{
                  marginTop: 5, width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: issue.severity === 'blocker' ? 'var(--color-warning)' : 'var(--color-border-emphasized)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 2 }}>
                    {issue.detail}
                  </div>
                </div>
                {issue.action && (
                  <button
                    onClick={() => {
                      if (issue.action!.kind === 'agent' && issue.action!.agentId) navigate(`/agents/${issue.action!.agentId}`)
                      else if (issue.action!.kind === 'deploy') setAddingChannel(true)
                      else if (issue.action!.kind === 'flow') { setEditingFlow(flows[0] ?? null); setShowFlowModal(true) }
                    }}
                    style={{
                      flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)',
                      fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    {issue.action.label}
                  </button>
                )}
              </div>
            ))}
          </VStack>
        )}
      </div>

      {/* ── 본문 2열 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 28, alignItems: 'start' }}>

        {/* ── 좌: 멤버 + 협업 흐름 ── */}
        <VStack gap={6}>

          {/* 멤버 에이전트 */}
          <VStack gap={2}>
            <VStack gap={0}>
              <Heading level={4}>멤버 에이전트</Heading>
              <Text type="supporting" color="secondary">이 팀에 속한 업무별 에이전트 {teamAgents.length}명</Text>
            </VStack>
            {teamAgents.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-element)' }}>
                <Text type="body" color="secondary">멤버 에이전트가 없습니다.</Text>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {teamAgents.map((agent, idx) => {
                  // 멤버는 두 경로로 일한다: 팀 채널(팀 배치) · 자기 채널(개별 배치).
                  // 개별 배치만 보고 "미배치"라 쓰면 팀에서 멀쩡히 도는 멤버가
                  // 안 도는 것처럼 보인다 — 두 축을 다 표시한다.
                  const own = memberOwnChannel(agent)
                  const inTeam = teamChannels.length > 0
                  const label = inTeam
                    ? (own ? `팀에서 일하는 중 · 개별 ${own}` : '팀에서 일하는 중')
                    : (own ? `개별 ${own}` : '아직 일하지 않음')
                  const working = inTeam || !!own
                  return (
                    <div key={agent.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderTop: idx > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    }}>
                      <AgentIconBadge emoji={agent.icon} boxSize={36} iconSize={16} radius={10} mono />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{agent.purpose}</div>
                      </div>
                      {/* 상태 배지 */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: working ? 'var(--color-status-active)' : 'var(--color-border-emphasized)' }} />
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</span>
                      </span>
                      <button onClick={() => navigate(`/agents/${agent.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }} title="에이전트 상세">
                        <AstryxIcon icon={ChevronRight} size="xsm" color="secondary" strokeWidth={1.8} />
                      </button>
                      <button onClick={() => askRemoveMember(agent)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }} title="팀에서 제거">
                        <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={1.8} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 멤버 추가 — 팀에 없는 에이전트만 고른다 */}
            {!addingMember ? (
              <button
                onClick={() => { setAddingMember(true); setMemberQuery('') }}
                style={{
                  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)',
                  fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <AstryxIcon icon={UserPlus} size="xsm" color="inherit" strokeWidth={1.9} />
                멤버 추가
              </button>
            ) : (
              <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <HStack gap={2} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>추가할 에이전트</span>
                  <button onClick={() => setAddingMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }} title="닫기">
                    <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={1.8} />
                  </button>
                </HStack>
                <SearchBar value={memberQuery} onChange={setMemberQuery} placeholder="에이전트 이름 검색" />
                {(() => {
                  const pool = allAgents
                    .filter(a => !team.agents.includes(a.id))
                    .filter(a => !memberQuery || a.name.includes(memberQuery) || (a.purpose || '').includes(memberQuery))
                  if (pool.length === 0) {
                    return <Text type="supporting" color="secondary">추가할 수 있는 에이전트가 없습니다.</Text>
                  }
                  return (
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {pool.map((a, i) => (
                        <button
                          key={a.id}
                          disabled={memberBusy}
                          onClick={() => handleAddMember(a.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
                            border: 'none', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                            background: 'none', cursor: memberBusy ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          <AgentIconBadge emoji={a.icon} boxSize={30} iconSize={14} radius={9} mono />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{a.name}</span>
                            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.purpose}</span>
                          </span>
                          <AstryxIcon icon={Plus} size="xsm" color="secondary" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </VStack>

          {/* 협업 흐름 */}
          <VStack gap={2}>
            <VStack gap={0}>
              <Heading level={4}>협업 흐름</Heading>
              <Text type="supporting" color="secondary">멤버들이 핸드오프·승인으로 함께 하는 워크플로우</Text>
            </VStack>

            {flows.length === 0 ? (
              /* empty state — 멤버만 있고 흐름 없는 팀 */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 14, padding: '48px 24px', textAlign: 'center',
                border: '1.5px dashed var(--color-border)', borderRadius: 'var(--radius-element)',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AstryxIcon icon={GitBranch} size="md" color="secondary" strokeWidth={1.6} />
                </div>
                <VStack gap={1}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>아직 협업 흐름이 없어요</div>
                  <Text type="body" color="secondary">멤버들이 순서대로 함께 처리할 첫 흐름을 만들어보세요.</Text>
                </VStack>
                <button
                  onClick={() => { setEditingFlow(null); setShowFlowModal(true) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <AstryxIcon icon={Plus} size="xsm" color="secondary" strokeWidth={2} />
                  첫 흐름 만들기
                </button>
              </div>
            ) : (
              <VStack gap={5}>
                {flows.map(flow => {
                  const isScheduled = flow.trigger.type === 'schedule'
                  return (
                    <VStack key={flow.id} gap={3}>
                      {/* ── 흐름 컨테이너 (컴팩트 헤더 + 단계) ── */}
                      <div style={{
                        padding: 20, borderRadius: 20,
                        background: 'var(--color-background-muted)',
                        border: '1px solid var(--color-border)',
                      }}>
                        {/* 컴팩트 흐름 헤더 (작은 아이콘 + 이름 + 단계수 + 스케줄 칩 + 스텝 편집) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--color-border)' }}>
                          <AgentIconBadge emoji={flow.icon} boxSize={28} iconSize={13} radius={8} mono />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flexShrink: 0 }}>단계 {flow.steps.length}</span>
                          </div>
                          {isScheduled && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                              padding: '4px 10px 4px 8px', borderRadius: 'var(--radius-full)',
                              background: 'var(--color-background-surface)', border: '1px solid var(--color-border)',
                              fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
                            }}>
                              <AstryxIcon icon={CalendarClock} size="xsm" color="secondary" strokeWidth={1.8} />
                              {flow.trigger.config}
                            </span>
                          )}
                          <button
                            onClick={() => { setEditingFlow(flow); setShowFlowModal(true) }}
                            style={{
                              padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                              background: 'var(--color-background-surface)', fontSize: 13, fontWeight: 500,
                              color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                            }}
                          >
                            스텝 편집
                          </button>
                        </div>
                        <div>
                          {flow.steps.map((step, idx) => {
                            const agent = agentById(step.agent_id)
                            const last = idx === flow.steps.length - 1
                            return (
                              <div key={step.order} style={{ display: 'flex', gap: 14 }}>
                                {/* 번호 거터 + 세로 연결선 */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 28 }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    background: 'var(--color-background-surface)',
                                    border: '1px solid var(--color-border-emphasized)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
                                  }}>{step.order}</div>
                                  {!last && <div style={{ width: 2, flex: 1, minHeight: 28, background: 'var(--color-border-emphasized)', marginTop: 4 }} />}
                                </div>

                                {/* 단계 카드 */}
                                <div style={{
                                  flex: 1, minWidth: 0, marginBottom: last ? 0 : 16, padding: 20,
                                  border: '1px solid var(--color-border)', borderRadius: 16,
                                  background: 'var(--color-background-surface)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                }}>
                                  {/* 담당 에이전트(모노톤) + 승인 배지(모노톤) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {agent
                                      ? <AgentIconBadge emoji={agent.icon} boxSize={30} iconSize={14} radius={9} mono monoLevel="secondary" />
                                      : <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', flexShrink: 0 }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>담당 에이전트</div>
                                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent?.name ?? step.agent_id}</div>
                                    </div>
                                    {step.high_risk && <ApprovalBadge />}
                                  </div>
                                  {/* 승인 인라인 스위치 — 목록에서 바로 On/Off (즉시 저장) */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                    marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)',
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                      <span style={{ display: 'flex', flexShrink: 0, color: step.high_risk ? 'var(--color-warning)' : 'var(--color-icon-secondary)' }}>
                                        <AstryxIcon icon={Lock} size="xsm" color="inherit" strokeWidth={2} />
                                      </span>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>사용자 승인</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                                          {step.high_risk ? '실행 전 승인 필요 — 승인은 메신저에서' : '승인 없이 자동 진행'}
                                        </div>
                                      </div>
                                    </div>
                                    <Switch
                                      label=""
                                      value={step.high_risk}
                                      onChange={v => toggleStepApproval(flow, idx, v)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </VStack>
                  )
                })}
              </VStack>
            )}
          </VStack>
        </VStack>

        {/* ── 우: 채널 배치(상단) + 최근 실행(하단) ── */}
        <VStack gap={5}>

        {/* 채널 배치 — 상시 노출 */}
        <VStack gap={2}>
          <VStack gap={0}>
            <Heading level={4}>채널 배치</Heading>
            <Text type="supporting" color="secondary">이 팀을 메신저 채널에 배치합니다.</Text>
          </VStack>
          <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', padding: 16, background: 'var(--color-background-surface)' }}>
            {(() => {
              const deployments = team.deployments || []
              const showAdd = addingChannel || deployments.length === 0
              return (
              <VStack gap={3}>
                {deployments.length > 0 && (
                  <VStack gap={2}>
                    {deployments.map((d, i) => (
                      <div key={d.channel + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <PlatformLogo platform={d.platform!} size={20} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.channel}</div>
                            <Text type="supporting" color="secondary">봇 초대 완료 · 이 채널에서 팀을 부를 수 있습니다.</Text>
                          </div>
                        </div>
                        <button onClick={() => handleUndeploy(d.channel)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>배치 해제</button>
                      </div>
                    ))}
                  </VStack>
                )}
                {!showAdd ? (
                  <button onClick={() => setAddingChannel(true)} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 'var(--radius-full)', border: '1px dashed var(--color-border-emphasized)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>+ 채널 추가</button>
                ) : (
                  <>
                    {deployments.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="label">채널 추가</Text>
                        <button onClick={() => setAddingChannel(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                      </div>
                    )}
              <VStack gap={3}>
                <Text type="supporting" color="secondary">팀을 메신저 채널에 배치하면 그 채널에서 협업 흐름을 부를 수 있습니다.</Text>
                {/* 플랫폼 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PLATFORMS.map(p => {
                    const on = deployPlatform === p.key
                    return (
                      <button key={p.key} onClick={() => setDeployPlatform(p.key)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 12, fontWeight: 500,
                          border: `1.5px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: on ? 'var(--color-accent)' : 'transparent',
                          color: on ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                        }}>
                        <PlatformLogo platform={p.key} size={14} />
                        {p.name}
                      </button>
                    )
                  })}
                </div>

                {deployPlatform && (() => {
                  const p = PLATFORMS.find(x => x.key === deployPlatform)!
                  const slug = slugifyChannel(deployChannel)
                  if (!wsConnected && deployments.length === 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, border: '1px dashed var(--color-border-emphasized)', background: 'var(--color-background-muted)' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PlatformLogo platform={deployPlatform} size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{p.name} 워크스페이스 연결 필요</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>연결하면 채널을 만들고 이 팀을 배치할 수 있어요.</div>
                        </div>
                        <Button label={connecting ? '연결 중…' : `${p.name} 연결`} variant="primary" onClick={connectWorkspace} />
                      </div>
                    )
                  }
                  return (
                    <VStack gap={3}>
                      {/* 연결됨 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--color-background-surface)', border: '1px solid var(--color-border-emphasized)' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-status-active)', flexShrink: 0 }} />
                        <PlatformLogo platform={deployPlatform} size={14} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>Soyi 워크스페이스에 연결됨</span>
                        <button onClick={() => setWsConnected(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>연결 해제</button>
                      </div>

                      {/* 새 채널 만들기 / 기존 선택 */}
                      <VStack gap={1}>
                        <Text type="label">채널</Text>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {([['create', '새 채널 만들기'], ['existing', '기존 채널 선택']] as const).map(([m, lbl]) => {
                            const mon = channelMode === m
                            return (
                              <button key={m} onClick={() => { setChannelMode(m); if (m === 'existing') { setDeployChannel(EXISTING_CHANNELS[3]); setChannelManuallyEdited(true) } }}
                                style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: mon ? 'var(--color-background-muted)' : 'transparent', border: `1.5px solid ${mon ? 'var(--color-text-primary)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}>{lbl}</button>
                            )
                          })}
                        </div>
                      </VStack>

                      {channelMode === 'create' ? (
                        <VStack gap={2}>
                          <input
                            style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                            placeholder="예: 재무팀 부가세"
                            value={deployChannel}
                            onChange={e => { setDeployChannel(e.target.value); setChannelManuallyEdited(true) }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flexWrap: 'wrap' }}>
                            <PlatformLogo platform={deployPlatform} size={13} />
                            <span>{p.name}에 생성될 채널</span>
                            <code style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', background: 'var(--color-background-muted)', padding: '2px 7px', borderRadius: 6 }}>#{slug || '채널명'}</code>
                          </div>
                          {slug && EXISTING_CHANNELS.includes('#' + slug) && (
                            <div style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>이미 있는 채널명이에요 — ‘기존 채널 선택’을 쓰거나 다른 이름으로.</div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: 'inherit' }}>채널 설명(topic) 자동: “Byr · 이 팀 운영” · 접두사 없음</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([['public', '공개'], ['private', '비공개']] as const).map(([v, lbl]) => {
                              const von = (channelPrivate ? 'private' : 'public') === v
                              return <button key={v} onClick={() => setChannelPrivate(v === 'private')} style={{ padding: '5px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, background: von ? 'var(--color-background-muted)' : 'transparent', border: `1px solid ${von ? 'var(--color-text-primary)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}>{lbl}</button>
                            })}
                          </div>
                        </VStack>
                      ) : (
                        <FilterDropdown label="채널" options={[...EXISTING_CHANNELS]} value={deployChannel || EXISTING_CHANNELS[3]} onChange={(v) => { setDeployChannel(v); setChannelManuallyEdited(true) }} />
                      )}

                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button label={deploying ? '배치 중...' : (channelMode === 'create' ? '채널 만들고 배치' : '채널에 배치')} variant="primary" onClick={handleDeploy} />
                      </div>
                      {deployError && <div style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>{deployError}</div>}
                    </VStack>
                  )
                })()}
              </VStack>
                  </>
                )}
              </VStack>
              )
            })()}
          </div>
        </VStack>

        {/* 최근 실행 (팀 전체 감사의 단일 출처) */}
        <VStack gap={2}>
          <VStack gap={0}>
            <Heading level={4}>최근 실행</Heading>
            <Text type="supporting" color="secondary">팀 전체 실행 기록(감사)</Text>
          </VStack>
          <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
            {runs.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <Text type="body" color="secondary">아직 실행 기록이 없습니다.</Text>
              </div>
            ) : (
              runs.slice(0, 12).map((r, i) => (
                <div key={r.id} style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  {/* 흐름명 + 상태 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.flowName}</span>
                    <RunStatusPill status={r.status} />
                  </div>
                  {/* 요약 */}
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 6 }}>{r.summary}</div>
                  {/* 시각 · 행위자 · 승인자 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 11, color: 'var(--color-text-disabled)', fontFamily: 'inherit' }}>
                    <span>{r.started_at}</span>
                    <span>실행 {r.actor}</span>
                    {r.approver && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <AstryxIcon icon={Lock} size="xsm" color="secondary" strokeWidth={2} />
                        {r.status === 'waiting_approval' ? `승인 대기 ${r.approver}` : `승인 ${r.approver}`}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <Text type="supporting" color="secondary">실제 실행·승인은 메신저에서 이뤄집니다. 여기는 기록입니다.</Text>
        </VStack>

        </VStack>
      </div>
    </VStack>

    {/* 스케줄 대상 흐름 선택 드롭다운 */}
    {schedulePickerOpen && createPortal(
      <div ref={schedulePickerRef} style={{
        position: 'fixed', top: schedulePickerPos.top, left: schedulePickerPos.left, width: schedulePickerPos.width, zIndex: 9999,
        background: 'var(--color-background-surface)', border: '1px solid var(--color-border-emphasized)',
        borderRadius: 'var(--radius-element)', boxShadow: 'var(--shadow-med)', overflow: 'hidden', padding: '4px 0',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 14px 4px', fontFamily: 'inherit' }}>
          어느 흐름에 스케줄을 설정할까요?
        </div>
        {flows.map(flow => {
          const isSchedule = flow.trigger.type === 'schedule'
          return (
            <button
              key={flow.id}
              onClick={() => { setScheduleFlow(flow); setSchedulePickerOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <AgentIconBadge emoji={flow.icon} boxSize={26} iconSize={13} radius={8} colored />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AstryxIcon icon={isSchedule ? CalendarClock : MessageSquare} size="xsm" color="secondary" strokeWidth={1.8} />
                  {isSchedule ? flow.trigger.config : '메신저 호출'}
                </div>
              </div>
            </button>
          )
        })}
      </div>,
      document.body
    )}

    {/* 팀 삭제 확인 다이얼로그 (AgentDetail 패턴 통일) */}
    {/* 멤버 제거 확인 — 협업 흐름이 함께 바뀌므로 조용히 처리하지 않는다 */}
    {removing && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--color-background-surface)', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: 420, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <VStack gap={1}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
              {removing.agent.name}{josa(removing.agent.name, '을', '를')} 팀에서 뺄까요?
            </div>
            <Text type="body" color="secondary">
              {removing.usedIn.length === 0
                ? '협업 흐름에는 쓰이지 않아 흐름은 그대로입니다.'
                : '이 멤버가 맡은 단계도 함께 빠지고, 남은 단계 번호가 다시 매겨집니다.'}
            </Text>
          </VStack>

          {removing.usedIn.length > 0 && (
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)',
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {removing.usedIn.map(u => (
                <div key={u.flow} style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                  <strong>{u.flow}</strong>
                  <span style={{ color: 'var(--color-text-secondary)' }}> — {u.orders.join('·')}단계</span>
                </div>
              ))}
            </div>
          )}

          <Text type="supporting" color="secondary">
            에이전트 자체는 지워지지 않습니다. 내 에이전트 목록에 그대로 남습니다.
          </Text>

          <HStack gap={2} style={{ justifyContent: 'flex-end' }}>
            <button
              onClick={() => setRemoving(null)}
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)',
                fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >취소</button>
            <button
              disabled={memberBusy}
              onClick={confirmRemoveMember}
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-full)', border: 'none',
                background: 'var(--color-text-primary)', color: 'var(--color-background-surface)',
                fontSize: 14, fontWeight: 600, cursor: memberBusy ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >{memberBusy ? '빼는 중…' : '팀에서 빼기'}</button>
          </HStack>
        </div>
      </div>,
      document.body,
    )}

    {showDeleteConfirm && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--color-background-surface)', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          width: 400, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'var(--color-background-red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AstryxIcon icon={Trash2} size="md" color="error" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 4 }}>
                팀 에이전트 삭제
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>{team.name}</strong>을(를) 삭제하면 되돌릴 수 없습니다. 협업 흐름과 실행 기록이 모두 삭제됩니다.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: '10px 22px', borderRadius: 'var(--radius-full)',
                border: '1.5px solid var(--color-border-emphasized)',
                background: 'var(--color-background-surface)',
                fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >취소</button>
            <button
              onClick={handleDelete}
              style={{
                padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none',
                background: 'var(--color-icon-red)',
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >삭제</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* 협업 흐름 생성/스텝 편집 모달 */}
    {showFlowModal && (
      <FlowCreateModal
        teamId={team.id}
        teamName={team.name}
        members={teamAgents}
        flow={editingFlow ?? undefined}
        onClose={() => { setShowFlowModal(false); setEditingFlow(null) }}
        onSaved={(updated) => { setTeam(updated); setShowFlowModal(false); setEditingFlow(null) }}
      />
    )}

    {/* 흐름별 스케줄(트리거) 설정 다이얼로그 */}
    {scheduleFlow && (
      <FlowScheduleDialog
        teamId={team.id}
        flow={scheduleFlow}
        onClose={() => setScheduleFlow(null)}
        onSaved={(updated) => { setTeam(updated); setScheduleFlow(null) }}
      />
    )}
    </>
  )
}
