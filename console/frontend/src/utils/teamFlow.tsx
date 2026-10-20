import React from 'react'
import { Lock, MessageSquare, CalendarClock } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'

// ── 팀 · 협업 흐름 공유 타입 ───────────────────────────────────
// 용어(glossary 강제): 팀 = 직무 단위 에이전트 그룹 / 협업 흐름 = 팀 안 에이전트들이
// 핸드오프·승인으로 함께 하는 하나의 워크플로우(단계로 구성) / 승인 = 고위험 단계의 사람 게이트.

export type TriggerType = 'messenger' | 'schedule'
export type RunStatus = 'completed' | 'waiting_approval' | 'failed' | 'scheduled'

export interface FlowStep {
  order: number
  agent_id: string
  task: string
  high_risk: boolean
}

export interface FlowRun {
  id: string
  status: RunStatus
  started_at: string
  actor: string       // 실행을 일으킨 행위자(사용자 또는 "스케줄")
  approver?: string    // 고위험 단계 승인자(승인 대기/완료 시)
  summary: string
}

export interface FlowTrigger {
  type: TriggerType
  config: string
  // 스케줄 트리거일 때의 구조적 값(편집 시 정확히 pre-load 하기 위해 보존)
  frequency?: 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number   // 1=월 … 7=일
  dayOfMonth?: number
  time?: string        // HH:MM
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

// HH:MM → "오전 9:00"
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
}

// 스케줄 구조 → 사람이 읽는 트리거 config 문자열
export function formatSchedule(
  frequency: 'daily' | 'weekly' | 'monthly',
  dayOfWeek: number,
  dayOfMonth: number,
  time: string,
): string {
  const t = timeLabel(time)
  if (frequency === 'daily') return `매일 ${t}`
  if (frequency === 'weekly') return `매주 ${DOW_LABELS[(dayOfWeek || 1) - 1]}요일 ${t}`
  return `매월 ${dayOfMonth || 1}일 ${t}`
}

export interface TeamFlow {
  id: string
  name: string
  icon: string
  description: string
  status: string
  trigger: FlowTrigger
  steps: FlowStep[]
  runs: FlowRun[]
}

export interface Deployment {
  platform: string | null
  channel: string
  status: string
}

export interface Team {
  id: string
  name: string
  icon?: string
  purpose: string
  agents: string[]
  status: string
  deployment: Deployment          // 하위호환 = deployments[0]
  deployments?: Deployment[]      // 다채널 배치(팀은 여러 채널 배치 가능)
  created_at: string
  created_by: string
  flows?: TeamFlow[]
}

export interface AgentRef {
  id: string
  name: string
  icon: string
  purpose: string
  status: string
  job?: string | null
  role?: string
  deployment?: Deployment
  llm_key?: string | null
  model?: string | null
}

// ── 상수 ───────────────────────────────────────────────────────

// 실행 이력(Runs) 상태 → 라벨·점 색. Runs는 감사뷰(기록)이지 실시간 조종석이 아니다.
export const RUN_STATUS: Record<RunStatus, { label: string; dot: string }> = {
  completed:        { label: '완료',      dot: 'var(--color-status-active)' },
  waiting_approval: { label: '승인 대기', dot: 'var(--color-icon-orange)' },
  failed:           { label: '실패',      dot: 'var(--color-error)' },
  scheduled:        { label: '예정',      dot: 'var(--color-text-disabled)' },
}

export const TRIGGER_META: Record<TriggerType, { label: string; Icon: IconType }> = {
  messenger: { label: '메신저 호출', Icon: MessageSquare },
  schedule:  { label: '스케줄 실행', Icon: CalendarClock },
}

// 직무(job) → 카테고리 라벨. 팀의 직무 표시에 사용.
export const JOB_CATEGORY_LABEL: Record<string, string> = {
  vat_reconcile:       '재무·회계',
  insurance_fp:        '보험 FP',
  securities_research: '증권 리서치',
  compliance_aml:      '준법·감사',
  hr:                  '인사·총무',
  pm_brief:            '기획/PM',
  dev_incident:        '개발·운영',
}

export function teamJobLabel(members: AgentRef[]): string {
  const jobs = Array.from(new Set(members.map(m => m.job).filter(Boolean) as string[]))
  if (jobs.length === 0) return '혼합'
  const labels = jobs.map(j => JOB_CATEGORY_LABEL[j] ?? j)
  return labels.length > 1 ? '혼합' : labels[0]
}

// 모든 흐름의 실행 이력을 한 줄로 모아 최신순 정렬(팀 개요의 감사 요약용).
export interface AggregatedRun extends FlowRun {
  flowId: string
  flowName: string
}

export function aggregateRuns(flows: TeamFlow[]): AggregatedRun[] {
  const all: AggregatedRun[] = []
  flows.forEach(f => f.runs.forEach(r => all.push({ ...r, flowId: f.id, flowName: f.name })))
  return all.sort((a, b) => b.started_at.localeCompare(a.started_at))
}

// ── 공용 컴포넌트 ──────────────────────────────────────────────

// 승인 배지 — 고위험 단계(외부발송·결제·삭제)에 사람 승인 게이트가 걸림을 표시.
// 주변이 모노톤이라 이 배지만 연한 워닝(앰버) 톤으로 은은하게 눈에 띄게.
export function ApprovalBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px 2px 7px', borderRadius: 'var(--radius-full)',
      background: 'var(--color-warning-muted)',
      border: '1px solid var(--color-warning-muted)',
      color: 'var(--color-warning)',
      fontSize: 11, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>
      <AstryxIcon icon={Lock} size="xsm" color="inherit" strokeWidth={2.2} />
      승인
    </span>
  )
}

export function RunStatusPill({ status }: { status: RunStatus }) {
  const cfg = RUN_STATUS[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
    </span>
  )
}


/* ─────────────────────────────────────────────────────────────
   팀 준비 상태 — "이 팀이 지금 일할 수 있나"
   화면에 항상 체크리스트를 펼치지 않고, 막힌 것만 노출한다.
   ───────────────────────────────────────────────────────────── */

export interface TeamIssue {
  key: 'not-deployed' | 'broken-step' | 'dual-path' | 'no-model'
  severity: 'blocker' | 'warn'
  title: string
  detail: string
  action?: { label: string; kind: 'deploy' | 'flow' | 'agent'; agentId?: string }
}

export function teamDeployedChannels(team: Team): string[] {
  const list = team.deployments?.length ? team.deployments : (team.deployment ? [team.deployment] : [])
  return list.filter(d => d && d.status === '배치됨' && d.channel).map(d => d.channel)
}

/** 멤버가 팀과 별개로 자기 채널에도 배치됐는지 */
export function memberOwnChannel(agent: AgentRef): string | null {
  const d = agent.deployment
  return d && d.status === '배치됨' && d.channel ? d.channel : null
}

/** 받침 유무로 조사를 고른다 — "정리이(가)" 같은 어색한 표기를 막는다. */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return withoutFinal   // 한글이 아니면 기본형
  return (code - 0xac00) % 28 > 0 ? withFinal : withoutFinal
}

export function evaluateTeam(team: Team, members: AgentRef[]): TeamIssue[] {
  const issues: TeamIssue[] = []
  const channels = teamDeployedChannels(team)

  // 1) 채널 배치 — 이게 없으면 팀은 아무 데서도 말을 받지 못한다(진짜 블로커)
  if (channels.length === 0) {
    issues.push({
      key: 'not-deployed', severity: 'blocker',
      title: '아직 채널에 배치되지 않았어요',
      detail: '메신저 채널에 배치해야 팀이 일을 받을 수 있어요.',
      action: { label: '채널 배치하기', kind: 'deploy' },
    })
  }

  // 2) 흐름 단계가 사라진 에이전트를 가리키는지
  //    (에이전트를 지우면 팀 참조도 정리되지만, 예전 데이터엔 남아 있을 수 있다)
  const alive = new Set(members.map(m => m.id))
  for (const flow of team.flows || []) {
    const dead = (flow.steps || []).filter(s => !alive.has(s.agent_id))
    if (dead.length) {
      issues.push({
        key: 'broken-step', severity: 'blocker',
        title: `"${flow.name}"에 빠진 단계가 있어요`,
        detail: `단계 ${dead.map(d => d.order).join('·')}번이 삭제된 에이전트를 가리켜요. 흐름을 열어 정리해 주세요.`,
        action: { label: '흐름 열기', kind: 'flow' },
      })
    }
  }

  // 3) 같은 채널에 개별 배치가 겹치는지 — 한 채널에서 두 갈래로 응답하면 안 된다(D-32)
  for (const m of members) {
    const own = memberOwnChannel(m)
    if (own && channels.includes(own)) {
      issues.push({
        key: 'dual-path', severity: 'warn',
        title: `${m.name}${josa(m.name, '이', '가')} 같은 채널에 따로도 배치돼 있어요`,
        detail: `${own}에서 팀과 개별 응답이 겹칩니다. 팀 응답이 우선이라 개별 배치는 해제하는 게 좋아요.`,
        action: { label: '에이전트 열기', kind: 'agent', agentId: m.id },
      })
    }
  }

  // 4) 쓸 모델이 정해졌는지
  const noModel = members.filter(m => !m.llm_key && !m.model)
  if (noModel.length) {
    issues.push({
      key: 'no-model', severity: 'blocker',
      title: `모델이 정해지지 않은 멤버가 ${noModel.length}명 있어요`,
      detail: noModel.map(m => m.name).join(', '),
      action: { label: '에이전트 열기', kind: 'agent', agentId: noModel[0].id },
    })
  }

  return issues
}
