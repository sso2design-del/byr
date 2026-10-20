import React, { useState, useRef, useEffect } from 'react'
import { useRole } from '../contexts/RoleContext'
import { createPortal } from 'react-dom'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AppShell } from '@astryxdesign/core/AppShell'
import { SideNav, useSideNavCollapse } from '@astryxdesign/core/SideNav'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'
import {
  Bot, Store, Settings, LayoutDashboard, HelpCircle, CreditCard, LogOut,
  MoreHorizontal, PanelLeft, Users, BookOpen, ShieldCheck,
} from 'lucide-react'
import { signOut, getProfile } from '../lib/auth'
import { BrandMark } from './BrandMark'

/* ── 앱 로고: Byr 브랜드 마크(흐르는 B·돛) ── */
function AppLogo() {
  return <BrandMark size={28} radius={22} />
}

/* ── 개별 메뉴 아이템: useSideNavCollapse로 collapse 상태 자동 감지 ── */
function NavItem({
  icon, label, active, onClick,
}: {
  icon: IconType; label: string; active?: boolean; onClick: () => void
}) {
  const { isCollapsed } = useSideNavCollapse()
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isCollapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: isCollapsed ? 0 : 10,
        width: '100%',
        padding: isCollapsed ? '10px' : '8px 14px',
        borderRadius: 999,
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 14, fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: active
          ? 'rgba(0,0,0,0.07)'
          : hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
        textAlign: 'left', transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
    >
      <AstryxIcon icon={icon} size="sm" color="inherit" strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
      {!isCollapsed && label}
    </button>
  )
}

/* ── 팝오버 메뉴 아이템 ── */
const POPOVER_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '9px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
  textAlign: 'left',
}

export default function Layout() {
  // 소셜 로그인으로 받은 프로필이 있으면 그 이름·이메일, 없으면 데모 계정
  const prof = getProfile()
  const me = { name: prof?.name || '황소이 선임', email: prof?.email || 'soyi.hwang@company.com' }
  const navigate  = useNavigate()
  const location  = useLocation()
  const isActive  = (prefix: string) => location.pathname.startsWith(prefix)

  const { role, setRole } = useRole()
  const [collapsed, setCollapsed]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef    = useRef<HTMLDivElement>(null)
  const triggerRef    = useRef<HTMLButtonElement>(null)
  const popoverRef    = useRef<HTMLDivElement>(null)
  const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number } | null>(null)

  useEffect(() => {
    if (!profileOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!profileRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  const handleProfileToggle = () => {
    if (!profileOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPopoverPos({ bottom: window.innerHeight - r.top + 6, left: r.left })
    }
    setProfileOpen(v => !v)
  }

  const go = (path: string) => { navigate(path); setProfileOpen(false) }

  return (
    <AppShell
      variant="wash"
      sideNav={
        <SideNav
          collapsible={{
            isCollapsed: collapsed,
            onCollapsedChange: setCollapsed,
            hasButton: false,
          }}
          header={
            collapsed ? (
              /* ── 접힘: 로고만 중앙 정렬, 클릭으로 펼치기 ── */
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 8px 10px' }}>
                <button
                  onClick={() => setCollapsed(false)}
                  title="사이드바 펼치기"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <AppLogo />
                </button>
              </div>
            ) : (
              /* ── 펼침: 로고 + 서비스명 + 접기 버튼 ── */
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 14px 8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AppLogo />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>
                    Byr
                  </span>
                </div>
                <button
                  onClick={() => setCollapsed(true)}
                  title="사이드바 접기"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--color-icon-secondary)',
                  }}
                >
                  <AstryxIcon icon={PanelLeft} size="sm" color="secondary" strokeWidth={1.8} />
                </button>
              </div>
            )
          }
          footer={
            <div ref={profileRef} style={{ position: 'relative' }}>

              {/* ── 팝오버 메뉴 — portal로 렌더링해 sidebar overflow 클리핑 방지 ── */}
              {profileOpen && popoverPos && createPortal(
                <div ref={popoverRef} style={{
                  position: 'fixed',
                  bottom: popoverPos.bottom,
                  left: popoverPos.left,
                  minWidth: 220,
                  background: 'var(--color-background-surface)',
                  border: '1px solid var(--color-border-emphasized)',
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  zIndex: 9999, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px 9px', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{me.email}</div>
                    <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: role === 'admin' ? '#1a1a1a' : 'var(--color-background-muted)', color: role === 'admin' ? '#fff' : 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600 }}>
                      {role === 'admin' ? '관리자' : '팀원'}
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'var(--color-border)' }} />
                  <div style={{ padding: '4px 0' }}>
                    <button style={POPOVER_ITEM} onClick={() => { setRole(role === 'admin' ? 'member' : 'admin'); setProfileOpen(false) }}>
                      {role === 'admin' ? '팀원으로 전환' : '관리자로 전환'}
                    </button>
                  </div>
                  <div style={{ height: 1, background: 'var(--color-border)' }} />
                  <div style={{ padding: '4px 0' }}>
                    <button style={POPOVER_ITEM} onClick={() => go('/settings')}>
                      <AstryxIcon icon={Settings} size="xsm" color="secondary" strokeWidth={2} style={{ flexShrink: 0 }} />
                      설정
                    </button>
                    <button style={POPOVER_ITEM} onClick={() => { window.open('/guide', '_blank'); setProfileOpen(false) }}>
                      <AstryxIcon icon={HelpCircle} size="xsm" color="secondary" strokeWidth={2} style={{ flexShrink: 0 }} />
                      서비스 가이드
                    </button>
                  </div>
                  {role === 'admin' && <>
                    <div style={{ height: 1, background: 'var(--color-border)' }} />
                    <div style={{ padding: '4px 0' }}>
                      <button style={POPOVER_ITEM} onClick={() => go('/billing')}>
                        <AstryxIcon icon={CreditCard} size="xsm" color="secondary" strokeWidth={2} style={{ flexShrink: 0 }} />
                        플랜 · 결제 관리
                      </button>
                    </div>
                  </>}
                  <div style={{ height: 1, background: 'var(--color-border)' }} />
                  <div style={{ padding: '4px 0' }}>
                    <button style={{ ...POPOVER_ITEM, color: '#dc2626' }} onClick={() => { signOut(); go('/login') }}>
                      <AstryxIcon icon={LogOut} size="xsm" color="error" strokeWidth={2} style={{ flexShrink: 0 }} />
                      로그아웃
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {/* ── 프로필 트리거 ── */}
              <div style={{ padding: '4px 8px 8px' }}>
                <button
                  ref={triggerRef}
                  onClick={handleProfileToggle}
                  title={collapsed ? `${me.name} · ${me.email}` : undefined}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 10,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    width: '100%', padding: collapsed ? '8px 6px' : '8px 12px', borderRadius: 8,
                    background: profileOpen ? 'var(--color-background-muted)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: '#374151',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>{me.name.slice(0, 1)}</span>
                  </div>
                  {!collapsed && (
                    <>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1.3 }}>{me.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.3 }}>{me.email}</div>
                      </div>
                      <AstryxIcon icon={MoreHorizontal} size="xsm" color="secondary" style={{ flexShrink: 0 }} />
                    </>
                  )}
                </button>
              </div>
            </div>
          }
        >
          {/* ── 메뉴 영역 ── */}
          <div style={{ padding: '4px 8px' }}>
            <NavItem
              icon={LayoutDashboard}
              label="개요"
              active={isActive('/overview')}
              onClick={() => navigate('/overview')}
            />
            <NavItem
              icon={Bot}
              label="내 에이전트"
              active={isActive('/agents')}
              onClick={() => navigate('/agents')}
            />
            <NavItem
              icon={Users}
              label="팀 에이전트"
              active={isActive('/teams')}
              onClick={() => navigate('/teams')}
            />
            <NavItem
              icon={ShieldCheck}
              label="검토 · 승인"
              active={isActive('/approvals')}
              onClick={() => navigate('/approvals')}
            />
            <NavItem
              icon={BookOpen}
              label="지식"
              active={isActive('/knowledge')}
              onClick={() => navigate('/knowledge')}
            />
            <NavItem
              icon={Store}
              label="마켓플레이스"
              active={isActive('/marketplace')}
              onClick={() => navigate('/marketplace')}
            />
          </div>
        </SideNav>
      }
    >
      <Outlet />
    </AppShell>
  )
}
