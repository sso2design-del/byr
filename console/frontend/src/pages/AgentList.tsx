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
import { MessageSquare, Headphones, Send, X, Trash2, ChevronRight, Clock, Plus, Check } from 'lucide-react'
import { Badge } from '@astryxdesign/core/Badge'
import { getAgentDemoOps } from '../data/agentDemoOps'
import { ChannelChip, RunFooter } from '../components/CardParts'
import { AgentIconBadge } from '../utils/agentIcon'
import HireModal from '../components/HireModal'
import RoutineWizard, { type RoutineDef, type AgentOption, type ScheduleTemplateValues } from '../components/RoutineWizard'
import { SearchBar } from '../components/SearchBar'
import { FilterDropdown } from '../components/FilterDropdown'
import { ModalFooter, MODAL_BUTTON_STYLE } from '../components/ModalComponents'
import { Selector } from '@astryxdesign/core/Selector'

const PLATFORM_CONFIG: Record<string, { label: string; bg: string; Icon: React.ElementType }> = {
  slack:    { label: 'Slack',    bg: '#4A154B', Icon: MessageSquare },
  dooray:   { label: 'Dooray',   bg: '#5C3EBC', Icon: MessageSquare },
  discord:  { label: 'Discord',  bg: '#5865F2', Icon: Headphones },
  telegram: { label: 'Telegram', bg: '#229ED9', Icon: Send },
}

interface Capability { key: string; icon: string; label: string; on: boolean; detail: string }
interface McpConn { key: string; name: string; connected: boolean }
interface Deployment { platform: string | null; channel: string; status: string }
interface Agent {
  id: string; name: string; icon: string; role: string; purpose: string
  status: string; job: string | null; tone: string[]; model: string
  capabilities: Capability[]; file_paths: string[]; deployment: Deployment; mcp?: McpConn[]
}
interface Template { key: string; icon: string; name: string; purpose: string; job: string | null; category?: string }
interface Platform { key: string; name: string; icon: string }
interface Meta { templates: Template[]; platforms: Platform[]; mcp_catalog: unknown[] }

type MainTab = 'agents' | 'routines'
type TabKey = '전체' | '즐겨찾기'
type StatusFilter = '전체' | '운영 중' | '미배치'

const STATUS_OPTIONS: StatusFilter[] = ['전체', '운영 중', '미배치']

// ── 스케줄 유스케이스 템플릿 ──────────────────────────────────────

interface ScheduleTemplate {
  key: string; icon: string; name: string; category: string
  desc: string; freqLabel: string; values: ScheduleTemplateValues
}


const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    key: 'weekly_revenue', icon: '📊', name: '주간 매출 요약', category: '재무·회계',
    desc: '매주 주요 매출 지표와 이상 거래를 자동으로 요약합니다.',
    freqLabel: '매주 월 09:00',
    values: { name: '주간 매출 요약', message: '지난 7일간 주요 매출 지표와 이상 거래 건수를 요약해줘', frequency: 'weekly', dayOfWeek: 1, timeVal: '09:00', deliveryType: 'dm' },
  },
  {
    key: 'monthly_close', icon: '📁', name: '월말 마감 점검', category: '재무·회계',
    desc: '매월 28일 전표 누락 및 미처리 항목을 자동으로 확인합니다.',
    freqLabel: '매월 28일 18:00',
    values: { name: '월말 마감 점검', message: '이번 달 전표 누락 및 미처리 항목을 확인하고 요약 보고서를 작성해줘', frequency: 'monthly', dayOfMonth: 28, timeVal: '18:00', deliveryType: 'dm' },
  },
  {
    key: 'daily_aml', icon: '⚠️', name: '일일 이상거래 스캔', category: '준법·감사',
    desc: '매일 임계값 초과 거래를 탐지하고 혐의 건수를 보고합니다.',
    freqLabel: '매일 08:00',
    values: { name: '일일 이상거래 스캔', message: '오늘 임계값 초과 거래를 탐지하고 혐의 건수를 보고해줘', frequency: 'daily', timeVal: '08:00', deliveryType: 'dm' },
  },
  {
    key: 'weekly_str', icon: '📄', name: '주간 STR 초안', category: '준법·감사',
    desc: '매주 금요일 이상거래 탐지 건에 대한 STR(혐의거래보고서) 초안을 자동 생성합니다.',
    freqLabel: '매주 금 16:00',
    values: { name: '주간 STR 초안', message: '이번 주 탐지된 이상거래 건을 검토해 STR 초안을 작성해줘', frequency: 'weekly', dayOfWeek: 5, timeVal: '16:00', deliveryType: 'dm' },
  },
  {
    key: 'weekly_hr', icon: '👥', name: '주간 근태 현황', category: '인사·총무',
    desc: '매주 팀별 출결·초과근무·연차 잔여를 자동으로 집계합니다.',
    freqLabel: '매주 월 09:30',
    values: { name: '주간 근태 현황', message: '지난 주 출결·초과근무·연차 잔여 현황을 팀별로 집계해줘', frequency: 'weekly', dayOfWeek: 1, timeVal: '09:30', deliveryType: 'dm' },
  },
  {
    key: 'weekly_pm', icon: '📋', name: '주간 기획 이슈 브리핑', category: '기획/PM',
    desc: '매주 열린 이슈와 완료 태스크를 요약하고 다음 우선순위를 제안합니다.',
    freqLabel: '매주 월 10:00',
    values: { name: '주간 기획 이슈 브리핑', message: '이번 주 열린 이슈와 완료 태스크를 요약하고 다음 우선순위를 제안해줘', frequency: 'weekly', dayOfWeek: 1, timeVal: '10:00', deliveryType: 'dm' },
  },
  {
    key: 'daily_incident', icon: '🔧', name: '일일 인시던트 요약', category: '개발·운영',
    desc: '매일 전날 발생한 인시던트와 배포 현황을 자동으로 요약합니다.',
    freqLabel: '매일 09:00',
    values: { name: '일일 인시던트 요약', message: '어제 발생한 인시던트와 배포 현황을 요약해줘', frequency: 'daily', timeVal: '09:00', deliveryType: 'dm' },
  },
  {
    key: 'weekly_fp', icon: '📈', name: '주간 보험 FP 실적', category: '보험 FP',
    desc: '매주 신계약·보장갭 분석 건수와 주요 상담 내용을 요약합니다.',
    freqLabel: '매주 월 09:00',
    values: { name: '주간 보험 FP 실적', message: '지난 주 신계약·보장갭 분석 건수와 주요 상담 내용을 요약해줘', frequency: 'weekly', dayOfWeek: 1, timeVal: '09:00', deliveryType: 'dm' },
  },
]

// ── 루틴 목업 데이터 ──────────────────────────────────────────────

const SAMPLE_ROUTINES: RoutineDef[] = [
  {
    id: 'r-001', name: '주간 매출 요약',
    agentId: 'agent-001', agentName: '부가세 대사 에이전트', agentIcon: '🧾',
    initialMessage: '지난 7일간 주요 매출 지표와 이상 거래 건수를 요약해줘',
    frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, hour: 9, minute: 0,
    deliveryType: 'dm', recipient: '황소이 선임',
    failureAlert: true, monthlyQuota: 50,
    skillSubOptions: {}, selectedSkillKeys: [],
    status: 'active', lastRun: '2026-07-07 09:00', nextRun: '매주 월요일 09:00',
  },
  {
    id: 'r-002', name: '장애 현황 일보',
    agentId: 'agent-002', agentName: '모니터링봇', agentIcon: '🔍',
    initialMessage: '오늘 발생한 장애 건수, 심각도, 처리 현황을 정리해줘',
    frequency: 'daily', dayOfWeek: 0, dayOfMonth: 1, hour: 8, minute: 0,
    deliveryType: 'channel', recipient: '#운영팀',
    failureAlert: true, monthlyQuota: 100,
    skillSubOptions: {}, selectedSkillKeys: [],
    status: 'error', lastRun: '2026-07-06 08:01', nextRun: '매일 08:00',
  },
  {
    id: 'r-003', name: '월간 계약 현황 리포트',
    agentId: 'agent-003', agentName: '계약관리봇', agentIcon: '📋',
    initialMessage: '이번 달 신규 계약, 갱신, 해지 건수와 매출 기여를 요약해줘',
    frequency: 'monthly', dayOfWeek: 0, dayOfMonth: 1, hour: 7, minute: 0,
    deliveryType: 'channel', recipient: '#영업팀',
    failureAlert: true, monthlyQuota: 20,
    skillSubOptions: {}, selectedSkillKeys: [],
    status: 'paused', lastRun: '2026-07-01 07:00', nextRun: '매월 1일 07:00',
  },
]

const STATUS_CONFIG = {
  active: { dot: 'var(--color-status-active)', label: '활성', bg: 'transparent' },
  paused: { dot: 'var(--color-text-disabled)', label: '일시정지', bg: 'transparent' },
  error:  { dot: 'var(--color-error)', label: '오류', bg: 'transparent' },
}

// ── 스케줄 편집 공용(RoutineWizard와 동일 규격) ────────────────
const SCHED_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const hh = String(h).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${hh}:${m}`, label: `${ampm} ${h12}:${m}` }
})
const SCHED_DOW = ['월', '화', '수', '목', '금', '토', '일']  // dayOfWeek 1=월 … 7=일

function schedNextRun(freq: 'daily' | 'weekly' | 'monthly', dow: number, dom: number, hh: number, mm: number): string {
  const t = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  if (freq === 'daily') return `매일 ${t}`
  if (freq === 'weekly') return `매주 ${SCHED_DOW[(dow || 1) - 1]}요일 ${t}`
  return `매월 ${dom || 1}일 ${t}`
}

function SchedPill({ label, active, onClick, width }: { label: string; active: boolean; onClick: () => void; width?: number | string }) {
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


// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>('agents')
  const [activeTab, setActiveTab] = useState<TabKey>('전체')

  // 내 에이전트 필터
  const [agentSearch, setAgentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체')

  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [isHireOpen, setIsHireOpen] = useState(false)
  // 개요에서 넘어올 때: ?new=1 → 만들기 열기, ?status=미배치 → 배치 상태 필터
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const st = searchParams.get('status')
    if (st && (STATUS_OPTIONS as string[]).includes(st)) setStatusFilter(st as StatusFilter)
    if (searchParams.get('new') === '1') setIsHireOpen(true)
    if (st || searchParams.get('new')) setSearchParams({}, { replace: true })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [initialTemplate, setInitialTemplate] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<Meta>({ templates: [], platforms: [], mcp_catalog: [] })

  // 루틴 상태
  const [routines, setRoutines] = useState<RoutineDef[]>(() => {
    try { const r = localStorage.getItem('byr_routines'); return r ? JSON.parse(r) : [] }
    catch { return [] }
  })
  const [isRoutineWizardOpen, setIsRoutineWizardOpen] = useState(false)
  const [routineTemplate, setRoutineTemplate] = useState<ScheduleTemplateValues | null>(null)
  const [drawerRoutine, setDrawerRoutine] = useState<RoutineDef | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then((d: Agent[]) => { setAgents([...d].reverse()); setLoading(false) }).catch(() => { setLoadError(true); setLoading(false) })
    fetch('/api/meta').then(r => r.json()).then(setMeta).catch(() => {})
  }, [])

  const openHireModal = (templateKey?: string) => {
    setInitialTemplate(templateKey)
    setIsHireOpen(true)
  }

  const closeHireModal = () => {
    setIsHireOpen(false)
    setInitialTemplate(undefined)
  }

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleHire = (result: Agent | Agent[]) => {
    const arr = Array.isArray(result) ? result : [result]
    setAgents(prev => [...arr, ...prev])   // 신규는 목록 상단(왼쪽)에
    closeHireModal()
    // 단일 생성이면 상세로 이동, 여러 개면 목록에 머무름
    if (arr.length === 1) navigate(`/agents/${arr[0].id}`)
  }

  // ── 선택 삭제 ──────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }
  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      await Promise.all([...selectedIds].map(aid => fetch(`/api/agents/${aid}`, { method: 'DELETE' })))
      setAgents(prev => prev.filter(a => !selectedIds.has(a.id)))
    } catch { /* 일부 실패해도 목록은 성공분만 반영 */ }
    finally {
      setBulkDeleting(false)
      setShowBulkDelete(false)
      exitSelectMode()
    }
  }

  // 탭 → 즐겨찾기 → 검색 → 상태 순으로 필터 적용
  const displayedAgents = useMemo(() => {
    let list = activeTab === '즐겨찾기' ? agents.filter(a => favorites.has(a.id)) : agents

    const q = agentSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.purpose.toLowerCase().includes(q)
      )
    }

    if (statusFilter === '운영 중') {
      list = list.filter(a => a.deployment.status === '배치됨')
    } else if (statusFilter === '미배치') {
      list = list.filter(a => a.deployment.status !== '배치됨')
    }

    return list
  }, [agents, activeTab, favorites, agentSearch, statusFilter])

  const hasFilter = agentSearch !== '' || statusFilter !== '전체'

  const saveRoutines = (next: RoutineDef[]) => {
    setRoutines(next)
    try { localStorage.setItem('byr_routines', JSON.stringify(next)) } catch {}
  }

  const handleRoutineSave = (r: RoutineDef) => {
    saveRoutines([r, ...routines])
    setIsRoutineWizardOpen(false)
    setRoutineTemplate(null)
  }

  const deleteRoutine = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    saveRoutines(routines.filter(r => r.id !== id))
    if (drawerRoutine?.id === id) setDrawerRoutine(null)
  }

  // ── 스케줄 상세 모달 인라인 편집 ──────────────────────────────
  const [schedFreq, setSchedFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [schedDow, setSchedDow] = useState(1)
  const [schedDom, setSchedDom] = useState(1)
  const [schedTime, setSchedTime] = useState('09:00')
  const [schedSaved, setSchedSaved] = useState(false)

  useEffect(() => {
    if (!drawerRoutine) return
    setSchedFreq(drawerRoutine.frequency)
    setSchedDow(drawerRoutine.dayOfWeek || 1)
    setSchedDom(drawerRoutine.dayOfMonth || 1)
    setSchedTime(`${String(drawerRoutine.hour).padStart(2, '0')}:${String(drawerRoutine.minute).padStart(2, '0')}`)
    setSchedSaved(false)
  }, [drawerRoutine])

  const handleSaveSchedule = () => {
    if (!drawerRoutine) return
    const [hh, mm] = schedTime.split(':').map(Number)
    const updated: RoutineDef = {
      ...drawerRoutine,
      frequency: schedFreq,
      dayOfWeek: schedFreq === 'weekly' ? schedDow : drawerRoutine.dayOfWeek,
      dayOfMonth: schedFreq === 'monthly' ? schedDom : drawerRoutine.dayOfMonth,
      hour: hh || 0, minute: mm || 0,
      nextRun: schedNextRun(schedFreq, schedDow, schedDom, hh || 0, mm || 0),
    }
    saveRoutines(routines.map(r => (r.id === updated.id ? updated : r)))
    setDrawerRoutine(updated)
    setSchedSaved(true)
    setTimeout(() => setSchedSaved(false), 1500)
  }

  const agentOptions: AgentOption[] = agents.map(a => ({ id: a.id, name: a.name, icon: a.icon, role: a.role, job: a.job }))

  if (loadError) return (
    <VStack gap={3} style={{ padding: 40 }}>
      <Text type="body" color="secondary">
        백엔드에 연결할 수 없습니다. 프로토타입 폴더에서 <b>./dev.sh</b> 를 실행해 서버(백엔드 :8000)를 켠 뒤 새로고침하세요.
      </Text>
      <Button variant="secondary" label="다시 시도" onClick={() => window.location.reload()} />
    </VStack>
  )

  if (loading) return (
    <VStack gap={3} style={{ padding: 40 }}>
      <Spinner />
      <Text type="body" color="secondary">불러오는 중...</Text>
    </VStack>
  )

  return (
    <>
    <VStack gap={6} style={{ padding: '32px 40px' }}>

      {/* ① 헤더 + 상위 탭 */}
      <HStack hAlign="between" vAlign="center">
        <VStack gap={1}>
          <Heading level={2}>내 에이전트</Heading>
          <Text type="supporting" color="secondary">에이전트 {agents.length}개가 등록되어 있습니다.</Text>
        </VStack>
      </HStack>

      {/* ② 상위 탭: 에이전트 | 스케줄 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['agents', '에이전트'], ['routines', '스케줄']] as [MainTab, string][]).map(([key, label]) => (
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
            {(key === 'agents' ? agents.length : routines.length) > 0 && (
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 'var(--radius-full)',
                background: mainTab === key ? 'rgba(0,0,0,0.1)' : 'var(--color-background-muted)',
                fontSize: 12, fontWeight: 600,
              }}>
                {key === 'agents' ? agents.length : routines.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── 스케줄 탭 ─── */}
      {mainTab === 'routines' && (
        <VStack gap={4}>
          {/* 필터 + 만들기 버튼 */}
          <HStack hAlign="between" vAlign="center">
            <Text type="supporting" color="secondary">{routines.length}개의 스케줄이 실행 중이거나 예약됨</Text>
            <Button label="+ 스케줄 만들기" variant="primary" onClick={() => { setRoutineTemplate(null); setIsRoutineWizardOpen(true) }} />
          </HStack>

          {routines.length === 0 ? (
            /* ── 빈 상태: 추천 스케줄 카드 ── */
            <VStack gap={5}>
              <VStack gap={1}>
                <Heading level={3}>자주 쓰는 스케줄로 시작해보세요</Heading>
                <Text type="body" color="secondary">템플릿을 선택하면 설정이 자동으로 채워집니다.</Text>
              </VStack>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%' }}>
                {SCHEDULE_TEMPLATES.map(tmpl => (
                    <ClickableCard
                      key={tmpl.key}
                      label={tmpl.name}
                      onClick={() => { setRoutineTemplate(tmpl.values); setIsRoutineWizardOpen(true) }}
                      width="100%"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, height: '100%' }}>
                        {/* 아이콘 + 이름 */}
                        <HStack gap={3} vAlign="start" style={{ flex: 1, minWidth: 0 }}>
                          <AgentIconBadge emoji={tmpl.icon} boxSize={46} iconSize={20} radius={14} />
                          <VStack gap={0} style={{ flex: 1, minWidth: 0 }}>
                            <Heading level={4}>{tmpl.name}</Heading>
                            <span style={{
                              display: 'inline-block', marginTop: 2,
                              padding: '2px 8px', borderRadius: 'var(--radius-full)',
                              background: 'var(--color-background-muted)',
                              color: 'var(--color-text-secondary)',
                              fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                            }}>{tmpl.category}</span>
                          </VStack>
                        </HStack>
                        {/* 설명 */}
                        <div style={{ flex: 1 }}>
                          <Text type="supporting" color="secondary">{tmpl.desc}</Text>
                        </div>
                        {/* 주기 뱃지 */}
                        <HStack gap={1} vAlign="center">
                          <AstryxIcon icon={Clock} size="sm" color="secondary" />
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                            {tmpl.freqLabel}
                          </span>
                        </HStack>
                      </div>
                    </ClickableCard>
                  ))}
              </div>
            </VStack>
          ) : (
            /* ── 2열 카드 그리드 ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {routines.map(r => {
                const cfg = STATUS_CONFIG[r.status]
                return (
                  <button
                    key={r.id}
                    onClick={() => setDrawerRoutine(r)}
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
                    {/* 아이콘 */}
                    <div style={{ flexShrink: 0 }}>
                      <AgentIconBadge emoji={r.agentIcon} boxSize={44} iconSize={20} radius={12} mono />
                    </div>
                    {/* 내용 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                          {r.name}
                        </span>
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: cfg.dot, flexShrink: 0,
                        }} />
                      </div>
                      <p style={{
                        fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
                        margin: '0 0 10px', lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {r.initialMessage}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AstryxIcon icon={Clock} size="sm" color="secondary" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                          {r.nextRun}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </VStack>
      )}

      {/* ─── 스케줄 상세 모달 ─── */}
      {drawerRoutine && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setDrawerRoutine(null)}
        >
          <div
            role="dialog" aria-modal="true"
            style={{
              background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)',
              width: 540, maxWidth: '100%', maxHeight: '88vh',
              display: 'flex', flexDirection: 'column', position: 'relative',
              boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setDrawerRoutine(null)}
              aria-label="닫기"
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 1,
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-secondary)',
              }}
            >
              <AstryxIcon icon={X} size="sm" strokeWidth={2} />
            </button>

            {/* 고정 헤더 */}
            <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
              <div style={{ marginBottom: 14 }}>
                <AgentIconBadge emoji={drawerRoutine.agentIcon} boxSize={36} iconSize={16} radius={9} colored />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontFamily: 'inherit', lineHeight: 1.2 }}>
                  {drawerRoutine.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_CONFIG[drawerRoutine.status].dot }} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                    {STATUS_CONFIG[drawerRoutine.status].label}
                  </span>
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '18px 0 0' }} />
            </div>

            {/* 스크롤 본문 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 실행 내용 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: 8 }}>실행 내용</div>
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--color-background-muted)',
                  fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1.6,
                }}>
                  {drawerRoutine.initialMessage}
                </div>
              </div>

              {/* 스케줄 편집 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: 12 }}>스케줄</div>

                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6 }}>실행 주기</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <SchedPill label="매일" active={schedFreq === 'daily'} onClick={() => setSchedFreq('daily')} width={76} />
                  <SchedPill label="매주" active={schedFreq === 'weekly'} onClick={() => setSchedFreq('weekly')} width={76} />
                  <SchedPill label="매월" active={schedFreq === 'monthly'} onClick={() => setSchedFreq('monthly')} width={76} />
                </div>

                {schedFreq === 'weekly' && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6 }}>요일</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                      {SCHED_DOW.map((d, i) => (
                        <SchedPill key={d} label={d} active={schedDow === i + 1} onClick={() => setSchedDow(i + 1)} width={40} />
                      ))}
                    </div>
                  </>
                )}

                {schedFreq === 'monthly' && (
                  <div style={{ marginBottom: 14, maxWidth: 160 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6 }}>날짜</div>
                    <Selector
                      label="날짜" isLabelHidden
                      value={String(schedDom)}
                      onChange={v => setSchedDom(Number(v) || 1)}
                      options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}일` }))}
                    />
                  </div>
                )}

                <div style={{ maxWidth: 160, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 6 }}>실행 시각</div>
                  <Selector
                    label="실행 시각" isLabelHidden
                    value={schedTime}
                    onChange={v => setSchedTime((v as string) ?? '09:00')}
                    options={SCHED_TIME_OPTIONS}
                  />
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AstryxIcon icon={Clock} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                    다음 실행 · {schedNextRun(schedFreq, schedDow, schedDom, Number(schedTime.split(':')[0]), Number(schedTime.split(':')[1]))}
                  </span>
                </div>
              </div>

              {/* 정보 (읽기 전용) */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: 12 }}>정보</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: '에이전트',    value: drawerRoutine.agentName },
                    { label: '마지막 실행', value: drawerRoutine.lastRun ?? '—' },
                    { label: '전달 방식',   value: drawerRoutine.deliveryType === 'dm' ? '다이렉트 메시지' : '채널' },
                    { label: '수신자',      value: drawerRoutine.recipient },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* 고정 하단 CTA (팀 스케줄 모달과 동일) */}
            <ModalFooter
              leftAction={
                <button
                  onClick={e => { deleteRoutine(drawerRoutine.id, e) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-error)', background: 'transparent',
                    fontSize: 13, fontWeight: 500, color: 'var(--color-error)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <AstryxIcon icon={Trash2} size="xsm" color="error" strokeWidth={2} />
                  스케줄 삭제
                </button>
              }
            >
              <Button label="취소" variant="secondary" size="lg" style={MODAL_BUTTON_STYLE} onClick={() => setDrawerRoutine(null)} />
              <Button label={schedSaved ? '저장됨' : '저장'} variant="primary" size="lg" style={MODAL_BUTTON_STYLE} onClick={handleSaveSchedule} />
            </ModalFooter>
          </div>
        </div>,
        document.body
      )}

      {/* ─── 에이전트 탭 시작 ─── */}
      {mainTab === 'agents' && (<>

      {/* ③ 검색 + 필터 행 */}
      <div className="m-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FilterDropdown
          label="배치 상태"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <SearchBar
          value={agentSearch}
          onChange={setAgentSearch}
          placeholder="에이전트 이름, 역할, 목적 검색..."
        />
        {hasFilter && (
          <button
            onClick={() => { setAgentSearch(''); setStatusFilter('전체') }}
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
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 8 }}>
          <Button
            label="+ 에이전트 만들기"
            variant="primary"
            onClick={() => openHireModal()}
          />
        </div>
      </div>

      {/* ③ 탭 + (맨 오른쪽) 선택 삭제 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(['전체', '즐겨찾기'] as TabKey[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: activeTab === tab ? 'var(--color-background-muted)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: 'none',
            }}
          >
            {tab}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {selectMode ? (
            <>
              <button
                onClick={() => selectedIds.size > 0 && setShowBulkDelete(true)}
                disabled={selectedIds.size === 0}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)', border: 'none',
                  background: 'var(--color-icon-red)', color: '#fff',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', flexShrink: 0,
                  cursor: selectedIds.size === 0 ? 'default' : 'pointer',
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}
              >삭제 ({selectedIds.size})</button>
              <button
                onClick={exitSelectMode}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border)', background: 'var(--color-background-surface)',
                  fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                  fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                }}
              >취소</button>
            </>
          ) : (
            agents.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border)', background: 'var(--color-background-surface)',
                  fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                  fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                }}
              >선택 삭제</button>
            )
          )}
        </div>
      </div>

      {/* ④ 에이전트 그리드 */}
      {activeTab === '즐겨찾기' && displayedAgents.length === 0 && !hasFilter ? (
        <VStack gap={2} style={{ padding: '48px 0', textAlign: 'center' }}>
          <Text type="body" color="secondary">즐겨찾기한 에이전트가 없습니다.</Text>
          <Text type="supporting" color="secondary">에이전트 카드의 ☆ 아이콘을 눌러 즐겨찾기하세요.</Text>
        </VStack>
      ) : agents.length === 0 && !hasFilter ? (
        /* ── 온보딩 빈 상태 — 만들기 + 마켓플레이스 유도 ── */
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
            <AstryxIcon icon={Plus} size="md" color="secondary" strokeWidth={1.8} />
          </div>
          <VStack gap={1} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>아직 에이전트가 없어요</div>
            <Text type="body" color="secondary">에이전트를 직접 만들거나, 마켓플레이스에서 템플릿을 찾아 시작하세요.</Text>
          </VStack>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button label="에이전트 만들기" variant="primary" onClick={() => openHireModal()} />
          </div>
        </div>
      ) : displayedAgents.length === 0 ? (
        <div style={{
          padding: '48px 0', textAlign: 'center',
          color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'inherit',
        }}>
          검색 결과가 없습니다.
        </div>
      ) : (
        <Grid columns={{ minWidth: 260 }} gap={4} width="100%">
          {displayedAgents.map(agent => {
            const deployed = agent.deployment.status === '배치됨'
            const connectedMcps = (agent.mcp ?? []).filter(m => m.connected)
            const isFav = favorites.has(agent.id)
            const ops = getAgentDemoOps(agent)
            return (
              <ClickableCard
                key={agent.id}
                label={agent.name}
                onClick={() => selectMode ? toggleSelect(agent.id) : navigate(`/agents/${agent.id}`)}
                width="100%"
                style={selectMode && selectedIds.has(agent.id)
                  ? { boxShadow: 'inset 0 0 0 2px var(--color-text-primary)' }
                  : undefined}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, height: '100%' }}>
                  <HStack hAlign="between" vAlign="start">
                    <HStack gap={3} vAlign="start" style={{ flex: 1, minWidth: 0 }}>
                      <AgentIconBadge emoji={agent.icon} boxSize={46} iconSize={20} radius={14} colored />
                      <VStack gap={0} style={{ flex: 1, minWidth: 0 }}>
                        <Heading level={4}>{agent.name}</Heading>
                        <Text type="supporting" color="secondary">{agent.role}</Text>
                      </VStack>
                    </HStack>
                    {selectMode ? (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: selectedIds.has(agent.id) ? 'var(--color-text-primary)' : 'transparent',
                        border: `2px solid ${selectedIds.has(agent.id) ? 'var(--color-text-primary)' : 'var(--color-border-emphasized)'}`,
                        boxShadow: selectedIds.has(agent.id) ? 'none' : 'inset 0 0 0 2px var(--color-background-surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedIds.has(agent.id) && <AstryxIcon icon={Check} size="xsm" strokeWidth={3} style={{ color: 'var(--color-background-surface)' }} />}
                      </div>
                    ) : (
                      <button
                        onClick={e => toggleFavorite(agent.id, e)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 18, padding: '2px 4px', lineHeight: 1, flexShrink: 0,
                          color: isFav ? '#f59e0b' : 'var(--color-icon-secondary)',
                        }}
                        aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    )}
                  </HStack>

                  <div style={{ flex: 1 }}>
                    <Text type="supporting" color="secondary">{agent.purpose}</Text>
                  </div>

                  {/* 정보 줄 — 채널 · 스킬 수 · 연결 수 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <ChannelChip channel={deployed ? (agent.deployment.channel || agent.deployment.platform) : null} />
                    <Badge variant="neutral" label={`스킬 ${(agent.capabilities ?? []).filter(c => c.on).length}`} />
                    <Badge variant="neutral" label={`연결 ${connectedMcps.length}`} />
                  </div>

                  {/* 마지막 실행 결과(데모) */}
                  <RunFooter ops={ops} />
                </div>
              </ClickableCard>
            )
          })}
        </Grid>
      )}

      {/* (전체 에이전트 템플릿 카탈로그는 마켓플레이스로 일원화 — 상단 "마켓플레이스에서 찾기") */}

      {/* ─── 에이전트 탭 닫기 ─── */}
      </>)}

    </VStack>

    {showBulkDelete && createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--color-background-surface)', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: 400, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'var(--color-background-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AstryxIcon icon={Trash2} size="md" color="error" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 4 }}>에이전트 삭제</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                선택한 <strong style={{ color: 'var(--color-text-primary)' }}>{selectedIds.size}개</strong> 에이전트를 삭제하면 되돌릴 수 없습니다. 실행 기록과 설정이 모두 삭제됩니다.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowBulkDelete(false)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--color-icon-red)', fontSize: 14, fontWeight: 600, color: '#fff', cursor: bulkDeleting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: bulkDeleting ? 0.7 : 1 }}>{bulkDeleting ? '삭제 중...' : '삭제'}</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    <HireModal
      isOpen={isHireOpen}
      onClose={closeHireModal}
      onHire={handleHire as (agent: unknown) => void}
      meta={meta}
      initialTemplate={initialTemplate}
    />

    <RoutineWizard
      isOpen={isRoutineWizardOpen}
      onClose={() => setIsRoutineWizardOpen(false)}
      onSave={handleRoutineSave}
      agents={agentOptions}
      initialValues={routineTemplate ?? undefined}
    />

    </>
  )
}
