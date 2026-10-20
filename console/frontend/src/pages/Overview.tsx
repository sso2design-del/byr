import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Plug, Hourglass, Bot, Users, CheckCircle2 } from 'lucide-react'
import { AgentIconBadge } from '../utils/agentIcon'
import { KpiCard, MiniBars, ChannelChip, ResultBadge } from '../components/CardParts'
import { getAgentDemoOps, summarizeAll } from '../data/agentDemoOps'
import { ACTIVITY_LABEL, whenText, detailText, type AuditItem } from '../utils/activity'
import { teamJobLabel, type Team } from '../utils/teamFlow'

/* ─────────────────────────────────────────────────────────────────
 * 개요 — 콘솔을 열면 먼저 보는 화면. 두 질문에 답한다:
 *   ① 잘 돌아가고 있나(요약·추이·현황)  ② 내가 손볼 게 있나(확인이 필요한 일)
 * 데이터: 에이전트·팀 수, 배치 상태, Slack 연결, 최근 활동은 실제.
 *         실행 수·성공률·마지막 실행·승인 대기는 데모(data/agentDemoOps.ts).
 * 영역마다 따로 불러온다 — 한 영역이 실패해도 나머지는 보인다.
 * ───────────────────────────────────────────────────────────────── */

interface AgentRow {
  id: string; name: string; icon: string; role: string; job?: string | null
  deployment: { platform: string | null; channel: string; status: string }
}
interface SlackStatus {
  token: boolean; ok: boolean; error?: string; missing_scopes?: string[]
  bot_runtime?: { socket: string; error: string | null }
}
type Load<T> = { status: 'loading' | 'ok' | 'error'; data?: T }

function useLoad<T>(url: string): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ status: 'loading' })
  const load = () => {
    setState({ status: 'loading' })
    fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setState({ status: 'ok', data })).catch(() => setState({ status: 'error' }))
  }
  useEffect(load, [url])  // eslint-disable-line react-hooks/exhaustive-deps
  return [state, load]
}

// ── 영역 틀 — 제목 + 오른쪽 동작 + 로딩/실패 처리 ──────────────────
function Section({ title, action, state, onRetry, children, id }: {
  title: string; action?: ReactNode; state?: Load<unknown>['status']; onRetry?: () => void; children: ReactNode; id?: string
}) {
  return (
    <section id={id} style={{ background: 'var(--color-background-card)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Heading level={4}>{title}</Heading>
        {action}
      </div>
      {state === 'loading' ? (
        <div aria-busy style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 40, borderRadius: 12, background: 'var(--color-neutral)', opacity: 0.6 }} />)}
        </div>
      ) : state === 'error' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text type="supporting" color="secondary">불러오지 못했어요.</Text>
          {onRetry && <Button label="다시 불러오기" variant="secondary" size="sm" onClick={onRetry} />}
        </div>
      ) : children}
    </section>
  )
}

// ── 확인이 필요한 일 한 줄 ─────────────────────────────────────────
interface Todo { key: string; icon: typeof Plug; tone: 'yellow' | 'neutral' | 'red'; title: string; desc: string; actions: { label: string; primary?: boolean; onClick: () => void }[] }

function TodoRow({ t }: { t: Todo }) {
  const bg = t.tone === 'yellow' ? 'var(--color-background-yellow)' : t.tone === 'red' ? 'var(--color-background-red)' : 'var(--color-neutral)'
  const fg = t.tone === 'yellow' ? 'var(--color-text-yellow)' : t.tone === 'red' ? 'var(--color-text-red)' : 'var(--color-text-secondary)'
  return (
    <div className="ov-todo" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: 'var(--color-background-surface)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: bg, color: fg, display: 'grid', placeItems: 'center' }}>
        <AstryxIcon icon={t.icon} size="sm" color="inherit" strokeWidth={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{t.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 2, lineHeight: 1.5 }}>{t.desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {t.actions.map(a => <Button key={a.label} label={a.label} variant={a.primary ? 'primary' : 'secondary'} size="sm" onClick={a.onClick} />)}
      </div>
    </div>
  )
}

const DAY = ['일', '월', '화', '수', '목', '금', '토']

export default function Overview() {
  const navigate = useNavigate()
  const [agentsL, reloadAgents] = useLoad<AgentRow[]>('/api/agents')
  const [teamsL, reloadTeams] = useLoad<Team[]>('/api/teams')
  const [slackL, reloadSlack] = useLoad<SlackStatus>('/api/slack/status')
  const [auditL, reloadAudit] = useLoad<AuditItem[]>('/api/audit')
  const [tab, setTab] = useState<'all' | 'agent' | 'team'>('all')

  const agents = agentsL.data ?? []
  const teams = teamsL.data ?? []
  const sum = useMemo(() => summarizeAll(agents, teams), [agents, teams])
  const coreState: Load<unknown>['status'] = agentsL.status === 'error' || teamsL.status === 'error' ? 'error'
    : agentsL.status === 'ok' && teamsL.status === 'ok' ? 'ok' : 'loading'
  const retryCore = () => { reloadAgents(); reloadTeams() }
  const openMessenger = () => window.open('https://app.slack.com/client', '_blank', 'noopener')

  // 확인이 필요한 일 — 연결 문제 > 승인 대기 > 미배치 에이전트 > 팀 설정
  const todos: Todo[] = useMemo(() => {
    const out: Todo[] = []
    const s = slackL.data
    if (slackL.status === 'ok' && s) {
      if (!s.token) out.push({ key: 'slack-token', icon: Plug, tone: 'red', title: 'Slack 봇이 연결되지 않았어요', desc: '봇 토큰이 없어 채널 배치 안내와 메신저 응답이 동작하지 않습니다.', actions: [{ label: '설정 열기', primary: true, onClick: () => navigate('/settings') }] })
      else if (!s.ok) out.push({ key: 'slack-auth', icon: Plug, tone: 'red', title: 'Slack 연결에 문제가 있어요', desc: `Slack이 연결을 거부했습니다(${s.error ?? '알 수 없음'}). 봇 토큰을 확인해 주세요.`, actions: [{ label: '설정 열기', primary: true, onClick: () => navigate('/settings') }] })
      else {
        if ((s.missing_scopes ?? []).length) out.push({ key: 'slack-scope', icon: Plug, tone: 'red', title: `Slack 앱 권한 ${s.missing_scopes!.length}개가 빠졌어요`, desc: `${s.missing_scopes!.join(' · ')} — 추가하고 앱을 다시 설치해 주세요.`, actions: [{ label: '설정 열기', primary: true, onClick: () => navigate('/settings') }] })
        if (s.bot_runtime && s.bot_runtime.socket !== 'connected') out.push({ key: 'slack-bot', icon: Plug, tone: 'red', title: '메신저 봇이 꺼져 있어요', desc: '채널에서 말을 걸어도 에이전트가 답하지 않습니다. 앱 토큰(xapp-) 설정을 확인해 주세요.', actions: [{ label: '설정 열기', primary: true, onClick: () => navigate('/settings') }] })
      }
    }
    if (coreState === 'ok') {
      if (sum.pending.length) {
        const first = sum.pending[0].name
        out.push({ key: 'pending', icon: Hourglass, tone: 'yellow', title: sum.pending.length > 1 ? `${first} 외 ${sum.pending.length - 1}건이 메신저 승인을 기다려요` : `${first}이(가) 메신저 승인을 기다려요`, desc: '승인·반려는 메신저 스레드에서 지정 승인자가 답합니다.', actions: [{ label: '메신저 열기', primary: true, onClick: openMessenger }, { label: '검토 · 승인', onClick: () => navigate('/approvals') }] })
      }
      const idle = agents.filter(a => a.deployment?.status !== '배치됨').length
      if (idle) out.push({ key: 'idle', icon: Bot, tone: 'neutral', title: `에이전트 ${idle}개가 아직 채널에 없어요`, desc: '채널에 배치해야 메신저에서 부를 수 있습니다.', actions: [{ label: '배치하러 가기', onClick: () => navigate('/agents?status=미배치') }] })
      const noFlow = teams.filter(t => !(t.flows ?? []).some(f => (f.steps ?? []).length > 0))
      const idleTeams = teams.filter(t => t.deployment?.status !== '배치됨')
      if (noFlow.length) out.push({ key: 'team-flow', icon: Users, tone: 'neutral', title: `협업 흐름이 없는 팀 ${noFlow.length}개`, desc: `${noFlow.map(t => t.name).join(', ')} — 흐름을 만들어야 팀으로 일할 수 있습니다.`, actions: [{ label: '팀 열기', onClick: () => navigate(`/teams/${noFlow[0].id}`) }] })
      else if (idleTeams.length) out.push({ key: 'team-idle', icon: Users, tone: 'neutral', title: `팀 ${idleTeams.length}개가 아직 채널에 없어요`, desc: `${idleTeams.map(t => t.name).join(', ')}`, actions: [{ label: '팀 열기', onClick: () => navigate(`/teams/${idleTeams[0].id}`) }] })
    }
    return out
  }, [slackL, coreState, sum, agents, teams])  // eslint-disable-line react-hooks/exhaustive-deps

  // 에이전트·팀 현황 — 7일 실행 많은 순 상위 6
  const rows = useMemo(() => {
    const a = agents.map(x => ({ kind: 'agent' as const, id: x.id, name: x.name, icon: x.icon, sub: x.role, deployment: x.deployment, ops: getAgentDemoOps(x) }))
    const t = teams.map(x => ({ kind: 'team' as const, id: x.id, name: x.name, icon: x.icon || '👥', sub: teamJobLabel(agents.filter(m => x.agents.includes(m.id)) as unknown as Parameters<typeof teamJobLabel>[0]), deployment: x.deployment, ops: getAgentDemoOps(x) }))
    return [...a, ...t].filter(r => tab === 'all' || r.kind === tab).sort((p, q) => q.ops.runsTotal - p.ops.runsTotal).slice(0, 6)
  }, [agents, teams, tab])

  const nameOf = useMemo(() => Object.fromEntries([...agents, ...teams].map(x => [x.id, x.name])), [agents, teams])
  const activity = useMemo(() => [...(auditL.data ?? [])].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8), [auditL.data])

  // 요일 라벨 — 오늘이 마지막 칸
  const today = new Date().getDay()
  const dayLabels = Array.from({ length: 7 }, (_, i) => i === 6 ? '오늘' : DAY[(today - (6 - i) + 7) % 7])
  const maxDay = Math.max(1, ...sum.agentDaily.map((v, i) => v + sum.teamDaily[i]))

  return (
    <VStack gap={5} style={{ padding: '32px 40px' }}>
      {/* ① 헤더 */}
      <div className="m-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <VStack gap={1}>
          <Heading level={2}>개요</Heading>
          <Text type="supporting" color="secondary">최근 7일 운영 현황 · 실행 수 · 성공률 · 승인 대기는 데모 수치입니다.</Text>
        </VStack>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 보조 CTA — Astryx엔 outline 변형이 없어 ghost + 테두리로 같은 크기의 outline을 만든다 */}
          <Button label="+ 팀 만들기" variant="ghost" size="lg" style={{ boxShadow: 'inset 0 0 0 1.5px var(--color-text-primary)' }} onClick={() => navigate('/teams?new=1')} />
          <Button label="+ 에이전트 만들기" variant="primary" size="lg" onClick={() => navigate('/agents?new=1')} />
        </div>
      </div>

      {/* ② 요약 숫자 */}
      <div className="ov-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="운영 중" value={coreState === 'ok' ? sum.deployedAgents + sum.deployedTeams : '—'} unit={coreState === 'ok' ? `/ ${sum.agents + sum.teams} · 에이전트 ${sum.agents} · 팀 ${sum.teams}` : undefined} />
        <KpiCard label="이번 주 실행" value={coreState === 'ok' ? sum.weekRuns : '—'} unit="건" chart={coreState === 'ok' ? <MiniBars data={sum.agentDaily.map((v, i) => v + sum.teamDaily[i])} width={96} height={30} /> : undefined} />
        <KpiCard label="평균 성공률" value={coreState === 'ok' ? sum.avgSuccess : '—'} unit="%" />
        <KpiCard label="확인 필요" value={todos.length} unit="건" tone={todos.length ? 'yellow' : undefined}
          onClick={() => document.getElementById('ov-todos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      </div>

      {/* ③ 할 일 + 추이 */}
      <div className="ov-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 16 }}>
        <Section id="ov-todos" title="확인이 필요한 일" state={coreState === 'error' ? 'error' : coreState === 'loading' || slackL.status === 'loading' ? 'loading' : 'ok'} onRetry={() => { retryCore(); reloadSlack() }}
          action={slackL.status === 'ok' && slackL.data?.ok && slackL.data.bot_runtime?.socket === 'connected' ? <Badge variant="green" label="Slack 연결 · 봇 응답 중" /> : undefined}>
          {todos.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, background: 'var(--color-background-surface)' }}>
              <AstryxIcon icon={CheckCircle2} size="sm" color="secondary" strokeWidth={2} />
              <Text type="body">지금 확인할 일이 없어요.</Text>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todos.map(t => <TodoRow key={t.key} t={t} />)}
            </div>
          )}
        </Section>

        <Section title="7일 실행 추이" state={coreState} onRetry={retryCore}
          action={<span style={{ display: 'inline-flex', gap: 10, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-text-primary)' }} />에이전트</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-border-emphasized)' }} />팀 흐름</span>
          </span>}>
          <div role="img" aria-label={`최근 7일 실행 ${sum.agentDaily.map((v, i) => v + sum.teamDaily[i]).join(', ')}건`}
            style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 170, paddingTop: 8 }}>
            {sum.agentDaily.map((v, i) => {
              const t = sum.teamDaily[i]
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>{v + t}</span>
                  <div style={{ width: '100%', maxWidth: 32, display: 'flex', flexDirection: 'column', borderRadius: 6, overflow: 'hidden', height: `${((v + t) / maxDay) * 120}px` }}>
                    <div style={{ flex: t, background: 'var(--color-border-emphasized)' }} />
                    <div style={{ flex: v, background: 'var(--color-text-primary)' }} />
                  </div>
                  <span style={{ fontSize: 11, color: i === 6 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: i === 6 ? 700 : 500, fontFamily: 'inherit' }}>{dayLabels[i]}</span>
                </div>
              )
            })}
          </div>
        </Section>
      </div>

      {/* ④ 에이전트·팀 현황 */}
      <Section title="에이전트 · 팀 현황" state={coreState} onRetry={retryCore}
        action={<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {([['all', '전체'], ['agent', '에이전트'], ['team', '팀']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === k ? 600 : 400, border: 'none', whiteSpace: 'nowrap', background: tab === k ? 'var(--color-neutral)' : 'transparent', color: tab === k ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{l}</button>
          ))}
          <Button label="전체 보기" variant="secondary" size="sm" onClick={() => navigate(tab === 'team' ? '/teams' : '/agents')} />
        </div>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>{['이름', '종류', '채널', '7일 실행', '마지막 실행'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => navigate(r.kind === 'agent' ? `/agents/${r.id}` : `/teams/${r.id}`)} style={{ cursor: 'pointer', background: 'var(--color-background-surface)' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <AgentIconBadge emoji={r.icon} boxSize={32} iconSize={15} radius={10} colored />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>{r.sub}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}><Badge variant="neutral" label={r.kind === 'agent' ? '에이전트' : '팀'} /></td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}><ChannelChip channel={r.deployment?.status === '배치됨' ? r.deployment.channel : null} /></td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <MiniBars data={r.ops.runs7d} width={56} height={18} />
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>{r.ops.runsTotal}건</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                      {r.ops.lastRun.when}<ResultBadge result={r.ops.lastRun.result} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ⑤ 최근 활동 — 실제 감사 기록 */}
      <Section title="최근 활동" state={auditL.status} onRetry={reloadAudit}
        action={<Button label="새로고침" variant="secondary" size="sm" onClick={reloadAudit} />}>
        {activity.length === 0 ? (
          <Text type="supporting" color="secondary">아직 기록된 활동이 없어요.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activity.map((e, i) => (
              <div key={e.ts + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderTop: i ? '1px solid var(--color-border)' : 'none', minWidth: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: e.action.includes('DELETE') ? 'var(--color-error)' : e.action.includes('DEPLOY') ? 'var(--color-status-active)' : 'var(--color-border-emphasized)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{ACTIVITY_LABEL[e.action] ?? e.action}</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[nameOf[e.target], detailText(e.detail)].filter(Boolean).join(' · ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{whenText(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

    </VStack>
  )
}
