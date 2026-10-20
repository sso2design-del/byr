import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Switch } from '@astryxdesign/core/Switch'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { getAgentDemoOps } from '../data/agentDemoOps'
import { ResultBadge } from '../components/CardParts'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Spinner } from '@astryxdesign/core/Spinner'
import { List, ListItem } from '@astryxdesign/core/List'
import { ChevronLeft, ChevronDown, ChevronRight, Save, X, Search, Check, MessageSquare, Headphones, Send, Folder, Trash2, CalendarClock, Download } from 'lucide-react'
import RoutineWizard, { type AgentOption, type RoutineDef } from '../components/RoutineWizard'
import { EmojiIcon } from '../utils/icons'
import { AgentIconBadge } from '../utils/agentIcon'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { McpLogoIcon } from '../utils/mcpLogos'
import { PlatformLogo } from '../utils/platformLogos'
import { FilterDropdown } from '../components/FilterDropdown'
import { SKILL_CATALOG, SKILL_CATEGORIES, SKILL_RECOMMENDED, SKILL_EMOJI } from '../utils/skillCatalog'
import type { SkillDef } from '../utils/skillCatalog'
import { type SubOption, CAP_SUBOPTIONS, JOB_CATEGORY, ROLE_CAP_SUBOPTIONS } from '../utils/skillSubOptions'
import { useRole } from '../contexts/RoleContext'

// ── 타입 정의 ────────────────────────────────────────────────

interface Capability { key: string; icon: string; label: string; on: boolean; detail: string }
interface McpItem { key: string; name: string; icon: string; connected: boolean }
interface Deployment { platform: string | null; channel: string; status: string }
interface Agent {
  id: string; name: string; icon: string; role: string; purpose: string
  status: string; job: string | null; tone: string[]; model: string
  llm_key?: string; created_at?: string; created_by?: string
  capabilities: Capability[]; file_paths: string[]; mcp: McpItem[]; deployment: Deployment
}
// ── 상수 ─────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { name: string; bg: string; Icon: React.ElementType }> = {
  slack:    { name: 'Slack',    bg: '#4A154B', Icon: MessageSquare },
  dooray:   { name: 'Dooray',   bg: '#5C3EBC', Icon: MessageSquare },
  discord:  { name: 'Discord',  bg: '#5865F2', Icon: Headphones },
  telegram: { name: 'Telegram', bg: '#229ED9', Icon: Send },
}

const JOB_CHANNEL_DEFAULTS: Record<string, Record<string, string>> = {
  vat_reconcile:       { slack: '#재무팀-봇',   dooray: '#재무팀-봇',   discord: '#재무팀-봇',   telegram: '재무팀봇'  },
  insurance_fp:        { slack: '#보험-fp-봇',  dooray: '#보험-fp-봇',  discord: '#보험-fp-봇',  telegram: '보험FP봇'  },
  securities_research: { slack: '#리서치-봇',   dooray: '#리서치-봇',   discord: '#리서치-봇',   telegram: '리서치봇'  },
  compliance_aml:      { slack: '#준법감사-봇', dooray: '#준법감사-봇', discord: '#준법감사-봇', telegram: '준법감사봇' },
  hr:                  { slack: '#인사팀-봇',   dooray: '#인사팀-봇',   discord: '#인사팀-봇',   telegram: '인사팀봇'  },
  pm_brief:            { slack: '#기획팀-봇',   dooray: '#기획팀-봇',   discord: '#기획팀-봇',   telegram: '기획팀봇'  },
  dev_incident:        { slack: '#개발운영-봇', dooray: '#개발운영-봇', discord: '#개발운영-봇', telegram: '개발운영봇' },
  sales:               { slack: '#영업팀-봇',   dooray: '#영업팀-봇',   discord: '#영업팀-봇',   telegram: '영업팀봇'  },
}

function getDefaultChannel(job: string | null | undefined, name: string, platform: string): string {
  // 채널명은 에이전트 이름 기반(접두사 없음). 이름이 비었을 때만 직무 기본으로 폴백.
  const slug = name.trim().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').toLowerCase()
  if (slug) return platform === 'telegram' ? slug : `#${slug}`
  const d = JOB_CHANNEL_DEFAULTS[job ?? '']
  if (d) return d[platform] ?? d.slack
  return platform === 'telegram' ? '봇' : '#봇'
}

// '기존 채널 선택'은 Slack 워크스페이스의 실제 채널 목록(/api/slack/channels)에서 고른다
interface SlackChannel { name: string; private: boolean; member: boolean }
type ChannelList = { status: 'idle' | 'loading' | 'ok' | 'error'; items: SlackChannel[]; error?: string }
// 채널명 슬러그화(Slack 규칙: 소문자·공백 불가·최대 80)
const slugifyChannel = (s: string) =>
  s.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80)


// 활동 이력 — 감사 기록(/activity)을 사람이 읽을 형태로 옮긴다.
interface ActivityItem { ts: string; actor: string; action: string; target: string; detail: string }

// 감사 action → 사람이 읽는 라벨. 모르는 코드는 그대로 보여준다(숨기지 않는다).
const ACTION_LABEL: Record<string, string> = {
  HIRE: '에이전트 생성', UPDATE: '설정 변경', DELETE: '삭제',
  DEPLOY: '채널 배치', UNDEPLOY: '배치 해제',
  KB_ADD: '문서 추가', KB_REMOVE: '문서 제거', KB_READ: '문서 참조',
  MODEL_CALL: '모델 호출', STAGE: '작업 준비', COMMIT: '확정', UNDO: '되돌림',
  EXTERNAL_ACTION: '외부 전송', PROPOSE: '제안서 작성', PROPOSE_APPROVE: '제안서 승인',
  CANCEL: '취소', REJECT: '반려', CONNECT: '연결',
}
// 위험/외부로 나가는 것은 눈에 띄게
const ACTION_TONE: Record<string, 'external' | 'normal'> = {
  EXTERNAL_ACTION: 'external', MODEL_CALL: 'external', DEPLOY: 'external',
}



// ── LLM 모델 목록 ──────────────────────────────────────────────

const LLM_MODELS = [
  { key: 'builtin',           label: '내장 LLM',         desc: 'Byr 기본 제공 모델', external: false },
  { key: 'openai_gpt4o',      label: 'OpenAI GPT-4o',    desc: '고성능 범용 언어 모델',   external: true  },
  { key: 'anthropic_claude',  label: 'Anthropic Claude', desc: '지시 수행·안전성 특화',   external: true  },
]

function QrCode({ size = 120 }: { size?: number }) {
  const cells = 13; const cs = size / cells
  const p = [
    [1,1,1,1,1,1,1,0,1,0,1,1,0],[1,0,0,0,0,0,1,0,0,1,0,1,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,0],[1,0,1,1,1,0,1,0,0,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,0],[1,0,0,0,0,0,1,0,1,0,1,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1],[0,0,0,0,0,0,0,0,1,1,0,1,0],
    [1,1,0,1,0,1,1,1,0,0,1,1,0],[0,0,1,1,1,0,0,1,1,0,0,0,1],
    [1,0,1,0,1,1,1,0,0,1,1,0,0],[0,1,1,0,0,0,0,1,0,1,0,1,1],
    [1,1,1,1,1,0,1,0,1,0,1,1,1],
  ]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="#fff" />
      {p.map((row, r) => row.map((cell, c) =>
        cell ? <rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill="#111" /> : null
      ))}
    </svg>
  )
}

// ── MCP ───────────────────────────────────────────────────────

const MCP_DESCRIPTIONS: Record<string, string> = {
  gdrive:  'Google Drive의 파일·폴더에 읽기·쓰기 접근 권한을 제공합니다. 에이전트가 문서를 열람·저장하고 공유 드라이브를 탐색할 수 있습니다.',
  email:   '이메일 계정(Gmail·Outlook·네이버·다음·기타)을 연결해 에이전트가 메일을 발송합니다. 제안서 PDF 첨부 발송 등에 사용합니다.',
  hometax: '국세청 홈택스의 세금계산서·납부 내역·사업자 정보를 조회합니다. 세무 신고 자동화에 필요한 공식 데이터를 가져옵니다.',
  erp:     '사내 ERP(더존)의 회계 장부·인사·예산 데이터에 접근합니다. 전표 생성·조회·보고서 실행을 에이전트가 수행할 수 있습니다.',
  sheets:  '구글 시트의 셀 범위 읽기·쓰기, 수식 실행, 시트 관리 기능을 제공합니다. 재무 데이터를 시트에서 직접 처리할 수 있습니다.',
  jira:    'Jira 이슈 조회·생성·상태 업데이트를 수행합니다. 스프린트 현황 확인, 인시던트 이슈 자동 등록, PM 작업 추적에 활용됩니다.',
}

const MCP_FULL_CATALOG: McpItem[] = [
  { key: 'gdrive',  name: 'Google Drive',    icon: '📂', connected: false },
  { key: 'email',   name: '이메일',          icon: '✉️', connected: false },
  { key: 'hometax', name: '국세청 홈택스',    icon: '🏛️', connected: false },
  { key: 'erp',     name: '사내 ERP (더존)', icon: '🗄️', connected: false },
  { key: 'sheets',  name: '구글 시트',        icon: '📊', connected: false },
  { key: 'jira',    name: 'Jira',             icon: '🔷', connected: false },
]


// ── 스킬 편집 모달 ────────────────────────────────────────────

interface SkillEditModalProps {
  currentKeys: Set<string>
  agentJob?: string
  initialSubOptions?: Record<string, Record<string, boolean>>
  onSave: (keys: Set<string>, subOptions: Record<string, Record<string, boolean>>) => void
  onClose: () => void
}

function SkillEditModal({ currentKeys, agentJob, initialSubOptions, onSave, onClose }: SkillEditModalProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(currentKeys))
  const [subOptions, setSubOptions] = React.useState<Record<string, Record<string, boolean>>>(initialSubOptions ?? {})
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('전체')
  const [catOpen, setCatOpen] = React.useState(false)
  const [catPos, setCatPos] = React.useState({ top: 0, left: 0, minWidth: 0 })
  const catWrapRef = React.useRef<HTMLDivElement>(null)
  const catDropRef = React.useRef<HTMLDivElement>(null)

  const hasSelection = category !== '전체'

  const jobCat = JOB_CATEGORY[agentJob ?? ''] ?? ''

  // 필터 카테고리 → 직무 범주 매핑 (필터 변경 시 세부 옵션도 전환)
  const CAT_JOB: Record<string, string> = {
    '재무·회계': 'finance',
    '기획/PM': 'pm',
    '인사·총무': 'hr',
    '개발·운영': 'dev',
  }
  const activeCat = CAT_JOB[category] ?? jobCat

  const getSubOpts = (skillKey: string): SubOption[] => {
    const role = activeCat ? ROLE_CAP_SUBOPTIONS[activeCat]?.[skillKey] : undefined
    return role ?? CAP_SUBOPTIONS[skillKey] ?? []
  }

  const handleCatToggle = () => {
    if (!catOpen && catWrapRef.current) {
      const rect = catWrapRef.current.getBoundingClientRect()
      setCatPos({ top: rect.bottom + 6, left: rect.left, minWidth: Math.max(rect.width, 140) })
    }
    setCatOpen(v => !v)
  }

  React.useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (!catWrapRef.current?.contains(e.target as Node) && !catDropRef.current?.contains(e.target as Node))
        setCatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  const displayed = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q) return SKILL_CATALOG.filter(s => s.label.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    const keys = SKILL_RECOMMENDED[category] ?? SKILL_RECOMMENDED['전체']
    return keys.map(k => SKILL_CATALOG.find(s => s.key === k)).filter((s): s is SkillDef => Boolean(s))
  }, [search, category])

  const toggleSkill = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key); if (expandedKey === key) setExpandedKey(null) }
      else next.add(key)
      return next
    })
  }

  const setSubOpt = (skillKey: string, optKey: string, val: boolean) => {
    setSubOptions(prev => ({ ...prev, [skillKey]: { ...(prev[skillKey] ?? {}), [optKey]: val } }))
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)',
          width: 560, maxWidth: '100%', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>스킬 편집</div>
            <button onClick={onClose} style={{ background: 'var(--color-background-muted)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />
            </button>
          </div>
          {/* 필터 바 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <div ref={catWrapRef} style={{ flexShrink: 0 }}>
              <button
                onClick={handleCatToggle}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 14px', height: 40, borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border)',
                  background: hasSelection ? 'var(--color-background-muted)' : 'var(--color-background-surface)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: hasSelection ? 600 : 400,
                  color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
                }}
              >
                {category}
                <AstryxIcon icon={ChevronDown} size="sm" color="secondary" strokeWidth={2}
                  style={{ transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {catOpen && createPortal(
                <div ref={catDropRef} style={{
                  position: 'fixed', top: catPos.top, left: catPos.left, minWidth: catPos.minWidth,
                  zIndex: 9999, background: 'var(--color-background-surface)',
                  border: '1px solid var(--color-border-emphasized)',
                  borderRadius: 'var(--radius-element)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  overflow: 'hidden', padding: '4px 0',
                }}>
                  {SKILL_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => { setCategory(cat); setSearch(''); setCatOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '9px 14px',
                        background: category === cat ? 'var(--color-background-muted)' : 'none',
                        border: 'none', cursor: 'pointer',
                        fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'left',
                      }}>
                      {cat}
                      {category === cat && <AstryxIcon icon={Check} size="sm" color="primary" strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 40, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
              <AstryxIcon icon={Search} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="스킬 검색..."
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit' }} />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <AstryxIcon icon={X} size="sm" color="secondary" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'inherit' }}>
            {search.trim() ? `검색 결과 ${displayed.length}개` : category === '전체' ? '추천 스킬' : category}
          </div>
        </div>

        {/* 스킬 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {displayed.length === 0 ? (
            <div style={{ padding: '24px 0', color: '#a3a3a3', fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }}>
              "{search}"에 맞는 스킬이 없습니다.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', marginTop: 10, marginBottom: 8 }}>
              {displayed.map((skill, idx) => {
                const on = selected.has(skill.key)
                const subOpts = getSubOpts(skill.key)
                const hasSubOpts = on && (subOpts.length > 0 || skill.key === 'file')
                const isExpanded = expandedKey === skill.key
                const subVals = subOptions[skill.key] ?? {}
                return (
                  <div key={skill.key} style={{ borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none' }}>
                    {/* 스킬 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '11px 14px' }}>
                      {/* 펼치기 버튼 */}
                      <button
                        onClick={() => { if (hasSubOpts) setExpandedKey(isExpanded ? null : skill.key) }}
                        style={{
                          flexShrink: 0, width: 20, height: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', padding: 0, borderRadius: 'var(--radius-full)',
                          cursor: hasSubOpts ? 'pointer' : 'default',
                          color: hasSubOpts ? 'var(--color-icon-secondary)' : 'transparent',
                        }}
                      >
                        {hasSubOpts && (isExpanded ? <AstryxIcon icon={ChevronDown} size="sm" /> : <AstryxIcon icon={ChevronRight} size="sm" />)}
                      </button>
                      {/* 아이콘 */}
                      <div style={{ flexShrink: 0, opacity: on ? 1 : 0.4 }}>
                        <AstryxIcon icon={skill.icon} size="sm" color="primary" strokeWidth={on ? 2 : 1.6} />
                      </div>
                      {/* 레이블·설명 */}
                      <div style={{ flex: 1, marginLeft: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: on ? 600 : 400, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                          {skill.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>
                          {skill.detail}
                        </div>
                      </div>
                      {/* 스위치 */}
                      <div style={{ opacity: on ? 1 : 0.45, flexShrink: 0 }}>
                        <Switch label="" value={on} onChange={() => toggleSkill(skill.key)} />
                      </div>
                    </div>

                    {/* 세부 옵션 패널 */}
                    {isExpanded && subOpts.length > 0 && (
                      <div style={{
                        margin: '0 14px 10px 38px',
                        padding: '10px 14px', borderRadius: 'var(--radius-inner)',
                        background: 'var(--color-background-muted)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', flexDirection: 'column', gap: 9,
                      }}>
                        {subOpts.map(opt => {
                          const checked = subVals[opt.key] ?? opt.defaultOn
                          return (
                            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontFamily: 'inherit' }}>
                              <input
                                type="checkbox" checked={checked}
                                onChange={e => setSubOpt(skill.key, opt.key, e.target.checked)}
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
          )}
        </div>

        {/* 푸터 */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#a3a3a3', fontFamily: 'inherit' }}>
            {selected.size}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: '1.5px solid #e5e5e5', background: 'white', fontSize: 14, fontWeight: 500, color: '#525252', cursor: 'pointer', fontFamily: 'inherit' }}>
              취소
            </button>
            <button onClick={() => onSave(selected, subOptions)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', background: '#1a1a1a', fontSize: 14, fontWeight: 600, color: 'var(--color-on-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
              저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── MCP 편집 모달 ─────────────────────────────────────────────

interface McpEditModalProps {
  currentMcp: McpItem[]
  onSave: (mcp: McpItem[]) => void
  onClose: () => void
}

function McpEditModal({ currentMcp, onSave, onClose }: McpEditModalProps) {
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(currentMcp.map(m => m.key))
  )

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = () => {
    const existingMap: Record<string, McpItem> = {}
    currentMcp.forEach(m => { existingMap[m.key] = m })
    const newMcp = MCP_FULL_CATALOG
      .filter(c => selected.has(c.key))
      .map(c => existingMap[c.key] ?? { ...c, connected: false })
    onSave(newMcp)
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)',
          width: 560, maxWidth: '100%', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 24px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>MCP 편집</div>
            <button onClick={onClose} style={{ background: 'var(--color-background-muted)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* MCP 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', marginBottom: 8 }}>
            {MCP_FULL_CATALOG.map((mcp, idx) => {
              const on = selected.has(mcp.key)
              return (
                <div
                  key={mcp.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '11px 14px',
                    borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ flexShrink: 0, opacity: on ? 1 : 0.4 }}>
                    <McpLogoIcon mcpKey={mcp.key} size={28} />
                  </div>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: on ? 600 : 400, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                      {mcp.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>
                      {MCP_DESCRIPTIONS[mcp.key]?.split('.')[0] ?? ''}
                    </div>
                  </div>
                  <div style={{ opacity: on ? 1 : 0.45, flexShrink: 0 }}>
                    <Switch label="" value={on} onChange={() => toggle(mcp.key)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#a3a3a3', fontFamily: 'inherit' }}>
            {selected.size}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: '1.5px solid #e5e5e5', background: 'white', fontSize: 14, fontWeight: 500, color: '#525252', cursor: 'pointer', fontFamily: 'inherit' }}>
              취소
            </button>
            <button onClick={handleSave} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', background: '#1a1a1a', fontSize: 14, fontWeight: 600, color: 'var(--color-on-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
              저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── 이메일 연결 모달 (MCP 커넥터 · 계정별 버튼 → OAuth/폼) ────────────
interface MailProvider { key: string; label: string; note: string; help: string; needs_server: boolean; oauth?: boolean; oauth_ready?: boolean }

// 계정별 버튼 브랜드(로그인식). google·outlook은 프로덕션에서 OAuth.
const MAIL_BRAND: Record<string, { label: string; color: string; fg?: string; mark: string; oauth?: boolean }> = {
  gmail:   { label: 'Google로 연결',  color: '#fff', fg: '#3c4043', mark: 'G', oauth: true },
  outlook: { label: 'Outlook으로 연결', color: '#0F6CBD', fg: '#fff', mark: 'O', oauth: true },
  naver:   { label: '네이버로 연결',   color: '#03C75A', fg: '#fff', mark: 'N' },
  daum:    { label: '다음 / 카카오',   color: '#FEE500', fg: '#3c1e1e', mark: 'k' },
  custom:  { label: '기타 SMTP',       color: '#5B6472', fg: '#fff', mark: '@' },
}

function EmailConnectModal({ onConnected, onClose }: { onConnected: (addr: string) => void; onClose: () => void }) {
  const [providers, setProviders] = React.useState<MailProvider[]>([])
  const [provider, setProvider] = React.useState<string | null>(null)  // null = 계정 선택 단계
  const [address, setAddress] = React.useState('')
  const [pw, setPw] = React.useState('')
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState('465')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  React.useEffect(() => {
    fetch('/api/connectors/email/providers').then(r => r.json()).then(setProviders).catch(() => setProviders([]))
  }, [])

  const cur = providers.find(p => p.key === provider)
  const custom = cur?.needs_server
  const brand = provider ? MAIL_BRAND[provider] : null

  // 실제 OAuth 팝업 → 연결될 때까지 폴링
  const startOAuth = (key: string) => {
    const path = key === 'gmail' ? '/api/oauth/google/start' : ''
    if (!path) return
    setErr(''); setBusy(true)
    const popup = window.open(path, 'byr-oauth', 'width=520,height=660')
    const started = Date.now()
    const timer = window.setInterval(async () => {
      try {
        const d = await fetch('/api/connectors/email').then(r => r.json())
        if (d.connected) { clearInterval(timer); setBusy(false); onConnected(d.address || ''); return }
      } catch { /* keep polling */ }
      if (popup && popup.closed) { clearInterval(timer); setBusy(false); setErr('로그인 창이 닫혔습니다. 연결이 완료되지 않았어요.') }
      else if (Date.now() - started > 180000) { clearInterval(timer); setBusy(false) }
    }, 1500)
  }

  const pick = (key: string) => {
    const p = providers.find(x => x.key === key)
    if (p?.oauth && p?.oauth_ready) { startOAuth(key); return }   // 실제 로그인 팝업
    setProvider(key); setErr(''); setAddress(''); setPw('')       // SMTP/앱비번 폼
  }

  const connect = async () => {
    setBusy(true); setErr('')
    try {
      const body: Record<string, unknown> = { provider, address: address.trim(), password: pw }
      if (custom) { body.host = host.trim(); body.port = Number(port) || 0 }
      const r = await fetch('/api/connectors/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (r.ok) { const d = await r.json(); onConnected(d.address || address.trim()) }
      else { const d = await r.json().catch(() => ({})); setErr(d.detail || '연결에 실패했습니다.') }
    } catch { setErr('연결에 실패했습니다.') }
    finally { setBusy(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 14px', borderRadius: 10, boxSizing: 'border-box',
    border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  }
  const canSubmit = address.trim() && pw && (!custom || (host.trim() && port))

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--color-background-surface)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <McpLogoIcon mcpKey="email" size={32} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>이메일 연결</div>
        </div>

        {!provider ? (
          /* ── 1단계: 계정별 버튼 ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 9, background: 'var(--color-background-muted)', marginBottom: 2 }}>
              프로덕션에선 <b>Byr 로그인에 쓴 계정(Google·Microsoft)</b>의 메일이 자동 연동돼 재입력이 필요 없습니다. 지금은 데모라 계정을 골라 연결하세요.
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 2 }}>연결할 메일 계정을 선택하세요.</div>
            {(providers.length ? providers.map(p => p.key) : Object.keys(MAIL_BRAND)).map(key => {
              const b = MAIL_BRAND[key]; if (!b) return null
              return (
                <button key={key} onClick={() => pick(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 14px',
                  borderRadius: 12, border: '1px solid var(--color-border-emphasized)',
                  background: 'var(--color-background-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: b.color, color: b.fg, border: b.color === '#fff' ? '1px solid var(--color-border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{b.mark}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{b.label}</span>
                  {b.oauth && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-secondary)', padding: '2px 7px', borderRadius: 999, background: 'var(--color-background-muted)' }}>{providers.find(p => p.key === key)?.oauth_ready ? '로그인' : 'OAuth'}</span>}
                  <AstryxIcon icon={ChevronRight} size="xsm" color="secondary" strokeWidth={2} />
                </button>
              )
            })}
            {busy && <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', textAlign: 'center', paddingTop: 4 }}>로그인 창에서 계속하세요…</div>}
            {err && <div style={{ fontSize: 12.5, color: 'var(--color-status-error, #c0392b)' }}>{err}</div>}
          </div>
        ) : (
          /* ── 2단계: 선택한 계정 연동(동의) 화면 ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setProvider(null)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12.5, fontFamily: 'inherit', padding: 0 }}>
              <AstryxIcon icon={ChevronLeft} size="xsm" color="inherit" strokeWidth={2} /> 다른 계정 선택
            </button>

            {/* 브랜드 헤더(로그인/동의 화면 느낌) */}
            <div style={{ textAlign: 'center', padding: '2px 0' }}>
              <span style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: 13, background: brand?.color, color: brand?.fg, border: brand?.color === '#fff' ? '1px solid var(--color-border)' : 'none', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{brand?.mark}</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{(brand?.label || '').replace('로 연결', '')} 계정으로 연결</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>Byr가 이 계정으로 제안서 메일을 발송합니다.</div>
            </div>

            {/* 요청 권한 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--color-background-muted)', fontSize: 12.5, color: 'var(--color-text-primary)' }}>
              <AstryxIcon icon={Check} size="xsm" color="inherit" strokeWidth={2.4} />
              메일 보내기(제안서 PDF 발송) 권한
            </div>

            {brand?.oauth && (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 9, background: 'var(--color-background-muted)' }}>
                프로덕션에선 이 버튼이 <b>{provider === 'gmail' ? 'Google' : 'Microsoft'} 로그인·동의 팝업</b>을 띄워 비밀번호 없이 연결합니다. 지금은 데모라 아래 계정 인증으로 연결하세요{provider === 'gmail' ? '(앱 비밀번호)' : ''}.
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {cur?.note}
              {cur?.help && <a href={cur.help} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', marginLeft: 4, textDecoration: 'none' }}>도움말 ↗</a>}
            </div>
            <input style={inputStyle} type="email" value={address} onChange={e => setAddress(e.target.value)} placeholder="you@example.com" />
            <input style={inputStyle} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={provider === 'gmail' ? '앱 비밀번호 16자' : '비밀번호(또는 앱 비밀번호)'} />
            {custom && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
                <input style={{ ...inputStyle, flex: 1 }} value={port} onChange={e => setPort(e.target.value)} placeholder="465" />
              </div>
            )}
            {err && <div style={{ fontSize: 12.5, color: 'var(--color-status-error, #c0392b)' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
              <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>취소</button>
              <button onClick={busy ? undefined : connect} disabled={busy || !canSubmit} style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: !canSubmit ? 'var(--color-background-muted)' : 'var(--color-accent)', color: !canSubmit ? 'var(--color-text-secondary)' : 'var(--color-on-accent)', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer' }}>{busy ? '연결 확인 중…' : '허용하고 연결'}</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

interface UndeployNotice { archived: boolean; channel: string; platform: string | null; reason: string | null }
interface DeployNotice { sent: boolean; channel: string; reason: string | null }

// 배치 안내를 못 보낸 이유 — 백엔드 notify_channel 결과(error 코드)를 사용자 말로
function noticeReason(reason: string | null): string {
  switch (reason) {
    case 'no_token_or_channel': return '메신저 봇이 연결되어 있지 않습니다. 관리자가 봇 토큰을 설정하면 다음 배치부터 안내가 갑니다.'
    case 'is_archived': return '채널이 보관된 상태입니다. Slack에서 채널을 되살린 뒤 다시 시도해 주세요.'
    case 'cant_archive_general': return '기본(general) 채널은 보관할 수 없습니다.'
    case 'not_found': return '메신저에서 이 채널을 찾지 못했습니다. 채널 이름을 확인해 주세요.'
    case 'missing_scope': return 'Slack 앱 권한이 부족합니다. chat:write · channels:read · groups:read · channels:join · channels:manage · groups:write 스코프를 추가하고 앱을 다시 설치해 주세요.'
    case 'invalid_auth':
    case 'not_authed':
    case 'account_inactive':
    case 'token_revoked': return '봇 토큰이 올바르지 않습니다. Slack 앱의 Bot User OAuth Token(xoxb-)을 다시 확인해 주세요.'
    case 'unsupported_platform': return '이 플랫폼은 아직 배치 안내 메시지를 지원하지 않습니다.'
    default: return '잠시 후 다시 배치하거나 메신저 채널에서 직접 확인해 주세요.'
  }
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useRole()

  const [agent, setAgent] = useState<Agent | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [newPath, setNewPath] = useState('')
  const [deployPlatform, setDeployPlatform] = useState<string>('')
  const [deployChannel, setDeployChannel] = useState('')
  const [channelManuallyEdited, setChannelManuallyEdited] = useState(false)
  // 워크스페이스 연동 → 채널 생성/선택 (목 인터랙션)
  const [wsConnected, setWsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [channelMode, setChannelMode] = useState<'create' | 'existing'>('create')
  const [slackChannels, setSlackChannels] = useState<ChannelList>({ status: 'idle', items: [] })
  // Slack을 고르면 실제 채널 목록을 불러온다(새 채널 이름 중복 확인에도 쓴다)
  const loadSlackChannels = async () => {
    setSlackChannels({ status: 'loading', items: [] })
    try {
      const r = await fetch('/api/slack/channels').then(res => res.json()) as { ok: boolean; channels?: SlackChannel[]; error?: string }
      setSlackChannels(r.ok ? { status: 'ok', items: r.channels ?? [] } : { status: 'error', items: [], error: r.error })
    } catch {
      setSlackChannels({ status: 'error', items: [], error: 'network' })
    }
  }
  useEffect(() => {
    if (deployPlatform === 'slack' && slackChannels.status === 'idle') loadSlackChannels()
  }, [deployPlatform])  // eslint-disable-line react-hooks/exhaustive-deps

  const [channelPrivate, setChannelPrivate] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  // 활동 이력 로드 — 감사 기록 기반(대화 안 했어도 생성·배치는 남는다).
  useEffect(() => {
    if (!agent?.id) return
    fetch(`/api/agents/${agent.id}/activity?limit=50`)
      .then(r => r.json()).then(d => setActivity(d.items || []))
      .catch(() => setActivity([]))
  }, [agent?.id, agent?.deployment?.status])



  // 스킬 세부 옵션은 기본으로 모두 펼침 — 사용자가 접은 항목 key만 collapsed에 담는다
  const [collapsedCapKeys, setCollapsedCapKeys] = useState<Set<string>>(new Set())
  const [capSubOptions, setCapSubOptions] = useState<Record<string, Record<string, boolean>>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)


  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSkillEdit, setShowSkillEdit] = useState(false)
  const [isRoutineOpen, setIsRoutineOpen] = useState(false)
  const [routineSaved, setRoutineSaved] = useState(false)

  const JOB_SCHEDULE_DEFAULTS: Record<string, { name: string; message: string }> = {
    vat_reconcile:       { name: '주간 매출 요약',       message: '지난 7일간 매입·매출 원장을 대사하고 이상 항목을 요약해줘.' },
    insurance_fp:        { name: '주간 보장 분석 요약',   message: '이번 주 신규 상담 고객의 보장 갭 분석 결과를 정리해줘.' },
    securities_research: { name: '주간 공시·뉴스 요약',  message: '이번 주 주요 공시와 리서치 관련 뉴스를 종합 요약해줘.' },
    compliance_aml:      { name: '주간 이상거래 보고',    message: '이번 주 이상거래 탐지 결과와 STR 초안을 정리해줘.' },
    hr:                  { name: '주간 인사 현황 보고',   message: '이번 주 근태 요약과 채용 진행 현황을 정리해줘.' },
    pm_brief:            { name: '주간 기획 현황 보고',   message: '이번 주 기획 진행 상황과 주요 결정 사항을 요약해줘.' },
    dev_incident:        { name: '주간 개발 현황 보고',   message: '이번 주 배포 현황, 인시던트 및 PR 리뷰 요약을 정리해줘.' },
  }
  const scheduleInitialValues = agent
    ? (() => {
        const d = JOB_SCHEDULE_DEFAULTS[agent.job ?? '']
        return d
          ? { name: d.name, message: d.message, frequency: 'weekly' as const }
          : { name: `${agent.name} 정기 실행`, message: '', frequency: 'weekly' as const }
      })()
    : undefined
  const [selectedLlmKey, setSelectedLlmKey] = useState('builtin')
  const [showLlmQr, setShowLlmQr] = useState(false)
  const [llmConnected, setLlmConnected] = useState(false)

  // MCP 연결 설정 패널
  const [showMcpQr, setShowMcpQr] = useState<string | null>(null)
  const [showMcpEdit, setShowMcpEdit] = useState(false)
  const [emailConnected, setEmailConnected] = useState(false)
  const [emailAddress, setEmailAddress] = useState<string | null>(null)
  const [showGmailConnect, setShowGmailConnect] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // 배치 직후 메신저 안내 발송 결과 — 사용자가 메신저에서 확인하도록 알려 준다
  const [deployNotice, setDeployNotice] = useState<DeployNotice | null>(null)
  // 배치 해제 확인창 + 해제 직후 되돌리기
  const [undeployOpen, setUndeployOpen] = useState(false)
  const [archiveOnUndeploy, setArchiveOnUndeploy] = useState(false)
  const [undoInfo, setUndoInfo] = useState<UndeployNotice | null>(null)

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, init)
    if (!res.ok) {
      let msg = '요청 처리 중 오류가 발생했습니다.'
      try {
        const body = await res.json() as { detail?: string }
        if (body?.detail) msg = body.detail
      } catch {
        // ignore parse error
      }
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  }

  const handleSkillSave = async (keys: Set<string>, subOpts: Record<string, Record<string, boolean>>) => {
    if (!agent) return
    const updated = SKILL_CATALOG
      .filter(s => keys.has(s.key))
      .map(s => ({ key: s.key, icon: SKILL_EMOJI[s.key] ?? '⚡', label: s.label, on: true, detail: s.detail }))
    try {
      setActionError(null)
      await fetchJson(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: updated }),
      })
      setAgent(prev => prev ? { ...prev, capabilities: updated } : null)
      setCapSubOptions(prev => ({ ...prev, ...subOpts }))
      setShowSkillEdit(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '스킬 저장에 실패했습니다.')
    }
  }

  const handleSave = () => {
    setSaveState('saved')
    setTimeout(() => navigate('/agents'), 1200)
  }
  const handleDeleteConfirm = async () => {
    try {
      setActionError(null)
      setShowDeleteConfirm(false)
      await fetchJson(`/api/agents/${id}`, { method: 'DELETE' })
      navigate('/agents')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const handleMcpEditSave = async (newMcp: McpItem[]) => {
    try {
      setActionError(null)
      await fetchJson(`/api/agents/${agent!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcp: newMcp }),
      })
      setAgent(prev => prev ? { ...prev, mcp: newMcp } : null)
      setShowMcpEdit(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'MCP 저장에 실패했습니다.')
    }
  }

  const handleLlmChange = async (key: string) => {
    setSelectedLlmKey(key)
    const label = LLM_MODELS.find(m => m.key === key)?.label ?? '내장 LLM'
    try {
      await fetchJson(`/api/agents/${agent!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm_key: key, model: label }),
      })
      setAgent(prev => prev ? { ...prev, llm_key: key, model: label } : null)
    } catch { /* silent — UI 이미 반영 */ }
  }

  useEffect(() => {
    if (!id) return
    setLoadError(null)
    fetchJson<Agent>(`/api/agents/${id}`)
      .then((a) => {
        setAgent(a)
        setSelectedLlmKey(a.llm_key ?? 'builtin')
        setDeployPlatform(a.deployment.platform ?? '')
        // 이미 배치됐으면 그 채널을 '기존 채널'로 보여주고, 아니면 에이전트 이름으로 새 채널명을 채운다
        setDeployChannel(a.deployment.channel || (a.deployment.platform ? getDefaultChannel(a.job, a.name, a.deployment.platform) : ''))
        setChannelManuallyEdited(!!a.deployment.channel)
        setChannelMode(a.deployment.channel ? 'existing' : 'create')
        // 생성 시 이미 플랫폼·채널을 골랐으면 워크스페이스 연결됨으로 간주 → 채널·채널명이 바로 입력된 상태로 보임
        setWsConnected(!!a.deployment.platform)
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : '에이전트를 불러오지 못했습니다.')
      })
    // Gmail 커넥터(계정 단위) 연결 상태 동기화
    fetch('/api/connectors/email')
      .then(r => r.json())
      .then(d => { setEmailConnected(!!d.connected); setEmailAddress(d.address ?? null) })
      .catch(() => {})
  }, [id])

  if (!agent) return (
    <VStack gap={3} style={{ padding: 40 }}>
      {loadError && (
        <Text type="body" style={{ color: 'var(--color-status-error)' }}>{loadError}</Text>
      )}
      <Spinner />
      <Text type="body" color="secondary">불러오는 중...</Text>
    </VStack>
  )

  const deployed = agent.deployment.status === '배치됨'
  const demoOps = getAgentDemoOps(agent)

  // ── 스킬 토글 ─────────────────────────────────────────────

  const handleCapToggle = async (capKey: string, newValue: boolean) => {
    const updated = agent.capabilities.map(c =>
      c.key === capKey ? { ...c, on: newValue } : c
    )
    try {
      setActionError(null)
      await fetchJson(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: updated }),
      })
      setAgent(prev => prev ? { ...prev, capabilities: updated } : null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '스킬 변경 저장에 실패했습니다.')
    }
  }

  // ── 파일 경로 ─────────────────────────────────────────────

  // 텍스트 소스(.md·.txt)면 내용을 읽어 에이전트 근거 소스로 연결(제안서 등에서 실제 사용)
  const isTextFile = (name: string) => /\.(md|markdown|txt)$/i.test(name)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !agent) return
    const labels: string[] = []
    for (const file of files) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      const path = rel ? '\\' + rel.split('/')[0] : file.name
      labels.push(path)
      // 텍스트 파일은 내용을 소스로 업로드(근거 검색 대상)
      if (isTextFile(file.name)) {
        try {
          const text = await file.text()
          if (text.trim()) {
            await fetchJson(`/api/agents/${agent.id}/kb`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, text }),
            })
          }
        } catch { /* 소스 업로드 실패는 라벨 추가는 유지 */ }
      }
    }
    const updated = [...agent.file_paths, ...labels.filter(p => !agent.file_paths.includes(p))]
    await savePaths(updated, '경로 추가에 실패했습니다.')
  }

  const savePaths = async (updated: string[], errMsg: string) => {
    try {
      setActionError(null)
      await fetchJson(`/api/agents/${agent.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_paths: updated }),
      })
      setAgent(prev => prev ? { ...prev, file_paths: updated } : null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : errMsg)
    }
  }

  const handleAddPath = async (path: string) => {
    if (!path.trim() || agent.file_paths.includes(path.trim())) return
    await savePaths([...agent.file_paths, path.trim()], '경로 추가에 실패했습니다.')
  }

  const handleRemovePath = async (path: string) => {
    // 텍스트 소스면 연결된 근거 문서도 함께 해제
    if (isTextFile(path)) {
      try { await fetchJson(`/api/agents/${agent.id}/kb-file?filename=${encodeURIComponent(path.split(/[\\/]/).pop() || path)}`, { method: 'DELETE' }) } catch { /* noop */ }
    }
    await savePaths(agent.file_paths.filter(p => p !== path), '경로 제거에 실패했습니다.')
  }

  // ── MCP 토글 ─────────────────────────────────────────────

  const handleMcpToggle = (mcpKey: string, wantConnect: boolean) => {
    // 이메일 = 자격증명 폼(모의 QR 아님). 연결/해제는 계정 커넥터 API로.
    if (mcpKey === 'email') {
      if (wantConnect) { setShowGmailConnect(true); return }
      void fetch('/api/connectors/email', { method: 'DELETE' })
        .then(() => { setEmailConnected(false); setEmailAddress(null) })
      return
    }
    if (wantConnect) {
      setShowMcpQr(mcpKey)
      return
    }
    void handleMcpSave(mcpKey, false)
    if (showMcpQr === mcpKey) setShowMcpQr(null)
  }

  const handleMcpSave = async (mcpKey: string, connected: boolean) => {
    const updated = agent.mcp.map(m =>
      m.key === mcpKey ? { ...m, connected } : m
    )
    try {
      setActionError(null)
      await fetchJson(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcp: updated }),
      })
      setAgent(prev => prev ? { ...prev, mcp: updated } : null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'MCP 연결 상태 저장에 실패했습니다.')
    }
  }

  // ── 배치 ─────────────────────────────────────────────────

  // 워크스페이스 연결(목 OAuth) — 실제로는 Slack "Add to Slack" OAuth로 워크스페이스별 봇 토큰 발급
  const connectWorkspace = () => {
    setConnecting(true)
    window.setTimeout(() => { setConnecting(false); setWsConnected(true) }, 900)
  }

  const handleDeploy = async () => {
    if (!deployPlatform) return
    // 새 채널: 슬러그화한 새 채널명 / 기존 채널: 선택값
    const isCreate = channelMode === 'create'
    const channel = isCreate ? deployChannel : deployChannel.trim()
    try {
      setActionError(null)
      const { notice, ...updated } = await fetchJson<Agent & { notice?: DeployNotice }>(`/api/agents/${agent.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: deployPlatform, channel, create: isCreate, private: channelPrivate, topic: `Byr · ${agent.name} 운영` }),
      })
      setAgent(updated)
      setDeployNotice(notice ?? { sent: false, channel: updated.deployment?.channel ?? channel, reason: 'no_response' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '배치에 실패했습니다.')
    }
  }

  const handleUndeploy = async () => {
    try {
      setActionError(null)
      const { notice, ...updated } = await fetchJson<Agent & { notice?: UndeployNotice }>(`/api/agents/${agent.id}/undeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: archiveOnUndeploy }),
      })
      setAgent(updated)
      setDeployNotice(null)
      setUndeployOpen(false)
      setUndoInfo(notice ?? null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '배치 해제에 실패했습니다.')
    }
  }

  // 되돌리기 — 같은 채널에 다시 배치(보관된 Slack 채널은 백엔드가 되살린다)
  const handleUndo = async () => {
    if (!undoInfo?.platform || !undoInfo.channel) return
    try {
      setActionError(null)
      const { notice, ...updated } = await fetchJson<Agent & { notice?: DeployNotice }>(`/api/agents/${agent.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: undoInfo.platform, channel: undoInfo.channel }),
      })
      setAgent(updated)
      setDeployPlatform(undoInfo.platform)
      setChannelMode('existing')
      setDeployChannel(undoInfo.channel)
      setUndoInfo(null)
      setDeployNotice(notice ?? null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '되돌리기에 실패했습니다.')
    }
  }

  // ── 대화 로그 다운로드 ────────────────────────────────────


  // ── 렌더 ─────────────────────────────────────────────────

  return (
    <>
    <VStack gap={0} style={{ padding: '32px 40px', maxWidth: 1100 }}>

      {/* 뒤로가기 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          label="내 에이전트"
          icon={<AstryxIcon icon={ChevronLeft} size="sm" />}
          variant="ghost"
          size="sm"
          onClick={() => navigate('/agents')}
        />
      </div>

      {actionError && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-element)', border: '1px solid var(--color-status-error)', background: 'var(--color-status-error-bg)' }}>
          <Text type="body" style={{ color: 'var(--color-status-error)' }}>{actionError}</Text>
        </div>
      )}

      {/* ── 히어로 헤더 — 좁은 화면에서는 버튼을 아래 줄로(mobile.css .m-hero) ── */}
      <div className="m-hero">
      <HStack gap={5} vAlign="start" style={{ marginBottom: 24 }}>
        <AgentIconBadge emoji={agent.icon} boxSize={80} iconSize={34} radius={20} colored glyphScale={1.5} />
        <VStack gap={2} style={{ flex: 1 }}>

          {/* 타이틀 + 상태 토글 인라인 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Heading level={1}>{agent.name}</Heading>
            {deployed && agent.deployment.platform ? (
              /* ── Sana-style: 텍스트가 pill 내부에 들어간 토글 ── */
              <button
                onClick={() => setIsActive(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 4px 4px 12px', borderRadius: 'var(--radius-full)', flexShrink: 0,
                  background: isActive ? 'var(--color-status-active)' : 'var(--color-text-disabled)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 600, color: '#ffffff',
                  whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                  {isActive ? '운영 중' : '대기 중'}
                </span>
                {/* 흰 원형 knob */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: '#ffffff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                }} />
              </button>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--color-background-surface)', border: '1px solid var(--color-border)',
                fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)',
                fontFamily: 'inherit', flexShrink: 0,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-border-emphasized)', flexShrink: 0 }} />
                미배치
              </div>
            )}
          </div>
          <Text type="body" color="secondary" style={{ maxWidth: 560 }}>{agent.purpose}</Text>
        </VStack>

        {/* ── 저장 / 삭제 / 스케줄 CTA ── */}
        <HStack gap={2} style={{ flexShrink: 0, paddingTop: 8 }}>
          <button
            onClick={() => setIsRoutineOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 22px', borderRadius: 'var(--radius-full)',
              background: 'transparent',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <AstryxIcon icon={CalendarClock} size="xsm" color="inherit" />
            스케줄 추가
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 22px', borderRadius: 'var(--radius-full)',
              background: 'transparent',
              border: '1.5px solid var(--color-error)',
              color: 'var(--color-error)',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            에이전트 삭제
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 22px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent)',
              border: 'none',
              color: 'var(--color-on-accent)',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saveState === 'saved' ? (
              <><AstryxIcon icon={Check} size="sm" style={{ marginRight: 6 }} />저장됨</>
            ) : '저장'}
          </button>
        </HStack>
      </HStack>
      </div>

      {/* ── 메타 스트립 ── */}
      <div style={{
        display: 'flex', gap: 0, flexWrap: 'wrap',
        paddingBottom: 24, marginBottom: 24,
        borderBottom: '1px solid var(--color-border)',
      }}>
        {[
          { label: '직무',   value: agent.role },
          { label: '모델',   value: LLM_MODELS.find(m => m.key === selectedLlmKey)?.label ?? '내장 LLM' },
          { label: '말투',   value: agent.tone.join(' · ') },
          { label: '등록일', value: agent.created_at ? agent.created_at.replace(/-/g, '.') : '—' },
          { label: '등록자', value: agent.created_by ?? '—' },
          // 운영 지표(데모) — 목록 카드는 상태만, 상세에서 '언제'를 보여준다
          { label: '최근 7일 실행', value: `${demoOps.runsTotal}건` },
          { label: '마지막 실행', value: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {demoOps.lastRun.when}
              <ResultBadge result={demoOps.lastRun.result} />
            </span>
          ) },
        ].map((item, i, arr) => (
          <div key={item.label} style={{
            paddingRight: 28,
            marginRight: 28,
            marginBottom: 4,
            borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'inherit' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── 섹션: 2열 그리드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 28, alignItems: 'start' }}>

        {/* ── 왼쪽: 스킬 옵션 ── */}
        <VStack gap={2}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <VStack gap={0}>
                <Heading level={4}>스킬 옵션</Heading>
                <Text type="supporting" color="secondary">사용할 스킬을 켜고 끕니다.</Text>
              </VStack>
              <button
                onClick={() => setShowSkillEdit(true)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                  background: 'var(--color-background-surface)', fontSize: 13, fontWeight: 500,
                  color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                편집
              </button>
            </div>
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', background: 'transparent' }}>
              {agent.capabilities.map((cap, ci) => {
                const jobCat = JOB_CATEGORY[agent.job ?? ''] ?? ''
                const roleOpts = jobCat ? ROLE_CAP_SUBOPTIONS[jobCat]?.[cap.key] : undefined
                const subOpts: SubOption[] = roleOpts ?? CAP_SUBOPTIONS[cap.key] ?? []
                const isExpanded = cap.on && !collapsedCapKeys.has(cap.key)
                const subVals = capSubOptions[cap.key] ?? {}
                return (
                  <div key={cap.key} style={{ borderTop: ci > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    {/* 메인 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px' }}>
                      {/* 펼치기 버튼 */}
                      <button
                        onClick={() => {
                          if (cap.on && (subOpts.length > 0 || cap.key === 'file')) {
                            setCollapsedCapKeys(prev => {
                              const next = new Set(prev)
                              next.has(cap.key) ? next.delete(cap.key) : next.add(cap.key)
                              return next
                            })
                          }
                        }}
                        style={{
                          flexShrink: 0, width: 20, height: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', padding: 0, borderRadius: 'var(--radius-full)',
                          cursor: (cap.on && (subOpts.length > 0 || cap.key === 'file')) ? 'pointer' : 'default',
                          color: (cap.on && (subOpts.length > 0 || cap.key === 'file')) ? 'var(--color-icon-secondary)' : 'transparent',
                        }}
                        tabIndex={(cap.on && (subOpts.length > 0 || cap.key === 'file')) ? 0 : -1}
                        aria-label={isExpanded ? '세부 옵션 닫기' : '세부 옵션 열기'}
                      >
                        {cap.on && (subOpts.length > 0 || cap.key === 'file') && (
                          isExpanded ? <AstryxIcon icon={ChevronDown} size="sm" /> : <AstryxIcon icon={ChevronRight} size="sm" />
                        )}
                      </button>
                      {/* 레이블 + 설명 (직접 렌더링 → 색상 제어) */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 14, fontFamily: 'inherit',
                            fontWeight: cap.on ? 600 : 400,
                            color: cap.on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          }}>
                            {cap.label}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>
                            {cap.detail}
                          </div>
                        </div>
                        <div style={{ opacity: cap.on ? 1 : 0.45, flexShrink: 0 }}>
                          <Switch
                            label=""
                            value={cap.on}
                            onChange={v => {
                              handleCapToggle(cap.key, v)
                              // 스킬을 켜면 세부 옵션을 다시 펼쳐 보여준다
                              if (v) setCollapsedCapKeys(prev => { const next = new Set(prev); next.delete(cap.key); return next })
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 세부 옵션 패널 */}
                    {isExpanded && subOpts.length > 0 && (
                      <div style={{
                        margin: '0 16px 12px 36px',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-inner)',
                        background: 'var(--color-background-muted)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', flexDirection: 'column', gap: 9,
                      }}>
                        {subOpts.map(opt => {
                          const checked = subVals[opt.key] ?? opt.defaultOn
                          return (
                            <label key={opt.key} style={{
                              display: 'flex', alignItems: 'center', gap: 9,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => setCapSubOptions(prev => ({
                                  ...prev,
                                  [cap.key]: { ...(prev[cap.key] ?? {}), [opt.key]: e.target.checked },
                                }))}
                                style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-accent)' }}
                              />
                              <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                                {opt.label}
                              </span>
                              {opt.description && (
                                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                                  {opt.description}
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* 파일 접근 경로 — file 스킬 확장 시 */}
                    {cap.key === 'file' && cap.on && isExpanded && (
                      <div style={{ margin: '8px 16px 12px 36px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* 등록된 경로 목록 */}
                        {agent.file_paths.map(path => (
                          <div key={path} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 11px', borderRadius: 'var(--radius-inner)',
                            background: 'var(--color-background-muted)',
                            border: '1px solid var(--color-border-emphasized)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ color: '#b45309', display: 'flex', flexShrink: 0 }}><AstryxIcon icon={Folder} size="sm" color="inherit" /></span>
                              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{path}</span>
                            </div>
                            <button
                              onClick={() => handleRemovePath(path)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--color-icon-secondary)' }}
                            >
                              <AstryxIcon icon={X} size="sm" />
                            </button>
                          </div>
                        ))}

                        {/* 경로 선택 버튼 + 숨김 파일 입력 */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          style={{ display: 'none' }}
                          onChange={handleFileSelect}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 'var(--radius-full)', alignSelf: 'flex-start',
                            border: '1px solid var(--color-border-emphasized)',
                            background: 'var(--color-background-surface)',
                            fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <AstryxIcon icon={Folder} size="sm" color="secondary" />
                          경로 선택
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        </VStack>

        {/* ── 오른쪽: MCP · LLM · 채널 · 로그 ── */}
        <VStack gap={5}>

          {/* MCP 연결 */}
          <VStack gap={2}>
            <HStack hAlign="between" vAlign="center">
              <VStack gap={0}>
                <Heading level={4}>MCP 연결</Heading>
                <Text type="supporting" color="secondary">외부 시스템을 연결합니다.</Text>
              </VStack>
              <button
                onClick={() => setShowMcpEdit(true)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                  background: 'var(--color-background-surface)', fontSize: 13, fontWeight: 500,
                  color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                편집
              </button>
            </HStack>
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', background: 'transparent' }}>
              {agent.mcp.map((m, mi) => {
                // 이메일은 계정 단위 커넥터 상태(emailConnected)를 그대로 반영
                const isConnected = m.key === 'email' ? emailConnected : m.connected
                return (
                <div
                  key={m.key}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderTop: mi > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                    <McpLogoIcon mcpKey={m.key} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontFamily: 'inherit',
                        fontWeight: isConnected ? 600 : 400,
                        color: isConnected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: 'inherit', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isConnected && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-status-active)', display: 'inline-block', flexShrink: 0 }} />
                        )}
                        <span style={{
                          color: isConnected ? 'var(--color-status-active)' : 'var(--color-text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.key === 'email'
                            ? (isConnected ? `연결됨${emailAddress ? ' · ' + emailAddress : ''}` : '이메일 계정 연결로 발송(Gmail·Outlook·네이버 등)')
                            : (MCP_DESCRIPTIONS[m.key] ? MCP_DESCRIPTIONS[m.key].split('.')[0] : (isConnected ? '연결됨' : '연결 안 됨'))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 우측: 스위치 */}
                  <div
                    style={{ paddingRight: 16, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ opacity: isConnected || showMcpQr === m.key ? 1 : 0.55 }}>
                      <Switch
                        label=""
                        value={isConnected || showMcpQr === m.key}
                        onChange={v => handleMcpToggle(m.key, v)}
                      />
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </VStack>

          {/* LLM 연결 */}
          <VStack gap={2}>
            <VStack gap={0}>
              <Heading level={4}>LLM 연결</Heading>
              <Text type="supporting" color="secondary">이 에이전트에서 사용할 언어 모델을 선택합니다. 외부 모델은 개인 QR 연동이 필요합니다.</Text>
            </VStack>
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', background: 'transparent' }}>
              {LLM_MODELS.map((m, mi) => {
                const isSelected = selectedLlmKey === m.key
                return (
                  <div
                    key={m.key}
                    onClick={() => handleLlmChange(m.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', cursor: 'pointer',
                      borderTop: mi > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      background: isSelected ? 'var(--color-background-muted)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* 라디오 */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
                      background: isSelected ? 'var(--color-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>{m.desc}</div>
                    </div>
                    {/* 외부 모델 연동 상태 */}
                    {m.external && isSelected && (
                      llmConnected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-status-active)' }} />
                          <span style={{ fontSize: 12, color: 'var(--color-status-active)', fontFamily: 'inherit', fontWeight: 500 }}>연동됨</span>
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setShowLlmQr(true) }}
                          style={{
                            padding: '5px 12px', borderRadius: 'var(--radius-full)', flexShrink: 0,
                            border: '1px solid var(--color-border-emphasized)',
                            background: 'var(--color-background-surface)',
                            fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          QR 연동
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </VStack>

          {/* 채널 배치 */}
          <VStack gap={2}>
            <VStack gap={0}>
              <Heading level={4}>업무 채널 배치</Heading>
              <Text type="supporting" color="secondary">메신저 채널에 이 직원을 배치합니다.</Text>
            </VStack>
            {undoInfo && (
              <Banner
                status="info"
                title={undoInfo.archived
                  ? `${undoInfo.channel} 배치를 해제하고 채널을 보관했어요`
                  : `${undoInfo.channel || '채널'} 배치를 해제했어요`}
                description={undoInfo.archived
                  ? 'Slack 채널 목록에서 사라졌고 대화 기록은 보존돼요. 되돌리면 채널을 되살리고 다시 배치합니다.'
                  : undoInfo.reason === 'channel_in_use'
                    ? '다른 에이전트·팀이 쓰는 채널이라 보관하지 않았어요. 채널과 대화 기록은 Slack에 그대로 있어요.'
                    : undoInfo.reason
                      ? `채널은 보관하지 못했어요. ${noticeReason(undoInfo.reason)}`
                      : '채널과 대화 기록은 Slack에 그대로 남아 있어요.'}
                endContent={undoInfo.channel ? <Button label="되돌리기" variant="secondary" size="sm" onClick={handleUndo} /> : undefined}
              />
            )}
            {deployNotice && (
              <Banner
                status={deployNotice.sent ? 'success' : 'warning'}
                title={deployNotice.sent
                  ? `${deployNotice.channel}에 배치 안내를 보냈어요`
                  : '배치는 저장됐지만 메신저에 안내를 보내지 못했어요'}
                description={deployNotice.sent
                  ? '메신저에서 안내 메시지를 확인하고, 이 채널에서 바로 업무를 요청해 보세요.'
                  : noticeReason(deployNotice.reason)}
                endContent={deployNotice.sent
                  ? <Button label="메신저 열기" variant="primary" size="sm" onClick={() => window.open('https://app.slack.com/client', '_blank', 'noopener')} />
                  : undefined}
              />
            )}
            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', padding: 16, background: 'transparent' }}>
              <VStack gap={3}>
                {/* 플랫폼 선택 — 브랜드 컬러 버튼 */}
                <VStack gap={1}>
                  <Text type="label">플랫폼</Text>
                  <HStack gap={2} style={{ flexWrap: 'wrap' }}>
                    {Object.entries(PLATFORM_CONFIG).map(([key, p]) => {
                      const isSelected = deployPlatform === key
                      return (
                        <button
                          key={key}
                          onClick={() => {
                          setDeployPlatform(key)
                          if (!channelManuallyEdited) {
                            setDeployChannel(getDefaultChannel(agent.job, agent.name, key))
                          }
                        }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 'var(--radius-full)',
                            background: isSelected ? 'var(--color-accent)' : 'transparent',
                            border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
                            color: isSelected ? 'var(--color-on-accent)' : 'var(--color-text-primary)',
                            fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            fontFamily: 'inherit', transition: 'all 0.15s',
                          }}
                        >
                          <PlatformLogo platform={key} size={15} />
                          {p.name}
                        </button>
                      )
                    })}
                  </HStack>
                </VStack>

                {/* 워크스페이스 연결 → 채널 생성/선택 → 배치 */}
                {deployPlatform && (() => {
                  const p = PLATFORM_CONFIG[deployPlatform]
                  const wsReady = wsConnected || deployed
                  const slug = slugifyChannel(deployChannel)
                  if (!wsReady) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, border: '1px dashed var(--color-border-emphasized)', background: 'var(--color-background-muted)' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PlatformLogo platform={deployPlatform} size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{p.name} 워크스페이스 연결 필요</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>연결하면 채널을 만들고 이 에이전트를 배치할 수 있어요.</div>
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
                        {!deployed && (
                          <button onClick={() => setWsConnected(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>연결 해제</button>
                        )}
                      </div>

                      {/* 채널 지정: 새로 만들기 / 기존 선택 */}
                      <VStack gap={1}>
                        <Text type="label">채널</Text>
                        <HStack gap={2}>
                          {([['create', '새 채널 만들기'], ['existing', '기존 채널 선택']] as const).map(([m, lbl]) => {
                            const on = channelMode === m
                            return (
                              <button key={m}
                                onClick={() => {
                                  setChannelMode(m)
                                  if (m === 'create') {
                                    // 새 채널은 늘 현재 에이전트 이름으로 시작(직접 고치면 그 값 유지)
                                    setDeployChannel(getDefaultChannel(agent.job, agent.name, deployPlatform || 'slack'))
                                    setChannelManuallyEdited(false)
                                  } else {
                                    const cur = agent.deployment.platform === deployPlatform ? agent.deployment.channel : ''
                                    setDeployChannel(cur || '')
                                    setChannelManuallyEdited(true)
                                  }
                                }}
                                style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: on ? 'var(--color-background-muted)' : 'transparent', border: `1.5px solid ${on ? 'var(--color-text-primary)' : 'var(--color-border-emphasized)'}`, color: 'var(--color-text-primary)' }}>{lbl}</button>
                            )
                          })}
                        </HStack>
                      </VStack>

                      {channelMode === 'create' ? (
                        <VStack gap={2}>
                          <TextInput label="채널 이름" value={deployChannel} onChange={(v) => { setDeployChannel(v); setChannelManuallyEdited(true) }} placeholder="예: 재무팀 부가세" width="100%" />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flexWrap: 'wrap' }}>
                            <PlatformLogo platform={deployPlatform} size={13} />
                            <span>{p.name}에 생성될 채널</span>
                            <code style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', background: 'var(--color-background-muted)', padding: '2px 7px', borderRadius: 6 }}>#{slug || '채널명'}</code>
                          </div>
                          {slug && deployPlatform === 'slack' && slackChannels.items.some(c => c.name === slug) && (
                            <div style={{ fontSize: 12, color: 'var(--color-error)', fontFamily: 'inherit' }}>이미 있는 채널명이에요 — ‘기존 채널 선택’을 쓰거나 다른 이름으로.</div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: 'inherit' }}>채널 설명(topic) 자동: “Byr · {agent.name} 운영” · 접두사 없음</div>
                          <HStack gap={2}>
                            {([['public', '공개'], ['private', '비공개']] as const).map(([v, lbl]) => {
                              const on = (channelPrivate ? 'private' : 'public') === v
                              return <button key={v} onClick={() => setChannelPrivate(v === 'private')} style={{ padding: '5px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, background: on ? 'var(--color-background-muted)' : 'transparent', border: `1px solid ${on ? 'var(--color-text-primary)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}>{lbl}</button>
                            })}
                          </HStack>
                        </VStack>
                      ) : (
                        deployPlatform !== 'slack' ? (
                          <VStack gap={1}>
                            <TextInput label="채널 이름" value={deployChannel} onChange={(v) => { setDeployChannel(v); setChannelManuallyEdited(true) }} placeholder="예: #재무팀" width="100%" />
                            <Text type="supporting" color="secondary">이 플랫폼은 아직 채널 목록 연동 전이라 이름을 직접 입력합니다.</Text>
                          </VStack>
                        ) : slackChannels.status === 'loading' || slackChannels.status === 'idle' ? (
                          <Text type="supporting" color="secondary">Slack 채널 목록을 불러오는 중…</Text>
                        ) : slackChannels.status === 'error' ? (
                          <Banner
                            status="warning"
                            title="Slack 채널 목록을 불러오지 못했어요"
                            description={noticeReason(slackChannels.error ?? null)}
                            endContent={<Button label="다시 불러오기" variant="secondary" size="sm" onClick={loadSlackChannels} />}
                          />
                        ) : slackChannels.items.length === 0 ? (
                          <Text type="supporting" color="secondary">워크스페이스에 고를 수 있는 채널이 없어요. ‘새 채널 만들기’로 만들어 배치하세요.</Text>
                        ) : (
                          <VStack gap={1}>
                            <FilterDropdown
                              label="채널"
                              options={slackChannels.items.map(c => `#${c.name}`)}
                              value={deployChannel || '채널 선택'}
                              onChange={(v) => { setDeployChannel(v); setChannelManuallyEdited(true) }}
                            />
                            <Text type="supporting" color="secondary">
                              Slack 워크스페이스의 실제 채널 {slackChannels.items.length}개 · 비공개 채널은 봇이 들어가 있는 곳만 보입니다.
                            </Text>
                          </VStack>
                        )
                      )}

                      <HStack gap={2}>
                        <Button
                          label={channelMode === 'create' ? '채널 만들고 배치' : '채널에 배치'}
                          variant="primary"
                          isDisabled={channelMode === 'existing' && !deployChannel.trim()}
                          onClick={handleDeploy}
                        />
                        {deployed && <Button label="배치 해제" variant="secondary" onClick={() => { setArchiveOnUndeploy(false); setUndeployOpen(true) }} />}
                      </HStack>

                      {/* 배치 상태 — 봇 초대 완료 */}
                      {deployed && agent.deployment.platform && PLATFORM_CONFIG[agent.deployment.platform] && (() => {
                        const dp = PLATFORM_CONFIG[agent.deployment.platform!]
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-background-surface)', border: '1px solid var(--color-border-emphasized)' }}>
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-status-active)', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{agent.deployment.channel}에 배치됨</div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>{dp.name} · 봇 초대 완료 · 멘션/DM으로 호출</div>
                            </div>
                          </div>
                        )
                      })()}
                    </VStack>
                  )
                })()}
              </VStack>
            </div>
          </VStack>

          {/* 활동 이력 — 실제 감사 기록. 대화 로그(MOCK)를 대체한다.
              경계 원칙: 콘솔=기록 열람 / 실행·재실행은 메신저. */}
          <VStack gap={2}>
            <VStack gap={0}>
              <Heading level={4}>활동 이력</Heading>
              <Text type="supporting" color="secondary">이 에이전트가 실제로 한 일 · 실행과 대화는 메신저에서</Text>
            </VStack>

            <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden', background: 'transparent' }}>

              {/* 로딩 */}
              {activity === null && (
                <div style={{ padding: 16 }}><Text type="body" color="secondary">불러오는 중…</Text></div>
              )}

              {/* 아직 활동 없음 — 대화 안 한 새 에이전트 */}
              {activity !== null && activity.length === 0 && (
                <div style={{ padding: 16 }}>
                  <EmptyState
                    title="아직 활동이 없어요"
                    description={deployed
                      ? '배치된 채널에서 대화를 시작하면 여기에 기록됩니다.'
                      : '채널에 배치하고 메신저에서 대화를 시작하면 기록이 쌓입니다.'}
                    isCompact
                  />
                </div>
              )}

              {/* 활동 이력 — 감사 기록 1행 1이벤트 */}
              {activity !== null && activity.map((it, i) => {
                const label = ACTION_LABEL[it.action] || it.action
                const external = ACTION_TONE[it.action] === 'external'
                const when = it.ts.replace('T', ' ').slice(0, 16)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px',
                      borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    {/* 점 — 외부로 나가는 것만 강조 */}
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: external ? 'var(--color-warning)' : 'var(--color-border-emphasized)' }} />
                    {/* 라벨 */}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', flexShrink: 0, minWidth: 84 }}>
                      {label}
                    </span>
                    {/* 상세 — 감사 detail 그대로(가공 안 함, 정직하게) */}
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.detail}>
                      {it.detail}
                    </span>
                    {/* 시각 */}
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit', flexShrink: 0 }}>
                      {when}
                    </span>
                  </div>
                )
              })}
            </div>
          </VStack>

        </VStack>
      </div>
    </VStack>

    {/* 삭제 확인 다이얼로그 */}
    {undeployOpen && agent && createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div role="dialog" aria-label="배치 해제" style={{ background: 'var(--color-background-surface)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: 440, maxWidth: '100%', padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <VStack gap={1}>
            <Heading level={4}>배치 해제</Heading>
            <Text type="supporting" color="secondary">
              {agent.name}을(를) {agent.deployment.channel}에서 해제합니다. 해제한 뒤에도 바로 되돌릴 수 있어요.
            </Text>
          </VStack>
          <VStack gap={2}>
            {([[false, '배치만 해제', '채널과 대화 기록은 Slack에 그대로 남습니다.'], [true, '배치 해제 + 채널 보관', 'Slack 채널 목록에서 사라지고 대화 기록은 보존됩니다. 언제든 되살릴 수 있어요.']] as const)
              .filter(([arch]) => !arch || agent.deployment.platform === 'slack')
              .map(([arch, title, desc]) => {
                const on = archiveOnUndeploy === arch
                return (
                  <button key={String(arch)} onClick={() => setArchiveOnUndeploy(arch)}
                    style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'var(--color-background-muted)' : 'transparent', border: `1.5px solid ${on ? 'var(--color-text-primary)' : 'var(--color-border-emphasized)'}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                  </button>
                )
              })}
            {agent.deployment.platform === 'slack' && (
              <Text type="supporting" color="secondary">Slack은 봇이 채널을 완전히 삭제할 수 없어 ‘보관’으로 처리합니다.</Text>
            )}
          </VStack>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button label="취소" variant="secondary" size="lg" onClick={() => setUndeployOpen(false)} />
            <Button label={archiveOnUndeploy ? '해제하고 채널 보관' : '배치 해제'} variant="primary" size="lg" onClick={handleUndeploy} />
          </div>
        </div>
      </div>,
      document.body
    )}

    {showDeleteConfirm && createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--color-background-surface)',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          width: 400, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* 아이콘 + 제목 */}
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
                에이전트 삭제
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>{agent?.name}</strong>을(를) 삭제하면 되돌릴 수 없습니다. 실행 기록과 설정이 모두 삭제됩니다.
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: '10px 22px', borderRadius: 'var(--radius-full)',
                border: '1.5px solid var(--color-border-emphasized)',
                background: 'var(--color-background-surface)',
                fontSize: 14, fontWeight: 500,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >취소</button>
            <button
              onClick={handleDeleteConfirm}
              style={{
                padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none',
                background: 'var(--color-icon-red)',
                fontSize: 14, fontWeight: 600,
                color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >삭제</button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* LLM QR 연동 모달 */}
    {showLlmQr && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setShowLlmQr(false)}
      >
        <div
          style={{ background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', padding: '28px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 280 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 4 }}>
              {LLM_MODELS.find(m => m.key === selectedLlmKey)?.label} 연동
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>QR 코드로 개인 API 키를 안전하게 연동합니다</div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)' }}>
            <QrCode size={140} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.6 }}>
            카메라 앱으로 QR을 스캔하면<br />API 키 연동 페이지가 열립니다
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setLlmConnected(true); setShowLlmQr(false) }}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--color-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-on-accent)' }}
            >
              연동 완료
            </button>
            <button
              onClick={() => setShowLlmQr(false)}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* 이메일 연결 모달 */}
    {showGmailConnect && (
      <EmailConnectModal
        onClose={() => setShowGmailConnect(false)}
        onConnected={(addr) => { setEmailConnected(true); setEmailAddress(addr); setShowGmailConnect(false) }}
      />
    )}

    {/* MCP QR 연동 모달 */}
    {showMcpQr && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setShowMcpQr(null)}
      >
        <div
          style={{ background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)', padding: '28px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 280 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 4 }}>
              {agent.mcp.find(m => m.key === showMcpQr)?.name} 연결
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>QR 코드로 외부 서비스 계정을 안전하게 연결합니다</div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)' }}>
            <QrCode size={140} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.6 }}>
            카메라 앱으로 QR을 스캔하면<br />서비스 연결 페이지가 열립니다
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => { await handleMcpSave(showMcpQr, true); setShowMcpQr(null) }}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--color-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-on-accent)' }}
            >
              연동 완료
            </button>
            <button
              onClick={() => setShowMcpQr(null)}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* 스킬 편집 모달 */}
    {showSkillEdit && (
      <SkillEditModal
        currentKeys={new Set(agent.capabilities.filter(c => c.on).map(c => c.key))}
        agentJob={agent.job ?? undefined}
        initialSubOptions={capSubOptions}
        onSave={handleSkillSave}
        onClose={() => setShowSkillEdit(false)}
      />
    )}

    {/* MCP 편집 모달 */}
    {showMcpEdit && (
      <McpEditModal
        currentMcp={agent.mcp}
        onSave={handleMcpEditSave}
        onClose={() => setShowMcpEdit(false)}
      />
    )}

    {/* 스케줄 만들기 위저드 */}
    <RoutineWizard
      isOpen={isRoutineOpen}
      onClose={() => setIsRoutineOpen(false)}
      onSave={(r: RoutineDef) => {
        try {
          const raw = localStorage.getItem('byr_routines')
          const existing: RoutineDef[] = raw ? JSON.parse(raw) : []
          localStorage.setItem('byr_routines', JSON.stringify([r, ...existing]))
        } catch {}
        setIsRoutineOpen(false)
        setRoutineSaved(true)
        setTimeout(() => setRoutineSaved(false), 3000)
      }}
      agents={agent ? [{ id: agent.id, name: agent.name, icon: agent.icon, role: agent.role, job: agent.job }] : []}
      initialAgentId={agent?.id}
      initialValues={scheduleInitialValues}
    />

    {/* 스케줄 저장 완료 토스트 */}
    {routineSaved && (
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 2000, background: '#1a1a1a', color: '#fff',
        padding: '12px 24px', borderRadius: 'var(--radius-full)',
        fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AstryxIcon icon={CalendarClock} size="xsm" color="inherit" />
        스케줄이 저장됐어요. 내 에이전트 → 스케줄 탭에서 확인할 수 있어요.
      </div>
    )}

</>
  )
}
