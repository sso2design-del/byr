/* 감사 기록(/api/audit) → 사람이 읽는 말. 모르는 코드는 그대로 보여준다(숨기지 않는다). */
export interface AuditItem { ts: string; actor: string; action: string; target: string; detail: string }

export const ACTIVITY_LABEL: Record<string, string> = {
  HIRE: '에이전트 생성', UPDATE: '설정 변경', DELETE: '에이전트 삭제',
  DEPLOY: '채널 배치', UNDEPLOY: '배치 해제', ARCHIVE: '채널 보관',
  TEAM_CREATE: '팀 생성', TEAM_UPDATE: '팀 설정 변경', TEAM_DELETE: '팀 삭제',
  TEAM_DEPLOY: '팀 채널 배치', TEAM_UNDEPLOY: '팀 배치 해제',
  FLOW_CREATE: '협업 흐름 생성', FLOW_UPDATE: '협업 흐름 편집',
  KB_ADD: '문서 추가', KB_REMOVE: '문서 제거', MODEL_CALL: '모델 호출',
  STAGE: '작업 준비', COMMIT: '확정', UNDO: '되돌림', EXTERNAL_ACTION: '외부 전송',
  PROPOSE: '제안서 작성', PROPOSE_APPROVE: '제안서 승인', REJECT: '반려', CONNECT: '연결',
}

/** 7일 이내는 상대 시간, 그 이전은 MM.DD HH:mm */
export function whenText(ts: string, now = new Date()): string {
  const t = new Date(ts)
  if (Number.isNaN(t.getTime())) return ts
  const m = Math.floor((now.getTime() - t.getTime()) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`
  if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)}일 전`
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(t.getMonth() + 1)}.${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

const FIELD_LABEL: Record<string, string> = {
  name: '이름', purpose: '목적', status: '상태', agents: '멤버', flows: '협업 흐름', icon: '아이콘',
  tone: '말투', capabilities: '스킬', file_paths: '파일 경로', mcp: '연결', llm_key: '모델', deployment: '배치',
}
const PLATFORM_LABEL: Record<string, string> = { slack: 'Slack', dooray: 'Dooray', discord: 'Discord', telegram: 'Telegram' }

/** 감사 detail의 내부 표기(['name', 'purpose'] · slack #채널)를 읽기 쉬운 말로 */
export function detailText(detail: string): string {
  const d = (detail || '').trim()
  const list = d.match(/^\[(.*)\]$/)
  if (list) {
    const keys = list[1].split(',').map(k => k.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    return keys.length ? `변경: ${keys.map(k => FIELD_LABEL[k] ?? k).join(' · ')}` : ''
  }
  return d.replace(/^(slack|dooray|discord|telegram)\b/i, m => PLATFORM_LABEL[m.toLowerCase()] ?? m)
}
