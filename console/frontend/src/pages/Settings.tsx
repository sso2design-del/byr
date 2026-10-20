import React, { useState, useEffect } from 'react'
import { useRole } from '../contexts/RoleContext'
import { createPortal } from 'react-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Switch } from '@astryxdesign/core/Switch'
import { Banner } from '@astryxdesign/core/Banner'
import { Badge } from '@astryxdesign/core/Badge'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Selector } from '@astryxdesign/core/Selector'
import { X, Check, Send, Search, ChevronRight, MessageSquare, HelpCircle, Home, ExternalLink, CheckCircle2, AlertCircle, Loader } from 'lucide-react'


/* ── 공통 스타일 상수 ── */
const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 18px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border-emphasized)',
  background: 'var(--color-background-surface)',
  color: 'var(--color-text-primary)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}
const INPUT_FOCUS = '1px solid var(--color-accent)'

type Tab = 'general' | 'members' | 'security' | 'environment' | 'connectors' | 'llm' | 'support'

const TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
  { key: 'general',     label: '일반' },
  { key: 'members',     label: '멤버',      adminOnly: true },
  { key: 'security',    label: '보안',      adminOnly: true },
  { key: 'environment', label: '콘솔 환경' },
  { key: 'connectors',  label: '연결' },
  { key: 'llm',         label: 'LLM 연결',  adminOnly: true },
  { key: 'support',     label: '지원' },
]

export default function Settings() {
  const { role } = useRole()
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState<Tab>('general')
  const [notifEmail, setNotifEmail] = useState(true)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860 }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1.2, marginBottom: 4 }}>
          설정
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
          조직과 계정을 관리합니다.
        </div>
      </div>

      {/* 탭 — inactive도 border 있음 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          if (t.adminOnly && !isAdmin) return null
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 18px', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                background: active ? 'var(--color-background-muted)' : 'transparent',
                cursor: 'pointer',
                fontSize: 14, fontWeight: active ? 600 : 400,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'inherit',
                boxShadow: 'none',
                transition: 'all 0.1s',
              }}
            >
              {t.label}
              {t.adminOnly && <Badge variant="warning" label="Admin" />}
            </button>
          )
        })}
      </div>

      {/* 콘텐츠 */}
      <div style={{ maxWidth: 560 }}>
        {tab === 'general'     && <GeneralSection />}
        {tab === 'members'     && <MembersSection />}
        {tab === 'security'    && <SecuritySection />}
        {tab === 'environment' && (
          <EnvironmentSection
            notifEmail={notifEmail} setNotifEmail={setNotifEmail}
          />
        )}
        {tab === 'connectors'  && <ConnectorsSection />}
        {tab === 'llm'         && <LlmSection />}
        {tab === 'support'     && <SupportSection />}
      </div>
    </div>
  )
}

/* ── 공통 컴포넌트 ─────────────────────────────────────────── */

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 3 }}>{description}</div>
      )}
    </div>
  )
}

function FieldBlock({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 3 }}>{label}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 8 }}>{description}</div>
      )}
      {children}
    </div>
  )
}

function PillInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...INPUT, border: focused ? INPUT_FOCUS : INPUT.border }}
    />
  )
}

function PillSelect<T extends string>({
  value, onChange, options, label = '선택',
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string
}) {
  return (
    <Selector
      label={label}
      isLabelHidden
      value={value}
      onChange={(v) => onChange(v as T)}
      options={options.map(o => ({ value: o.value, label: o.label }))}
    />
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-border)', margin: '28px 0' }} />
}

/* 이미지의 "Save changes" 버튼 스타일 */
function SaveBtn({ label = '저장', onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '10px 22px', borderRadius: 'var(--radius-full)',
        background: 'var(--color-accent)', border: 'none',
        color: 'var(--color-on-accent)',
        fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function OutlineBtn({ label, onClick, size = 'md' }: { label: string; onClick?: () => void; size?: 'sm' | 'md' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: size === 'sm' ? '6px 14px' : '9px 18px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--color-border-emphasized)',
        background: 'var(--color-background-surface)',
        color: 'var(--color-text-primary)',
        fontSize: size === 'sm' ? 13 : 14, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function ListBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-element)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-background-surface)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function ListRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <div style={{ padding: '14px 16px' }}>{children}</div>
      {!last && <div style={{ height: 1, background: 'var(--color-border)' }} />}
    </>
  )
}

/* ── 일반 탭 ─────────────────────────────────────────────── */

function GeneralSection() {
  const [name, setName]         = useState('황소이')
  const [email, setEmail]       = useState('soyi.hwang@company.com')
  const [title, setTitle]       = useState('선임 PO')
  const [org, setOrg]           = useState('Company Inc.')
  const [curPw, setCurPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [newPwC, setNewPwC]     = useState('')

  return (
    <VStack gap={0}>
      <SectionHeading title="프로필" description="계정 프로필을 관리합니다." />
      <FieldBlock label="이름"><PillInput value={name} onChange={setName} /></FieldBlock>
      <FieldBlock label="이메일"><PillInput value={email} onChange={setEmail} /></FieldBlock>
      <FieldBlock label="직책"><PillInput value={title} onChange={setTitle} /></FieldBlock>
      <div style={{ marginBottom: 8 }}><SaveBtn label="프로필 저장" /></div>

      <Divider />

      <SectionHeading title="비밀번호 변경" />
      <FieldBlock label="현재 비밀번호"><PillInput value={curPw} onChange={setCurPw} type="password" /></FieldBlock>
      <FieldBlock label="새 비밀번호"><PillInput value={newPw} onChange={setNewPw} type="password" /></FieldBlock>
      <FieldBlock label="새 비밀번호 확인"><PillInput value={newPwC} onChange={setNewPwC} type="password" /></FieldBlock>
      <div style={{ marginBottom: 8 }}><OutlineBtn label="비밀번호 변경" /></div>

      <Divider />

      <SectionHeading title="회사·조직" />
      <FieldBlock label="회사·조직 이름"><PillInput value={org} onChange={setOrg} /></FieldBlock>
      <div><SaveBtn /></div>
    </VStack>
  )
}

/* ── 멤버 탭 ─────────────────────────────────────────────── */

interface Member { name: string; email: string; role: string; pending?: boolean }

const SELF_EMAIL = 'soyi.hwang@company.com'

const MEMBER_ROLES: { key: string; desc: string }[] = [
  { key: '조직 관리자', desc: '멤버·에이전트·빌링·설정 전체를 관리합니다.' },
  { key: '결제 관리자', desc: '빌링·결제와 설정에 접근합니다.' },
  { key: '일반 사용자', desc: '조직·마켓플레이스를 사용합니다.' },
]

const roleBadgeVariant = (role: string) =>
  role === '조직 관리자' ? 'info' : role === '결제 관리자' ? 'success' : 'neutral'

function MembersSection() {
  const [members, setMembers] = useState<Member[]>([
    { name: '황소이', email: SELF_EMAIL,                role: '조직 관리자' },
    { name: '김개발', email: 'dev.kim@company.com',    role: '일반 사용자' },
    { name: '박기획', email: 'plan.park@company.com',  role: '일반 사용자' },
  ])
  const [roleTarget, setRoleTarget] = useState<Member | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600) }

  const saveRole = (email: string, role: string) => {
    setMembers(prev => prev.map(m => (m.email === email ? { ...m, role } : m)))
    setRoleTarget(null)
    flash('권한이 변경됐어요.')
  }

  const sendInvite = (email: string, role: string) => {
    setMembers(prev => [...prev, { name: (email[0] ?? '?').toUpperCase(), email, role, pending: true }])
    setInviteOpen(false)
    flash(`${email} 님에게 초대를 보냈어요.`)
  }

  return (
    <VStack gap={0}>
      <SectionHeading title="멤버" description="조직 멤버 및 권한을 관리합니다." />
      <ListBox>
        {members.map((m, i) => (
          <ListRow key={m.email} last={i === members.length - 1}>
            <HStack hAlign="between" vAlign="center">
              <HStack gap={3} vAlign="center">
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: m.pending ? 'var(--color-border-emphasized)' : '#374151',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{m.name[0]}</span>
                </div>
                <VStack gap={0}>
                  <Text type="body">{m.pending ? m.email : m.name}</Text>
                  <Text type="supporting" color="secondary">{m.pending ? '초대 수락 대기 중' : m.email}</Text>
                </VStack>
              </HStack>
              <HStack gap={2} vAlign="center">
                {m.pending && <Badge variant="warning" label="초대 대기" />}
                <Badge variant={roleBadgeVariant(m.role)} label={m.role} />
                {!m.pending && m.email !== SELF_EMAIL && (
                  <OutlineBtn label="권한 변경" size="sm" onClick={() => setRoleTarget(m)} />
                )}
              </HStack>
            </HStack>
          </ListRow>
        ))}
      </ListBox>
      <div style={{ marginTop: 14 }}>
        <OutlineBtn label="+ 멤버 초대" onClick={() => setInviteOpen(true)} />
      </div>

      {roleTarget && (
        <RoleChangeModal member={roleTarget} onClose={() => setRoleTarget(null)} onSave={saveRole} />
      )}
      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onInvite={sendInvite} />
      )}
      {toast && <MemberToast message={toast} />}
    </VStack>
  )
}

/* 멤버 탭 모달 — 공통 셸 */
function MemberModalShell({
  title, subtitle, width = 460, children, footer, onClose,
}: {
  title: string; subtitle?: string; width?: number
  children: React.ReactNode; footer: React.ReactNode; onClose: () => void
}) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)',
          width, maxWidth: '100%', maxHeight: '88vh', position: 'relative',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
      >
        <button
          onClick={onClose} aria-label="닫기"
          style={{
            position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%',
            background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)',
          }}
        >
          <AstryxIcon icon={X} size="sm" strokeWidth={2} />
        </button>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: subtitle ? 6 : 18, lineHeight: 1.2 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 18 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 8px' }}>{children}</div>
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* 역할 선택 — 라디오 카드 (드롭다운 대신) */
function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
      {MEMBER_ROLES.map((r, i) => {
        const sel = value === r.key
        return (
          <div
            key={r.key} onClick={() => onChange(r.key)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', cursor: 'pointer',
              borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
              background: sel ? 'var(--color-background-muted)' : 'transparent',
            }}
          >
            <div style={{
              marginTop: 2, width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${sel ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
              background: sel ? 'var(--color-accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: sel ? 600 : 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{r.key}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 2 }}>{r.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ModalGhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 22px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--color-border-emphasized)',
      background: 'var(--color-background-surface)', fontSize: 14, fontWeight: 500,
      color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  )
}

function ModalPrimaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--color-accent)',
      fontSize: 14, fontWeight: 600, color: 'var(--color-on-accent)',
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  )
}

/* 권한 변경 모달 */
function RoleChangeModal({ member, onClose, onSave }: {
  member: Member; onClose: () => void; onSave: (email: string, role: string) => void
}) {
  const [role, setRole] = useState(member.role)
  const changed = role !== member.role
  return (
    <MemberModalShell
      title="권한 변경"
      subtitle={`${member.name} · ${member.email}`}
      onClose={onClose}
      footer={<>
        <ModalGhostBtn label="취소" onClick={onClose} />
        <ModalPrimaryBtn label="변경 저장" disabled={!changed} onClick={() => onSave(member.email, role)} />
      </>}
    >
      <div style={{ paddingBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8, fontFamily: 'inherit' }}>역할</div>
        <RolePicker value={role} onChange={setRole} />
      </div>
    </MemberModalShell>
  )
}

/* 멤버 초대 모달 */
function InviteModal({ onClose, onInvite }: {
  onClose: () => void; onInvite: (email: string, role: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('일반 사용자')
  const valid = /\S+@\S+\.\S+/.test(email.trim())
  return (
    <MemberModalShell
      title="멤버 초대"
      subtitle="이메일로 조직에 초대합니다. 초대 링크가 발송됩니다."
      width={480}
      onClose={onClose}
      footer={<>
        <ModalGhostBtn label="취소" onClick={onClose} />
        <ModalPrimaryBtn label="초대 보내기" disabled={!valid} onClick={() => onInvite(email.trim(), role)} />
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8, fontFamily: 'inherit' }}>이메일</div>
          <PillInput value={email} onChange={setEmail} placeholder="name@company.com" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8, fontFamily: 'inherit' }}>역할</div>
          <RolePicker value={role} onChange={setRole} />
        </div>
      </div>
    </MemberModalShell>
  )
}

function MemberToast({ message }: { message: string }) {
  return createPortal(
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
      background: '#1a1a1a', color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-full)',
      fontSize: 14, fontWeight: 500, fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>{message}</div>,
    document.body,
  )
}

/* ── 보안 탭 ─────────────────────────────────────────────── */

function SecuritySection() {
  const sessions = [
    { device: 'macOS · Chrome', location: '서울특별시', time: '2026-07-06 09:12', current: true },
    { device: 'macOS · Safari', location: '성남시',     time: '2026-07-03 14:30', current: false },
  ]
  return (
    <VStack gap={0}>
      <SectionHeading title="보안" description="계정 보안 및 로그인 기록을 확인합니다." />
      <Banner status="info" title="2단계 인증 (2FA)" description="계정 보안을 강화하려면 2단계 인증을 활성화하세요." />
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <Switch label="2단계 인증 사용" value={false} onChange={() => {}}
          labelPosition="start" labelSpacing="spread" width="100%" />
      </div>

      <Divider />

      <SectionHeading title="로그인 기록" />
      <ListBox>
        {sessions.map((s, i) => (
          <ListRow key={i} last={i === sessions.length - 1}>
            <HStack hAlign="between" vAlign="center">
              <VStack gap={0}>
                <Text type="body">{s.device}</Text>
                <Text type="supporting" color="secondary">{s.location} · {s.time}</Text>
              </VStack>
              {s.current
                ? <Badge variant="success" label="현재 세션" />
                : <OutlineBtn label="로그아웃" size="sm" />}
            </HStack>
          </ListRow>
        ))}
      </ListBox>
    </VStack>
  )
}

/* ── 콘솔 환경 탭 ────────────────────────────────────────── */

const EMAIL_EVENTS = [
  { key: 'exec_result', label: '실행 결과' },
  { key: 'error_alert', label: '오류·경고' },
  { key: 'weekly_report', label: '주간 요약' },
]

const NOTIF_MEMBERS = [
  { name: '황소이', email: 'soyi.hwang@company.com' },
  { name: '김개발', email: 'dev.kim@company.com' },
  { name: '박기획', email: 'plan.park@company.com' },
]

function EnvironmentSection({
  notifEmail, setNotifEmail,
}: {
  notifEmail: boolean; setNotifEmail: (v: boolean) => void
}) {
  type LangOption = '한국어' | 'English'
  type TzOption   = 'Asia/Seoul (UTC+09:00)' | 'Asia/Tokyo (UTC+09:00)' | 'America/New_York (UTC-05:00)' | 'Europe/London (UTC+00:00)'

  const [lang, setLang]         = useState<LangOption>('한국어')
  const [timezone, setTimezone] = useState<TzOption>('Asia/Seoul (UTC+09:00)')
  const [memberSettings, setMemberSettings] = useState<Record<string, Record<string, boolean>>>(
    Object.fromEntries(NOTIF_MEMBERS.map(m => [m.email, Object.fromEntries(EMAIL_EVENTS.map(e => [e.key, true]))]))
  )
  const [memberSearch, setMemberSearch] = useState('')

  const filteredMembers = NOTIF_MEMBERS.filter(m =>
    m.name.includes(memberSearch) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const toggleMemberEvent = (email: string, eventKey: string, val: boolean) => {
    setMemberSettings(prev => ({ ...prev, [email]: { ...prev[email], [eventKey]: val } }))
  }

  return (
    <VStack gap={0}>
      <SectionHeading title="콘솔 환경" description="언어, 시간대, 알림 설정을 관리합니다." />
      <FieldBlock label="언어">
        <PillSelect
          value={lang}
          onChange={setLang}
          options={[
            { value: '한국어', label: '한국어' },
            { value: 'English', label: 'English' },
          ]}
        />
      </FieldBlock>
      <FieldBlock label="시간대">
        <PillSelect
          value={timezone}
          onChange={setTimezone}
          options={[
            { value: 'Asia/Seoul (UTC+09:00)',       label: 'Asia/Seoul (UTC+09:00)' },
            { value: 'Asia/Tokyo (UTC+09:00)',       label: 'Asia/Tokyo (UTC+09:00)' },
            { value: 'America/New_York (UTC-05:00)', label: 'America/New_York (UTC-05:00)' },
            { value: 'Europe/London (UTC+00:00)',    label: 'Europe/London (UTC+00:00)' },
          ]}
        />
      </FieldBlock>
      <div style={{ marginBottom: 8 }}><SaveBtn /></div>

      <Divider />

      <SectionHeading title="이메일 알림 설정" description="멤버별로 수신할 이메일 알림 범위를 설정합니다." />
      <ListBox>
        <ListRow last>
          <Switch label="이메일 알림" value={notifEmail} onChange={setNotifEmail}
            labelPosition="start" labelSpacing="spread" width="100%" />
        </ListRow>
      </ListBox>

      {notifEmail && (
        <div style={{ marginTop: 16 }}>
          {/* 멤버 검색 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', marginBottom: 8,
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)',
            background: 'var(--color-background-surface)',
          }}>
            <AstryxIcon icon={Search} size="sm" color="secondary" style={{ flexShrink: 0 }} />
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="멤버 이름 또는 이메일 검색"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}
            />
            {memberSearch && (
              <button onClick={() => setMemberSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <AstryxIcon icon={X} size="sm" color="secondary" />
              </button>
            )}
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
            {/* 헤더 행 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr repeat(3, 78px)',
              padding: '8px 14px', background: 'var(--color-background-muted)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>멤버</div>
              {EMAIL_EVENTS.map(e => (
                <div key={e.key} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'inherit', textAlign: 'center' }}>{e.label}</div>
              ))}
            </div>
            {/* 멤버 행 */}
            {filteredMembers.length === 0 ? (
              <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                검색 결과가 없습니다
              </div>
            ) : filteredMembers.map((m, mi) => (
              <div key={m.email} style={{
                display: 'grid', gridTemplateColumns: '1fr repeat(3, 78px)',
                padding: '10px 14px', alignItems: 'center',
                borderTop: mi > 0 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 1 }}>{m.email}</div>
                </div>
                {EMAIL_EVENTS.map(e => (
                  <div key={e.key} style={{ display: 'flex', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={memberSettings[m.email]?.[e.key] ?? true}
                      onChange={ev => toggleMemberEvent(m.email, e.key, ev.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}><SaveBtn /></div>
    </VStack>
  )
}


/* ── LLM 연결 탭 ─────────────────────────────────────────── */

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid'

const LLM_PROVIDERS: {
  key: string; name: string; vendor: string
  placeholder: string; linkLabel: string; linkUrl: string
  validate: (v: string) => boolean
}[] = [
  {
    key: 'anthropic', name: 'Claude', vendor: 'Anthropic',
    placeholder: 'sk-ant-api03-...',
    linkLabel: 'platform.claude.com/settings/keys',
    linkUrl: 'https://platform.claude.com/settings/keys',
    validate: v => v.startsWith('sk-ant-') && v.length > 20,
  },
  {
    key: 'openai', name: 'GPT', vendor: 'OpenAI',
    placeholder: 'sk-proj-...',
    linkLabel: 'platform.openai.com/api-keys',
    linkUrl: 'https://platform.openai.com/api-keys',
    validate: v => v.startsWith('sk-') && v.length > 20,
  },
  {
    key: 'google', name: 'Gemini', vendor: 'Google',
    placeholder: 'AIzaSy...',
    linkLabel: 'aistudio.google.com/apikey',
    linkUrl: 'https://aistudio.google.com/apikey',
    validate: v => v.startsWith('AIza') && v.length > 20,
  },
]

function maskKey(key: string): string {
  return key.slice(0, 6) + '****...' + key.slice(-4)
}

function LlmKeyModal({
  provider, onClose, onSave,
}: {
  provider: typeof LLM_PROVIDERS[number]
  onClose: () => void
  onSave: (key: string) => void
}) {
  const [inputKey, setInputKey] = useState('')
  const [validation, setValidation] = useState<ValidationState>('idle')
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    setInputKey(v)
    if (!v.trim()) { setValidation('idle'); return }
    setValidation('checking')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setValidation(provider.validate(v.trim()) ? 'valid' : 'invalid')
    }, 600)
  }

  return (
    <MemberModalShell
      title={`${provider.name} API 키 등록`}
      subtitle={`${provider.vendor} 대시보드에서 발급한 API 키를 입력하세요.`}
      width={480}
      onClose={onClose}
      footer={<>
        <ModalGhostBtn label="취소" onClick={onClose} />
        <ModalPrimaryBtn
          label="저장"
          disabled={validation !== 'valid'}
          onClick={() => { onSave(inputKey.trim()); onClose() }}
        />
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
        {/* 비용 고지 — D-21 필수 */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 14px', borderRadius: 'var(--radius-inner)',
          background: 'var(--color-background-muted)',
          border: '1px solid var(--color-border)',
        }}>
          <AstryxIcon icon={AlertCircle} size="sm" color="secondary" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.5 }}>
            해당 LLM 제공사에 <strong style={{ color: 'var(--color-text-primary)' }}>별도 요금</strong>이 발생합니다.
            Byr 플랜은 플랫폼 이용료만 청구합니다.
          </span>
        </div>

        {/* 키 입력 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8, fontFamily: 'inherit' }}>API 키</div>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              value={inputKey}
              onChange={e => handleChange(e.target.value)}
              placeholder={provider.placeholder}
              autoComplete="off"
              style={{
                ...INPUT,
                paddingRight: 40,
                border: validation === 'valid' ? '1px solid var(--color-status-active)'
                  : validation === 'invalid' ? '1px solid var(--color-error)'
                  : INPUT.border,
              }}
            />
            {validation !== 'idle' && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                {validation === 'checking' && <AstryxIcon icon={Loader} size="sm" color="secondary" />}
                {validation === 'valid'    && <AstryxIcon icon={CheckCircle2} size="sm" style={{ color: 'var(--color-status-active)' }} color="inherit" />}
                {validation === 'invalid'  && <AstryxIcon icon={AlertCircle} size="sm" color="error" />}
              </span>
            )}
          </div>
          {validation === 'invalid' && (
            <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 5, fontFamily: 'inherit' }}>
              유효하지 않은 키 형식입니다. {provider.vendor} 대시보드에서 발급된 키를 붙여넣어 주세요.
            </div>
          )}
          {validation === 'valid' && (
            <div style={{ fontSize: 12, color: 'var(--color-status-active)', marginTop: 5, fontFamily: 'inherit' }}>
              유효한 키 형식입니다.
            </div>
          )}
        </div>

        {/* 발급 페이지 바로가기 — D-22 */}
        <a
          href={provider.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 13, color: 'var(--color-accent)', fontFamily: 'inherit',
            textDecoration: 'none',
          }}
        >
          <AstryxIcon icon={ExternalLink} size="xsm" color="accent" />
          {provider.linkLabel} 에서 API 키 발급받기
        </a>
      </div>
    </MemberModalShell>
  )
}

// ── 연결(커넥터) ────────────────────────────────────────────────
interface MailProvider { key: string; label: string; note: string; help: string; needs_server: boolean }

const MAIL_BRAND: Record<string, { label: string; color: string; fg?: string; mark: string; oauth?: boolean }> = {
  gmail:   { label: 'Google로 연결',    color: '#fff',    fg: '#3c4043', mark: 'G', oauth: true },
  outlook: { label: 'Outlook으로 연결', color: '#0F6CBD', fg: '#fff',    mark: 'O', oauth: true },
  naver:   { label: '네이버로 연결',    color: '#03C75A', fg: '#fff',    mark: 'N' },
  daum:    { label: '다음 / 카카오',    color: '#FEE500', fg: '#3c1e1e', mark: 'k' },
  custom:  { label: '기타 SMTP',        color: '#5B6472', fg: '#fff',    mark: '@' },
}

function ConnectorsSection() {
  const [status, setStatus] = useState<{ connected: boolean; address?: string | null; provider?: string | null }>({ connected: false })
  const [providers, setProviders] = useState<MailProvider[]>([])
  const [provider, setProvider] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [pw, setPw] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('465')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = () => fetch('/api/connectors/email').then(r => r.json()).then(setStatus).catch(() => {})
  useEffect(() => {
    load()
    fetch('/api/connectors/email/providers').then(r => r.json()).then(setProviders).catch(() => {})
  }, [])

  const cur = providers.find(p => p.key === provider)
  const custom = cur?.needs_server

  const connect = async () => {
    setBusy(true); setErr('')
    try {
      const body: Record<string, unknown> = { provider, address: address.trim(), password: pw }
      if (custom) { body.host = host.trim(); body.port = Number(port) || 0 }
      const r = await fetch('/api/connectors/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (r.ok) { setFormOpen(false); setAddress(''); setPw(''); await load(); flash('이메일이 연결됐습니다.') }
      else { const d = await r.json().catch(() => ({})); setErr(d.detail || '연결에 실패했습니다.') }
    } catch { setErr('연결에 실패했습니다.') }
    finally { setBusy(false) }
  }
  const disconnect = async () => { await fetch('/api/connectors/email', { method: 'DELETE' }); setPw(''); await load(); flash('이메일 연결을 해제했습니다.') }

  return (
    <VStack gap={0}>
      <SectionHeading
        title="연결"
        description="제안서 발송 등 외부로 나가는 작업에 쓰는 계정을 연결합니다. 비밀번호는 서버에만 안전하게 보관되며 저장소·리포지토리에 남지 않습니다."
      />

      <ListBox>
        <ListRow last>
          <HStack hAlign="between" vAlign="center">
            <VStack gap={0}>
              <HStack gap={2} vAlign="center">
                <Text type="body" style={{ fontWeight: 600 }}>이메일</Text>
                <Text type="supporting" color="secondary">Gmail·Outlook·네이버·다음·기타 · 제안서 PDF 발송</Text>
              </HStack>
              {status.connected && status.address && (
                <Text type="supporting" color="secondary" style={{ marginTop: 2 }}>
                  {status.address}{status.provider ? ` · ${(providers.find(p => p.key === status.provider)?.label) || status.provider}` : ''}
                </Text>
              )}
            </VStack>
            <HStack gap={2} vAlign="center">
              <Badge variant={status.connected ? 'success' : 'neutral'} label={status.connected ? '연결됨' : '미연결'} />
              {status.connected
                ? <OutlineBtn label="연결 해제" size="sm" onClick={disconnect} />
                : <OutlineBtn label="연결" size="sm" onClick={() => { setErr(''); setProvider(''); setFormOpen(o => !o) }} />}
            </HStack>
          </HStack>
        </ListRow>
      </ListBox>

      {!status.connected && formOpen && (
        <div style={{ marginTop: 14, padding: 18, borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
          {!provider ? (
            /* 1단계: 계정별 버튼 */
            <VStack gap={2}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 9, background: 'var(--color-background-muted)' }}>
                프로덕션에선 <b>Byr 로그인에 쓴 계정(Google·Microsoft)</b>의 메일이 자동 연동됩니다. 지금은 데모라 계정을 골라 연결하세요.
              </div>
              {(providers.length ? providers.map(p => p.key) : Object.keys(MAIL_BRAND)).map(key => {
                const b = MAIL_BRAND[key]; if (!b) return null
                return (
                  <button key={key} onClick={() => { setProvider(key); setErr(''); setAddress(''); setPw('') }} style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 14px', borderRadius: 12,
                    border: '1px solid var(--color-border-emphasized)', background: 'var(--color-background-surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: b.color, color: b.fg, border: b.color === '#fff' ? '1px solid var(--color-border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{b.mark}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{b.label}</span>
                    {b.oauth && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-secondary)', padding: '2px 7px', borderRadius: 999, background: 'var(--color-background-muted)' }}>OAuth</span>}
                  </button>
                )
              })}
            </VStack>
          ) : (
            /* 2단계: 선택한 계정 폼 */
            <VStack gap={3}>
              <button onClick={() => setProvider('')} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12.5, fontFamily: 'inherit', padding: 0 }}>← 다른 계정 선택</button>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>{MAIL_BRAND[provider]?.label}</div>
              {MAIL_BRAND[provider]?.oauth && (
                <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '9px 11px', borderRadius: 9, background: 'var(--color-background-muted)' }}>
                  프로덕션에선 <b>{provider === 'gmail' ? 'Google' : 'Microsoft'} 로그인 팝업</b>으로 비밀번호 없이 연결됩니다. 지금은 데모라 아래로 연결하세요{provider === 'gmail' ? '(앱 비밀번호)' : ''}.
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {cur?.note}
                {cur?.help && <a href={cur.help} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', marginLeft: 4, textDecoration: 'none' }}>도움말 ↗</a>}
              </div>
              <FieldBlock label="이메일 주소"><PillInput value={address} onChange={setAddress} placeholder="you@example.com" type="email" /></FieldBlock>
              <FieldBlock label={provider === 'gmail' ? '앱 비밀번호' : '비밀번호(또는 앱 비밀번호)'}><PillInput value={pw} onChange={setPw} placeholder="비밀번호" type="password" /></FieldBlock>
              {custom && (
                <HStack gap={2}>
                  <div style={{ flex: 2 }}><FieldBlock label="SMTP 서버"><PillInput value={host} onChange={setHost} placeholder="smtp.example.com" /></FieldBlock></div>
                  <div style={{ flex: 1 }}><FieldBlock label="포트"><PillInput value={port} onChange={setPort} placeholder="465" /></FieldBlock></div>
                </HStack>
              )}
              {err && <Text type="supporting" style={{ color: 'var(--color-status-error, #c0392b)' }}>{err}</Text>}
              <HStack gap={2}>
                <SaveBtn label={busy ? '연결 확인 중…' : '연결'} onClick={busy ? undefined : connect} />
                <OutlineBtn label="취소" onClick={() => { setFormOpen(false); setProvider(''); setErr('') }} />
              </HStack>
            </VStack>
          )}
        </div>
      )}

      {toast && (
        <div style={{ marginTop: 14 }}>
          <Banner status="success" title={toast} />
        </div>
      )}
    </VStack>
  )
}

function LlmSection() {
  const [registered, setRegistered] = useState<Record<string, string>>({})
  const [editTarget, setEditTarget] = useState<typeof LLM_PROVIDERS[number] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<typeof LLM_PROVIDERS[number] | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2400) }

  const saveKey = (providerKey: string, apiKey: string) => {
    setRegistered(prev => ({ ...prev, [providerKey]: apiKey }))
    flash('API 키가 등록됐습니다.')
  }

  const deleteKey = (providerKey: string) => {
    setRegistered(prev => { const n = { ...prev }; delete n[providerKey]; return n })
    setDeleteTarget(null)
    flash('API 키가 삭제됐습니다. 해당 공급사 LLM을 사용하는 에이전트 토글이 비활성화됩니다.')
  }

  return (
    <VStack gap={0}>
      <SectionHeading
        title="글로벌 LLM 연결"
        description="외부 LLM(Claude·GPT·Gemini) API 키를 등록하면 에이전트별로 글로벌 LLM을 선택할 수 있습니다."
      />

      <ListBox>
        {LLM_PROVIDERS.map((p, i) => {
          const key = registered[p.key]
          const isRegistered = Boolean(key)
          return (
            <ListRow key={p.key} last={i === LLM_PROVIDERS.length - 1}>
              <HStack hAlign="between" vAlign="center">
                <VStack gap={0}>
                  <HStack gap={2} vAlign="center">
                    <Text type="body" style={{ fontWeight: 600 }}>{p.name}</Text>
                    <Text type="supporting" color="secondary">{p.vendor}</Text>
                  </HStack>
                  {isRegistered && (
                    <Text type="supporting" color="secondary" style={{ fontFamily: 'monospace', marginTop: 2 }}>
                      {maskKey(key)}
                    </Text>
                  )}
                </VStack>
                <HStack gap={2} vAlign="center">
                  <Badge
                    variant={isRegistered ? 'success' : 'neutral'}
                    label={isRegistered ? '등록됨' : '미등록'}
                  />
                  {isRegistered ? (
                    <OutlineBtn label="삭제" size="sm" onClick={() => setDeleteTarget(p)} />
                  ) : (
                    <OutlineBtn label="등록하기" size="sm" onClick={() => setEditTarget(p)} />
                  )}
                </HStack>
              </HStack>
            </ListRow>
          )
        })}
      </ListBox>

      <div style={{ marginTop: 12 }}>
        <Banner
          status="info"
          title="등록된 키는 암호화 저장됩니다"
          description="API 키는 KMS(키 관리 서비스)에만 저장되며, 화면·로그에 평문으로 노출되지 않습니다."
        />
      </div>

      {editTarget && (
        <LlmKeyModal
          provider={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={key => saveKey(editTarget.key, key)}
        />
      )}

      {deleteTarget && (
        <MemberModalShell
          title={`${deleteTarget.name} API 키 삭제`}
          subtitle="삭제하면 이 공급사의 글로벌 LLM을 사용하는 모든 에이전트 토글이 비활성화됩니다."
          width={420}
          onClose={() => setDeleteTarget(null)}
          footer={<>
            <ModalGhostBtn label="취소" onClick={() => setDeleteTarget(null)} />
            <ModalPrimaryBtn label="삭제" onClick={() => deleteKey(deleteTarget.key)} />
          </>}
        >
          <div style={{ paddingBottom: 8 }}>
            <Text type="body" color="secondary">등록된 키: <span style={{ fontFamily: 'monospace' }}>{maskKey(registered[deleteTarget.key] ?? '')}</span></Text>
          </div>
        </MemberModalShell>
      )}

      {toast && <MemberToast message={toast} />}
    </VStack>
  )
}

/* ── 지원 탭 ─────────────────────────────────────────────── */

const FAQ_ARTICLES = [
  '에이전트를 처음 만드는 방법',
  '스킬 옵션 설정 및 세부 구성 방법',
  '메신저 채널에 에이전트 배치하기',
  '스케줄 만들기와 실행 설정',
  '멤버 초대 및 권한 관리',
]

function SupportSection() {
  const [showChatbot, setShowChatbot] = useState(false)
  const [chatTab, setChatTab] = useState<'home' | 'message' | 'help'>('home')
  const [msgInput, setMsgInput] = useState('')
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([])

  const sendMessage = () => {
    if (!msgInput.trim()) return
    const text = msgInput.trim()
    setMessages(prev => [
      ...prev,
      { sender: 'user', text },
      { sender: 'bot', text: '안녕하세요! Byr 고객센터입니다. 담당자가 검토 후 답변드릴게요. 추가로 궁금한 점이 있으시면 말씀해 주세요.' },
    ])
    setMsgInput('')
  }

  return (
    <VStack gap={0}>
      <SectionHeading title="지원" description="고객센터를 이용합니다." />
      <ListBox>
        <ListRow last>
          <VStack gap={2}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>고객센터</div>
            <Banner
              status="info"
              title="콘솔 고객센터는 챗봇 단일 채널"
              description="홈페이지(챗봇+이메일+문의폼)와 달리, 콘솔 내 고객센터는 챗봇 하나만 제공합니다."
            />
            <div><SaveBtn label="챗봇 문의 시작" onClick={() => setShowChatbot(true)} /></div>
          </VStack>
        </ListRow>
      </ListBox>

      {showChatbot && createPortal(
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 360, height: 580, borderRadius: 'var(--radius-container)', overflow: 'hidden', boxShadow: '0 16px 64px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column' }}>

          {/* ── 헤더 (다크) ── */}
          <div style={{ background: '#111', padding: '18px 18px 22px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-inner)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#000', fontFamily: 'inherit', letterSpacing: -1 }}>P</span>
              </div>
              <button onClick={() => setShowChatbot(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4, display: 'flex' }}>
                <span style={{ color: '#fff', display: 'flex' }}><AstryxIcon icon={X} size="md" color="inherit" /></span>
              </button>
            </div>
            <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1.45 }}>
              안녕하세요 👋<br />도움이 필요하신가요?
            </div>
          </div>

          {/* ── 바디 ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, background: 'var(--color-background-surface)' }}>

            {chatTab === 'home' && (
              <>
                {/* 상태 카드 */}
                <div style={{ borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', padding: '11px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-status-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', display: 'flex' }}><AstryxIcon icon={Check} size="xsm" color="inherit" /></span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>Status: All Systems Operational</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>Updated Jul 7, 11:48 UTC</div>
                  </div>
                </div>

                {/* 메시지 보내기 카드 */}
                <div
                  onClick={() => setChatTab('message')}
                  style={{ borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', padding: '13px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--color-background-surface)' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>메시지를 보내주세요</span>
                  <AstryxIcon icon={Send} size="sm" color="accent" />
                </div>

                {/* FAQ */}
                <div style={{ borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-muted)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>도움말 검색</span>
                    <AstryxIcon icon={Search} size="sm" color="secondary" />
                  </div>
                  {FAQ_ARTICLES.map((a, i) => (
                    <div
                      key={i}
                      style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 13, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>{a}</span>
                      <AstryxIcon icon={ChevronRight} size="sm" color="accent" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {chatTab === 'message' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                    문의 내용을 입력해주세요
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '78%', padding: '9px 13px', borderRadius: msg.sender === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.sender === 'user' ? 'var(--color-accent)' : 'var(--color-background-muted)',
                      color: msg.sender === 'user' ? 'var(--color-on-accent)' : 'var(--color-text-primary)',
                      fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {chatTab === 'help' && (
              <div style={{ borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                {FAQ_ARTICLES.map((a, i) => (
                  <div key={i} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>{a}</span>
                    <AstryxIcon icon={ChevronRight} size="sm" color="accent" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 메시지 입력창 (message 탭일 때만) ── */}
          {chatTab === 'message' && (
            <div style={{ padding: '8px 12px', background: 'var(--color-background-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="메시지 입력..."
                style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--color-background-muted)', color: 'var(--color-text-primary)' }}
              />
              <button
                onClick={sendMessage}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span style={{ color: 'var(--color-on-accent)', display: 'flex' }}>
                  <AstryxIcon icon={Send} size="sm" color="inherit" />
                </span>
              </button>
            </div>
          )}

          {/* ── 하단 탭 네비 ── */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)', background: 'var(--color-background-surface)', flexShrink: 0 }}>
            {([
              { key: 'home',    label: '홈',     Icon: Home },
              { key: 'message', label: '메시지', Icon: MessageSquare },
              { key: 'help',    label: '도움말', Icon: HelpCircle },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setChatTab(t.key)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  color: chatTab === t.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontFamily: 'inherit',
                }}
              >
                <t.Icon size={18} />
                <span style={{ fontSize: 11, fontWeight: chatTab === t.key ? 600 : 400 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </VStack>
  )
}
