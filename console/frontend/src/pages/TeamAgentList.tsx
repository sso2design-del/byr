import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Button } from '@astryxdesign/core/Button'
import { Grid } from '@astryxdesign/core/Grid'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Users, Clock, CalendarClock, MessageSquare } from 'lucide-react'
import TeamCreateModal from '../components/TeamCreateModal'
import FlowScheduleDialog from '../components/FlowScheduleDialog'
import { SearchBar } from '../components/SearchBar'
import { FilterDropdown } from '../components/FilterDropdown'
import { AgentIconBadge } from '../utils/agentIcon'
import { Badge } from '@astryxdesign/core/Badge'
import { getAgentDemoOps } from '../data/agentDemoOps'
import { ChannelChip, RunFooter } from '../components/CardParts'
import { type Team, type TeamFlow, type AgentRef, teamJobLabel } from '../utils/teamFlow'

type StatusFilter = '전체' | '운영 중' | '미배치'
const STATUS_OPTIONS: StatusFilter[] = ['전체', '운영 중', '미배치']

type MainTab = 'teams' | 'schedules'

// 팀 아이콘 미지정 시 폴백(직무 성격 무난한 기본값). 렌더는 항상 AgentIconBadge 경유(Astryx).
const TEAM_ICON_FALLBACK = '👥'

// 스케줄이 걸린 흐름 1건(팀 집계)
interface ScheduledFlow {
  teamId: string; teamName: string
  flowId: string; flowName: string; flowIcon: string
  config: string
}

export default function TeamAgentList() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [agents, setAgents] = useState<AgentRef[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') { setIsCreateOpen(true); setSearchParams({}, { replace: true }) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [mainTab, setMainTab] = useState<MainTab>('teams')
  const [scheduleTarget, setScheduleTarget] = useState<{ teamId: string; flow: TeamFlow } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0, width: 300 })
  const pickerBtnRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체')

  const load = () => {
    Promise.all([
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
    ]).then(([t, a]) => {
      setTeams([...t].reverse())     // 최신 팀이 목록 상단(왼쪽)에
      setAgents([...a].reverse())
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreated = (team: Team) => {
    setIsCreateOpen(false)
    navigate(`/teams/${team.id}`)   // 생성 후 상세로(구성) → 상세에서 저장 시 목록으로
  }

  const membersOf = (team: Team) => agents.filter(a => team.agents.includes(a.id))

  // 검색 → 상태 순으로 필터
  const displayedTeams = useMemo(() => {
    let list = teams
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.purpose.toLowerCase().includes(q) ||
        membersOf(t).some(m => m.name.toLowerCase().includes(q))
      )
    }
    if (statusFilter === '운영 중') list = list.filter(t => t.deployment.status === '배치됨')
    else if (statusFilter === '미배치') list = list.filter(t => t.deployment.status !== '배치됨')
    return list
  }, [teams, agents, search, statusFilter])

  const hasFilter = search !== '' || statusFilter !== '전체'

  // 모든 팀의 flows 중 스케줄 트리거만 집계
  const scheduledFlows = useMemo<ScheduledFlow[]>(() => {
    const rows: ScheduledFlow[] = []
    teams.forEach(t => (t.flows ?? []).forEach(f => {
      if (f.trigger.type === 'schedule') {
        rows.push({ teamId: t.id, teamName: t.name, flowId: f.id, flowName: f.name, flowIcon: f.icon, config: f.trigger.config })
      }
    }))
    return rows
  }, [teams])

  // 전체 팀의 모든 흐름(스케줄 만들기 대상 선택용)
  const allFlows = useMemo(() => {
    const rows: { teamId: string; teamName: string; flow: TeamFlow }[] = []
    teams.forEach(t => (t.flows ?? []).forEach(f => rows.push({ teamId: t.id, teamName: t.name, flow: f })))
    return rows
  }, [teams])

  const openPicker = () => {
    if (allFlows.length === 0) return
    if (pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect()
      setPickerPos({ top: r.bottom + 6, left: Math.max(12, r.right - 320), width: 320 })
    }
    setPickerOpen(v => !v)
  }

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (!pickerBtnRef.current?.contains(e.target as Node) && !pickerRef.current?.contains(e.target as Node))
        setPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <>
    <VStack gap={6} style={{ padding: '32px 40px' }}>

      {/* ① 헤더 */}
      <HStack hAlign="between" vAlign="center">
        <VStack gap={1}>
          <Heading level={2}>팀 에이전트</Heading>
          <Text type="supporting" color="secondary">여러 에이전트가 협업 흐름으로 함께 일하는 팀 에이전트 {teams.length}개가 등록되어 있습니다.</Text>
        </VStack>
      </HStack>

      {/* ② 상위 탭: 팀 에이전트 | 스케줄 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['teams', '팀 에이전트'], ['schedules', '스케줄']] as [MainTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: mainTab === key ? 'var(--color-background-muted)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: mainTab === key ? 600 : 400,
              color: mainTab === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {label}
            {(key === 'teams' ? teams.length : scheduledFlows.length) > 0 && (
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 'var(--radius-full)',
                background: mainTab === key ? 'rgba(0,0,0,0.1)' : 'var(--color-background-muted)',
                fontSize: 12, fontWeight: 600,
              }}>
                {key === 'teams' ? teams.length : scheduledFlows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── 팀 에이전트 탭 ─── */}
      {mainTab === 'teams' && (<>

      {/* 검색 + 필터 행 */}
      <div className="m-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FilterDropdown
          label="배치 상태"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="팀 이름, 목적, 멤버 검색..."
        />
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('전체') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 4px', fontSize: 14, fontFamily: 'inherit',
              color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0,
              textDecoration: 'underline', fontWeight: 600,
            }}
          >
            초기화
          </button>
        )}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <Button label="+ 새 팀 만들기" variant="primary" onClick={() => setIsCreateOpen(true)} />
        </div>
      </div>

      {/* 팀 목록 */}
      {teams.length === 0 && !hasFilter ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: '80px 0',
          border: '1.5px dashed var(--color-border)', borderRadius: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--color-background-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AstryxIcon icon={Users} size="md" color="secondary" strokeWidth={1.5} />
          </div>
          <VStack gap={1} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>아직 팀 에이전트가 없어요</div>
            <Text type="body" color="secondary">에이전트들이 협업할 팀을 만들어보세요.</Text>
          </VStack>
          <Button label="첫 팀 만들기" variant="secondary" onClick={() => setIsCreateOpen(true)} />
        </div>
      ) : displayedTeams.length === 0 ? (
        <div style={{
          padding: '48px 0', textAlign: 'center',
          color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'inherit',
        }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <Grid columns={{ minWidth: 300 }} gap={4} width="100%">
          {displayedTeams.map(team => {
            const members = membersOf(team)
            const deployed = team.deployment.status === '배치됨'
            const ops = getAgentDemoOps({ id: team.id, deployment: team.deployment })
            return (
              <ClickableCard
                key={team.id}
                label={team.name}
                onClick={() => navigate(`/teams/${team.id}`)}
                width="100%"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, height: '100%' }}>
                  <HStack gap={3} vAlign="start" style={{ flex: 1, minWidth: 0 }}>
                    <AgentIconBadge emoji={team.icon || TEAM_ICON_FALLBACK} boxSize={46} iconSize={20} radius={14} colored />
                    <VStack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Heading level={4}>{team.name}</Heading>
                      <Text type="supporting" color="secondary">{teamJobLabel(members)}</Text>
                    </VStack>
                  </HStack>

                  <div style={{ flex: 1 }}>
                    <Text type="supporting" color="secondary">{team.purpose || '목적 없음'}</Text>
                  </div>

                  {/* 정보 줄 — 채널 · 멤버 수 · 구성 에이전트 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <ChannelChip channel={deployed ? (team.deployment.channel || team.deployment.platform) : null} />
                    <Badge variant="neutral" label={`멤버 ${members.length}`} />
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      {members.slice(0, 4).map((m, i) => (
                        <span key={m.id} title={m.name} style={{ marginLeft: i === 0 ? 0 : -6, borderRadius: '50%', boxShadow: '0 0 0 2px var(--color-background-card)', display: 'inline-flex' }}>
                          <AgentIconBadge emoji={m.icon} boxSize={24} iconSize={12} radius={12} colored />
                        </span>
                      ))}
                      {members.length > 4 && (
                        <span style={{ marginLeft: -6, width: 24, height: 24, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: 'var(--color-neutral)', boxShadow: '0 0 0 2px var(--color-background-card)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                          +{members.length - 4}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 마지막 흐름 실행 결과(데모) */}
                  <RunFooter ops={ops} />
                </div>
              </ClickableCard>
            )
          })}
        </Grid>
      )}

      </>)}

      {/* ─── 스케줄 탭 ─── */}
      {mainTab === 'schedules' && (
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center">
            <Text type="supporting" color="secondary">
              {scheduledFlows.length > 0
                ? `${scheduledFlows.length}개의 협업 흐름이 스케줄로 자동 실행됩니다.`
                : '스케줄로 자동 실행되는 협업 흐름이 없습니다.'}
            </Text>
            <button
              ref={pickerBtnRef}
              onClick={openPicker}
              disabled={allFlows.length === 0}
              title={allFlows.length === 0 ? '팀·흐름을 먼저 만드세요' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                padding: '9px 18px', borderRadius: 'var(--radius-full)',
                background: 'var(--color-accent)', border: 'none',
                color: 'var(--color-on-accent)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                cursor: allFlows.length === 0 ? 'default' : 'pointer', opacity: allFlows.length === 0 ? 0.45 : 1,
              }}
            >
              + 스케줄 만들기
            </button>
          </HStack>

          {scheduledFlows.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 14, padding: '72px 0', textAlign: 'center',
              border: '1.5px dashed var(--color-border)', borderRadius: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--color-background-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AstryxIcon icon={CalendarClock} size="md" color="secondary" strokeWidth={1.5} />
              </div>
              <VStack gap={1}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>예약된 흐름이 없습니다</div>
                <Text type="body" color="secondary">팀 상세에서 협업 흐름에 스케줄을 추가하면 여기에 표시됩니다.</Text>
              </VStack>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {scheduledFlows.map(row => (
                <button
                  key={row.flowId}
                  onClick={() => {
                    const flow = teams.find(t => t.id === row.teamId)?.flows?.find(f => f.id === row.flowId)
                    if (flow) setScheduleTarget({ teamId: row.teamId, flow })
                  }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 16,
                    padding: '20px', textAlign: 'left',
                    background: 'var(--color-background-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ flexShrink: 0 }}>
                    <AgentIconBadge emoji={row.flowIcon} boxSize={44} iconSize={20} radius={12} mono />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.flowName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                      <AstryxIcon icon={Users} size="xsm" color="secondary" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.teamName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AstryxIcon icon={Clock} size="sm" color="secondary" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                        {row.config}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </VStack>
      )}
    </VStack>

    {/* 팀 생성 모달 */}
    {isCreateOpen && (
      <TeamCreateModal
        agents={agents}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />
    )}

    {/* 스케줄 만들기 — 전체 팀 흐름 선택 드롭다운 */}
    {pickerOpen && createPortal(
      <div ref={pickerRef} style={{
        position: 'fixed', top: pickerPos.top, left: pickerPos.left, width: pickerPos.width, zIndex: 9999,
        maxHeight: 360, overflowY: 'auto',
        background: 'var(--color-background-surface)', border: '1px solid var(--color-border-emphasized)',
        borderRadius: 'var(--radius-element)', boxShadow: 'var(--shadow-med)', padding: '4px 0',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 14px 4px', fontFamily: 'inherit' }}>
          어느 흐름에 스케줄을 설정할까요?
        </div>
        {allFlows.map(({ teamId, teamName, flow }) => {
          const isSchedule = flow.trigger.type === 'schedule'
          return (
            <button
              key={`${teamId}-${flow.id}`}
              onClick={() => { setScheduleTarget({ teamId, flow }); setPickerOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <AgentIconBadge emoji={flow.icon} boxSize={26} iconSize={13} radius={8} mono />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {flow.name}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)' }}>  ·  {teamName}</span>
                </div>
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

    {/* 스케줄 편집/설정 다이얼로그 */}
    {scheduleTarget && (
      <FlowScheduleDialog
        teamId={scheduleTarget.teamId}
        flow={scheduleTarget.flow}
        onClose={() => setScheduleTarget(null)}
        onSaved={updated => {
          setTeams(prev => prev.map(t => (t.id === updated.id ? updated : t)))
          setScheduleTarget(null)
        }}
      />
    )}
    </>
  )
}
