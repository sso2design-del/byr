/* ── 내 에이전트 운영 지표(데모) ─────────────────────────────────────────
 * 실행 수·성공률·마지막 실행·승인 대기는 아직 백엔드에 없는 값이라
 * 에이전트 ID로 늘 같은 값이 나오는 데모 수치로 채운다(화면에 '데모' 표기).
 * 에이전트 수·배치 상태·스킬 수·연결 수는 실제 데이터를 그대로 쓴다.
 * 백엔드에 실행 기록이 생기면 이 파일만 실제 값으로 바꾸면 된다.
 */

export interface DemoAgentLike {
  id: string
  deployment?: { status?: string; channel?: string } | null
  approvers?: string[]
}

export type RunResult = 'approved' | 'auto' | 'awaiting'

export interface AgentDemoOps {
  runs7d: number[]        // 오래된 날 → 오늘, 7칸
  runsTotal: number
  successRate: number     // %
  pending: boolean        // 메신저 승인 대기 중인 초안이 있는지
  lastRun: { when: string; result: RunResult }
}

function seedOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h || 1
}

function rng(seed: number) {
  let x = seed
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return (x % 10000) / 10000 }
}

export function getAgentDemoOps(agent: DemoAgentLike): AgentDemoOps {
  const seed = seedOf(agent.id)
  const r = rng(seed)
  const deployed = agent.deployment?.status === '배치됨'
  // 배치된 에이전트는 메신저 호출이 더해져 실행이 많다. 미배치는 콘솔 실행·스케줄만.
  const runs7d = Array.from({ length: 7 }, () => deployed ? 3 + Math.floor(r() * 7) : Math.floor(r() * 5))
  const runsTotal = runs7d.reduce((a, b) => a + b, 0)
  const successRate = runsTotal === 0 ? 0 : 92 + Math.floor(r() * 9)
  const pending = seed % 6 === 0
  const hh = 9 + Math.floor(r() * 9), mm = Math.floor(r() * 60)
  const daysAgo = runs7d[6] > 0 ? 0 : runs7d[5] > 0 ? 1 : 2
  const when = daysAgo === 0 ? `오늘 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : `${daysAgo}일 전`
  const result: RunResult = pending ? 'awaiting' : r() < 0.55 ? 'approved' : 'auto'
  return { runs7d, runsTotal, successRate, pending, lastRun: { when, result } }
}

export const RESULT_LABEL: Record<RunResult, string> = { approved: '승인 완료', auto: '자동 완료', awaiting: '승인 대기' }

/** 목록 상단 요약 — 실제 에이전트 수·배치 수 + 데모 실행 지표 */
export function summarize(agents: DemoAgentLike[]) {
  const ops = agents.map(getAgentDemoOps)
  const daily = Array.from({ length: 7 }, (_, d) => ops.reduce((s, o) => s + o.runs7d[d], 0))
  const ran = ops.filter(o => o.runsTotal > 0)
  return {
    total: agents.length,
    deployed: agents.filter(a => a.deployment?.status === '배치됨').length,
    pending: ops.filter(o => o.pending).length,
    weekRuns: daily.reduce((a, b) => a + b, 0),
    daily,
    avgSuccess: ran.length ? Math.round(ran.reduce((s, o) => s + o.successRate, 0) / ran.length * 10) / 10 : 0,
  }
}

export interface OpsUnit extends DemoAgentLike { name: string }

/** 개요 화면용 — 에이전트와 팀(협업 흐름)을 함께 요약한다 */
export function summarizeAll(agents: OpsUnit[], teams: OpsUnit[]) {
  const aOps = agents.map(a => ({ unit: a, ops: getAgentDemoOps(a) }))
  const tOps = teams.map(t => ({ unit: t, ops: getAgentDemoOps(t) }))
  const day = (list: typeof aOps) => Array.from({ length: 7 }, (_, d) => list.reduce((s, x) => s + x.ops.runs7d[d], 0))
  const agentDaily = day(aOps), teamDaily = day(tOps)
  const all = [...aOps, ...tOps]
  const ran = all.filter(x => x.ops.runsTotal > 0)
  const isOn = (u: DemoAgentLike) => u.deployment?.status === '배치됨'
  return {
    agents: agents.length, teams: teams.length,
    deployedAgents: agents.filter(isOn).length, deployedTeams: teams.filter(isOn).length,
    agentDaily, teamDaily,
    weekRuns: [...agentDaily, ...teamDaily].reduce((a, b) => a + b, 0),
    avgSuccess: ran.length ? Math.round(ran.reduce((s, x) => s + x.ops.successRate, 0) / ran.length * 10) / 10 : 0,
    pending: all.filter(x => x.ops.pending).map(x => x.unit),
  }
}
