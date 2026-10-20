import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Switch } from '@astryxdesign/core/Switch'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'
import { SearchBar } from './SearchBar'
import { FilterDropdown } from './FilterDropdown'
import { ModalCloseButton, StepChip as SharedStepChip, ModalFooter, MODAL_BUTTON_STYLE } from './ModalComponents'
import { SKILL_CATALOG, SKILL_CATEGORIES, SKILL_RECOMMENDED, SKILL_EMOJI, TEMPLATE_SKILLS, TEMPLATE_CATEGORY } from '../utils/skillCatalog'
import type { SkillDef } from '../utils/skillCatalog'
import { PlatformLogo } from '../utils/platformLogos'
import { Bot, Receipt, FileCheck, BarChart2, AlertTriangle, Users, ClipboardList, Terminal, Layers, Hash, Send, MessageSquare, Check, Briefcase } from 'lucide-react'
import { AgentIconBadge } from '../utils/agentIcon'

interface Template { key: string; icon: string; name: string; purpose: string; category: string; job: string | null }
interface Meta { templates: unknown[]; platforms: unknown[]; mcp_catalog: unknown[] }

interface HireModalProps {
  isOpen: boolean
  onClose: () => void
  onHire: (agent: unknown) => void
  meta: Meta
  initialTemplate?: string
}

const TONES = ['정중', '간결·팩트', '친근']

const CHANNEL_PLATFORMS: { key: string; label: string; icon: IconType; placeholder: string; hint: string }[] = [
  { key: 'slack',    label: 'Slack',    icon: Hash,           placeholder: '#채널명 (예: #재무팀-봇)',       hint: '워크스페이스에 봇을 초대한 채널을 입력하세요' },
  { key: 'dooray',   label: 'Dooray',   icon: MessageSquare,  placeholder: '#채널명 (예: #재무팀-봇)',       hint: 'Dooray 채널에 봇을 초대한 뒤 채널명을 입력하세요' },
  { key: 'discord',  label: 'Discord',  icon: MessageSquare,  placeholder: '#채널명 (예: #finance-bot)',    hint: '서버 채널에 봇을 초대한 뒤 채널명을 입력하세요' },
  { key: 'telegram', label: 'Telegram', icon: Send,           placeholder: '채널명 또는 그룹명',            hint: 'Telegram 채널 또는 그룹에 봇을 추가하세요' },
]

const JOB_CHANNEL_DEFAULTS: Record<string, Record<string, string>> = {
  vat_reconcile:       { slack: '#재무팀-봇',   dooray: '#재무팀-봇',   discord: '#재무팀-봇',   telegram: '재무팀봇'  },
  insurance_fp:        { slack: '#보험-fp-봇',  dooray: '#보험-fp-봇',  discord: '#보험-fp-봇',  telegram: '보험FP봇'  },
  securities_research: { slack: '#리서치-봇',   dooray: '#리서치-봇',   discord: '#리서치-봇',   telegram: '리서치봇'  },
  compliance_aml:      { slack: '#준법감사-봇', dooray: '#준법감사-봇', discord: '#준법감사-봇', telegram: '준법감사봇' },
  hr:                  { slack: '#인사팀-봇',   dooray: '#인사팀-봇',   discord: '#인사팀-봇',   telegram: '인사팀봇'  },
  pm_brief:            { slack: '#기획팀-봇',   dooray: '#기획팀-봇',   discord: '#기획팀-봇',   telegram: '기획팀봇'  },
  dev_incident:        { slack: '#개발운영-봇', dooray: '#개발운영-봇', discord: '#개발운영-봇', telegram: '개발운영봇' },
}

function getDefaultChannel(job: string | null | undefined, name: string, platform: string): string {
  // 채널명은 에이전트 이름 기반(접두사 없음). 이름이 비었을 때만 직무 기본으로 폴백.
  const slug = name.trim().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').toLowerCase()
  if (slug) return platform === 'telegram' ? slug : `#${slug}`
  const d = JOB_CHANNEL_DEFAULTS[job ?? '']
  if (d) return d[platform] ?? d.slack
  return platform === 'telegram' ? '봇' : '#봇'
}

// ── 직무 카드 정의 ────────────────────────────────────────────
const JOB_ROLES: { key: string; label: string; desc: string; icon: IconType }[] = [
  { key: 'vat_reconcile',       label: '재무·회계',    desc: '부가세 대사·월마감·전표 처리',         icon: Receipt       },
  { key: 'insurance_fp',        label: '보험 FP',      desc: '제안서 자동화·보장 갭 분석·약관 Q&A', icon: FileCheck     },
  { key: 'securities_research', label: '증권 리서치',  desc: '투자리포트 초안·DART 공시 분석',      icon: BarChart2     },
  { key: 'compliance_aml',      label: '준법·내부감사', desc: 'STR 초안·이상거래 조사',             icon: AlertTriangle },
  { key: 'hr',                  label: '인사·총무',    desc: '근태 요약·채용 공고·급여 명세',       icon: Users         },
  { key: 'pm_brief',            label: '기획/PM',      desc: '회의록 정리·기획서·경쟁사 리서치',    icon: ClipboardList },
  { key: 'dev_incident',        label: '개발·운영',    desc: '로그 분석·배포 현황·PR 리뷰 요약',   icon: Terminal      },
  { key: 'sales',               label: '영업',         desc: '제안서 초안·팔로업·현황 리포트',      icon: Briefcase     },
  { key: 'blank',               label: '직접 구성',    desc: '스킬·설정을 직접 선택합니다',          icon: Layers        },
]

const JOB_ICONS: Record<string, string> = {
  vat_reconcile:       '🧾',
  insurance_fp:        '📄',
  securities_research: '📊',
  compliance_aml:      '⚠️',
  hr:                  '👥',
  pm_brief:            '📋',
  dev_incident:        '🔔',
  sales:               '💼',
  blank:               '✨',
}

const JOB_DEFAULT_SKILLS: Record<string, string[]> = {
  vat_reconcile:       TEMPLATE_SKILLS['vat']      ?? ['file', 'analysis', 'report'],
  insurance_fp:        ['file', 'analysis', 'report', 'web'],
  securities_research: ['file', 'analysis', 'report', 'web'],
  compliance_aml:      ['file', 'analysis', 'report'],
  hr:                  TEMPLATE_SKILLS['hr']        ?? ['file', 'analysis', 'report'],
  pm_brief:            TEMPLATE_SKILLS['pm_brief']  ?? ['file', 'analysis', 'report', 'web'],
  dev_incident:        ['file', 'analysis', 'report'],
  sales:               TEMPLATE_SKILLS['sales_proposal'] ?? ['proposal', 'doc_summary', 'file', 'report'],
  blank:               ['file', 'analysis', 'report'],
}

const TEMPLATE_JOB: Record<string, string> = {
  vat: 'vat_reconcile', close: 'vat_reconcile', expense: 'vat_reconcile', budget: 'vat_reconcile',
  hr: 'hr', hr_hire: 'hr',
  pm_brief: 'pm_brief', pm_spec: 'pm_brief', pm_meeting: 'pm_brief', pm_research: 'pm_brief',
  dev_incident: 'dev_incident', dev_pr: 'dev_incident', dev_doc: 'dev_incident',
  ops_monitor: 'dev_incident', ops_deploy: 'dev_incident',
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function HireModal({ isOpen, onClose, onHire, meta, initialTemplate }: HireModalProps) {
  const isTemplate = !!initialTemplate && initialTemplate !== 'blank'

  const [step, setStep] = useState(1)
  const [selectedJob, setSelectedJob] = useState('')
  const [name, setName] = useState('')
  const [tone, setTone] = useState<string>('정중')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(['file', 'analysis', 'report']))
  const [skillSearch, setSkillSearch] = useState('')
  const [skillCategory, setSkillCategory] = useState('전체')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const isBlankJob = !isTemplate && selectedJob === 'blank'
  const totalSteps = isTemplate ? 1 : isBlankJob ? 3 : 2

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedJob('')
      setTone('정중')
      setSkillSearch('')
      setSelectedTemplate('')
      if (isTemplate && initialTemplate) {
        const tpl = (meta.templates as Array<{ key: string; name: string }>).find(t => t.key === initialTemplate)
        setName(tpl?.name ?? '')
        setSelectedSkills(new Set(TEMPLATE_SKILLS[initialTemplate] ?? ['file', 'analysis', 'report']))
        setSkillCategory(TEMPLATE_CATEGORY[initialTemplate] ?? '전체')
      } else {
        setName('')
        setSelectedSkills(new Set(['file', 'analysis', 'report']))
        setSkillCategory('전체')
      }
    }
  }, [isOpen, initialTemplate])

  const displayedSkills = useMemo((): SkillDef[] => {
    const q = skillSearch.trim().toLowerCase()
    if (q) {
      return SKILL_CATALOG.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.detail.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      )
    }
    const keys = SKILL_RECOMMENDED[skillCategory] ?? SKILL_RECOMMENDED['전체']
    return keys.map(k => SKILL_CATALOG.find(s => s.key === k)).filter((s): s is SkillDef => Boolean(s))
  }, [skillSearch, skillCategory])

  // job mode 스텝2에 표시할 업무-에이전트(마켓플레이스 템플릿): 직무 특화 먼저, 공통 업무 뒤
  const jobTemplates = useMemo((): Template[] => {
    const tpls = meta.templates as Template[]
    return tpls
      .filter(t => t.key !== 'blank' && (t.job === selectedJob || t.category === '공통 업무'))
      .sort((a, b) => (a.category === '공통 업무' ? 1 : 0) - (b.category === '공통 업무' ? 1 : 0))
  }, [meta.templates, selectedJob])

  const handleHire = async () => {
    setLoading(true)
    try {
      // job mode: 선택한 업무-에이전트 템플릿 하나를 생성(단일)
      if (!isTemplate && !isBlankJob) {
        const t = jobTemplates.find(x => x.key === selectedTemplate)
        if (!t) { setSelectedTemplate(''); return }  // 방어: 선택이 현재 직무 목록에 없으면 초기화(finally가 loading 해제)
        // 이 업무-에이전트에 핏한 스킬로 생성(TEMPLATE_SKILLS)
        const skillKeys = TEMPLATE_SKILLS[t.key] ?? ['file', 'analysis', 'report']
        const caps = SKILL_CATALOG
          .filter(s => skillKeys.includes(s.key))
          .map(s => ({ key: s.key, icon: SKILL_EMOJI[s.key] ?? '⚡', label: s.label, on: true, detail: s.detail }))
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: t.key, name: t.name, job: selectedJob, tone: [tone], capabilities: caps }),
        })
        onHire(await res.json())
        return
      }

      const effectiveJob = isTemplate
        ? (TEMPLATE_JOB[initialTemplate ?? ''] ?? 'blank')
        : (selectedJob || 'blank')
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: initialTemplate ?? 'blank',
          icon: !isTemplate ? (JOB_ICONS[selectedJob] ?? '✨') : undefined,
          job: effectiveJob,
          name,
          tone: [tone],
          capabilities: SKILL_CATALOG
            .filter(s => selectedSkills.has(s.key))
            .map(s => ({ key: s.key, icon: SKILL_EMOJI[s.key] ?? '⚡', label: s.label, on: true, detail: s.detail })),
        }),
      })
      const agent = await res.json()
      onHire(agent)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const STEP_LABELS = isTemplate
    ? ['기본 확인']
    : isBlankJob
    ? ['직무 선택', '스킬 선택', '기본 정보']
    : ['직무 선택', '에이전트 선택']

  const STEP_HINTS: Record<number, string> = isTemplate
    ? {
        1: '이름을 확인하고 필요한 스킬을 조정하세요.',
      }
    : isBlankJob
    ? {
        1: '이 에이전트가 담당할 직무를 선택하세요. 직접 구성은 다음 단계에서 스킬을 직접 고를 수 있습니다.',
        2: '이 에이전트에게 부여할 스킬을 직접 선택하세요.',
        3: '에이전트 이름과 커뮤니케이션 스타일을 설정하세요.',
      }
    : {
        1: '이 에이전트가 담당할 직무를 선택하세요. 직무에 맞는 스킬이 자동으로 구성됩니다.',
        2: '이 직무의 에이전트 중 하나를 선택하세요.',
      }

  const showJobSection     = !isTemplate && step === 1
  const showSkillSection   = (isTemplate && step === 1) || (isBlankJob && step === 2)
  const showNameSection    = isTemplate ? step === 1 : isBlankJob ? step === 3 : false
  const showAgentSelect    = !isTemplate && !isBlankJob && !!selectedJob && selectedJob !== 'blank' && step === 2

  const canProceed = isTemplate || step !== 1 || !!selectedJob

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true"
        style={{
          background: 'var(--color-background-surface)', borderRadius: 20,
          width: 580, maxWidth: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', position: 'relative',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* ── 고정 헤더 ── */}
        <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-background-muted)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AstryxIcon icon={Bot} size="sm" color="secondary" strokeWidth={1.8} />
            </div>
          </div>
          <Heading level={2} style={{ marginBottom: 18 }}>에이전트 만들기</Heading>
          <HStack gap={2} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
            {STEP_LABELS.map((label, i) => (
              <SharedStepChip key={label} label={label} stepNum={i + 1} currentStep={step} />
            ))}
          </HStack>
          <div style={{ marginBottom: 16 }}>
            <Text type="body" color="secondary">{STEP_HINTS[step]}</Text>
          </div>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>

          {/* ── 직무 선택 ── */}
          {showJobSection && (
            <div style={{ paddingBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {JOB_ROLES.map(role => {
                  const selected = selectedJob === role.key
                  return (
                    <button
                      key={role.key}
                      onClick={() => {
                        setSelectedJob(role.key)
                        setSelectedTemplate('')  // 직무를 바꾸면 이전 직무의 템플릿 선택을 비운다(조용한 생성 실패 방지)
                        setSelectedSkills(new Set(JOB_DEFAULT_SKILLS[role.key] ?? ['file', 'analysis', 'report']))
                        if (role.key !== 'blank') setName(`${role.label} 에이전트`)
                        else setName('')
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        gap: 8, padding: 16, borderRadius: 14, cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                        background: selected ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                        border: `1.5px solid ${selected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: selected ? 'rgba(255,255,255,0.15)' : 'var(--color-background-surface)',
                        border: `1px solid ${selected ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: selected ? 'var(--color-background-surface)' : 'var(--color-icon-primary)',
                      }}>
                        <AstryxIcon icon={role.icon} size="sm" color="inherit" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? 'var(--color-background-surface)' : 'var(--color-text-primary)', lineHeight: 1.2, marginBottom: 3 }}>
                          {role.label}
                        </div>
                        <div style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.65)' : 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                          {role.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 업무-에이전트 다중 선택 (실제 직무 선택 시) ── */}
          {showAgentSelect && (
            <div style={{ paddingBottom: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {jobTemplates.map(t => {
                  const selected = selectedTemplate === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setSelectedTemplate(selected ? '' : t.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit', width: '100%',
                        background: selected ? 'var(--color-background-muted)' : 'var(--color-background-surface)',
                        border: `1.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        transition: 'all 0.12s',
                      }}
                    >
                      <AgentIconBadge emoji={t.icon} boxSize={40} iconSize={18} radius={11} colored />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 2 }}>
                          {t.name}
                        </div>
                        <div style={{
                          fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {t.purpose}
                        </div>
                      </div>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: selected ? 'var(--color-accent)' : 'transparent',
                        border: `1.5px solid ${selected ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
                        color: 'var(--color-on-accent)',
                      }}>
                        {selected && <AstryxIcon icon={Check} size="xsm" color="inherit" strokeWidth={2.6} />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, textAlign: 'right', fontFamily: 'inherit' }}>
                <Text type="supporting" color="secondary">
                  {selectedTemplate ? '선택됨' : '에이전트를 하나 선택하세요.'}
                </Text>
              </div>
            </div>
          )}

          {/* ── 이름·말투 ── */}
          {showNameSection && (
            <VStack gap={4} style={{ paddingBottom: isTemplate ? 0 : 24 }}>
              <VStack gap={2}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>에이전트 이름</span>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 16px', height: 40, borderRadius: 999,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background-surface)',
                }}>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="예: 재무·회계 에이전트, 보험 FP 에이전트"
                    autoFocus
                    onFocus={e => e.target.select()}
                    style={{
                      flex: 1, border: 'none', outline: 'none',
                      background: 'transparent',
                      fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                    }}
                  />
                </div>
                {!isTemplate && selectedJob && selectedJob !== 'blank' && (
                  <Text type="supporting" color="secondary">직무에 맞게 자동 입력됩니다. 자유롭게 수정하세요.</Text>
                )}
              </VStack>
              <VStack gap={2}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>말투</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)} style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                      border: `1px solid ${tone === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: tone === t ? 'var(--color-accent)' : 'transparent',
                      color: tone === t ? 'var(--color-on-accent)' : 'var(--color-text-primary)',
                      fontSize: 14, fontFamily: 'inherit', fontWeight: tone === t ? 600 : 400,
                    }}>
                      {t}
                    </button>
                  ))}
                </div>
              </VStack>
            </VStack>
          )}

          {/* ── 스킬 ── */}
          {showSkillSection && (
            <div style={{ paddingBottom: 24, paddingTop: isBlankJob ? 0 : 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <FilterDropdown
                  label="전체"
                  options={SKILL_CATEGORIES}
                  value={skillCategory}
                  onChange={val => { setSkillCategory(val); setSkillSearch('') }}
                />
                <SearchBar value={skillSearch} onChange={setSkillSearch} placeholder="스킬 검색..." />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'inherit' }}>
                {skillSearch.trim()
                  ? `검색 결과 ${displayedSkills.length}개`
                  : skillCategory === '전체' ? '추천 스킬' : skillCategory}
              </div>
              {displayedSkills.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'inherit' }}>
                  <Text type="body" color="secondary">"{skillSearch}"에 맞는 스킬이 없습니다.</Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {displayedSkills.map(skill => {
                    const on = selectedSkills.has(skill.key)
                    return (
                      <button
                        key={skill.key}
                        title={skill.detail}
                        onClick={() => setSelectedSkills(prev => {
                          const next = new Set(prev)
                          on ? next.delete(skill.key) : next.add(skill.key)
                          return next
                        })}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                          background: on ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                          border: `1.5px solid ${on ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                          color: on ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
                          fontSize: 13, fontWeight: on ? 600 : 400,
                          fontFamily: 'inherit', transition: 'all 0.12s',
                        }}
                      >
                        <AstryxIcon icon={skill.icon} size="xsm" color="inherit" strokeWidth={on ? 2.2 : 1.6} />
                        {skill.label}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 16, textAlign: 'right', fontFamily: 'inherit' }}>
                <Text type="supporting" color="secondary">
                  {selectedSkills.size > 0 ? `${selectedSkills.size}개 선택됨` : '스킬을 하나 이상 선택하세요.'}
                </Text>
              </div>
            </div>
          )}

        </div>

        {/* ── 고정 푸터 ── */}
        <ModalFooter
          leftAction={step > 1
            ? <Button label="이전" variant="ghost" size="lg" style={MODAL_BUTTON_STYLE} onClick={() => setStep(s => s - 1)} />
            : undefined
          }
        >
          <Button label="취소" variant="secondary" size="lg" style={MODAL_BUTTON_STYLE} onClick={onClose} />
          {step < totalSteps
            ? <Button label="다음" variant="primary" size="lg" style={MODAL_BUTTON_STYLE} isDisabled={!canProceed} onClick={() => setStep(s => s + 1)} />
            : <Button
                label={loading
                  ? '만드는 중...'
                  : showAgentSelect
                  ? '만들기'
                  : '만들기'}
                variant="primary" size="lg" style={MODAL_BUTTON_STYLE}
                isDisabled={loading || (showAgentSelect && !selectedTemplate)}
                onClick={handleHire}
              />
          }
        </ModalFooter>
      </div>
    </div>,
    document.body
  )
}
