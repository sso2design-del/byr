import React from 'react'
import {
  Bot, Receipt, BarChart2, Calculator, FileText, Search,
  ClipboardList, Zap, Bell, CreditCard, Building2,
  Users, Sparkles, MessageSquare, Globe, TrendingUp, Wrench,
  Folder, File, Calendar, GitPullRequest, AlertCircle,
  Mic, Mail, Lightbulb, Timer,
} from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconSize, IconType } from '@astryxdesign/core/Icon'

const EMOJI_MAP: Record<string, IconType> = {
  '🧾': Receipt,
  '📊': BarChart2,
  '🧮': Calculator,
  '📝': FileText,
  '🔍': Search,
  '📋': ClipboardList,
  '⚡': Zap,
  '🔔': Bell,
  '💰': CreditCard,
  '🏢': Building2,
  '👥': Users,
  '✨': Sparkles,
  '💬': MessageSquare,
  '🌐': Globe,
  '📈': TrendingUp,
  '🔧': Wrench,
  '📂': Folder,
  '📄': File,
  '🗂️': Calendar,
  '🔗': GitPullRequest,
  '⚠️': AlertCircle,
  '🎙️': Mic,
  '✉️': Mail,
  '📅': Calendar,
  '💡': Lightbulb,
  '🏃': Timer,
}

// 에이전트 카드용 배경색 — Astryx 시스템 컬러 계열
const EMOJI_BG: Record<string, string> = {
  '🧾': '#1e40af',  // blue-800
  '📊': '#0369a1',  // sky-700
  '🧮': '#7c3aed',  // violet-600
  '📝': '#0f766e',  // teal-700
  '🔍': '#6d28d9',  // violet-700
  '📋': '#1d4ed8',  // blue-700
  '⚡': '#b45309',  // amber-700
  '🔔': '#9333ea',  // purple-600
  '💰': '#15803d',  // green-700
  '🏢': '#374151',  // gray-700
  '👥': '#0d9488',  // teal-600
  '✨': '#6b7280',  // gray-500
  '💬': '#059669',  // emerald-600
  '🌐': '#0284c7',  // sky-600
  '📈': '#16a34a',  // green-600
  '🔧': '#dc2626',  // red-600
  '📄': '#2563eb',  // blue-600
  '🗂️': '#7e22ce', // purple-800
  '🔗': '#4f46e5',  // indigo-600
  '⚠️': '#ea580c', // orange-600
  '🎙️': '#0369a1', // sky-700
  '✉️': '#0d9488', // teal-600
  '📅': '#7c3aed', // violet-600
  '💡': '#b45309', // amber-700
  '🏃': '#16a34a', // green-600
}

const FALLBACK_BG = '#374151'

function toAstryxSize(px: number): IconSize {
  if (px <= 12) return 'xsm'
  if (px <= 16) return 'sm'
  if (px <= 20) return 'md'
  return 'lg'
}

export function AgentIconBadge({
  emoji,
  boxSize = 46,
  iconSize = 20,
  radius = 14,
  colored = false,
  mono = false,
  monoLevel = 'primary',
  glyphScale = 1,
  bare = false,
}: {
  emoji: string
  boxSize?: number
  iconSize?: number
  radius?: number | string
  colored?: boolean
  // mono: 컬러 제거(그레이스케일) + 밝은 아이콘(인버스 토큰).
  mono?: boolean
  // monoLevel: 하이어라키 — primary=진한 다크(헤더/상위), secondary=중간 회색(단계 세부/하위).
  monoLevel?: 'primary' | 'secondary'
  // glyphScale: Astryx Icon 최대 크기(lg=24px)를 넘겨 글리프만 확대(상세 히어로 전용). 기본 1.
  glyphScale?: number
  // bare: 사각형 박스 없이 아이콘 글리프만(블랙).
  bare?: boolean
}) {
  const LucideIcon = EMOJI_MAP[emoji] ?? Bot
  if (bare) {
    return (
      <span style={{ display: 'inline-flex', color: 'var(--color-text-primary)', flexShrink: 0 }}>
        <AstryxIcon icon={LucideIcon} size={toAstryxSize(iconSize)} color="inherit" strokeWidth={1.8} />
      </span>
    )
  }
  // mono 레벨: primary=다크 그레이 배경+밝은 아이콘(헤더/상위) / secondary=흰 배경+블랙 아이콘+옅은 테두리(단계 세부/하위)
  const isSubtle = mono && monoLevel === 'secondary'
  const bg = mono
    ? (isSubtle ? 'var(--color-background-surface)' : '#3f3f46')  // near-black보다 한 톤 밝은 다크 그레이
    : colored ? (EMOJI_BG[emoji] ?? FALLBACK_BG) : FALLBACK_BG
  const iconColor = mono
    ? (isSubtle ? 'var(--color-text-primary)' : '#fafafa')
    : '#ffffff'
  const icon = (
    <AstryxIcon
      icon={LucideIcon}
      size={toAstryxSize(iconSize)}
      color="inherit"
      strokeWidth={1.8}
    />
  )
  return (
    <div style={{
      width: boxSize, height: boxSize, borderRadius: radius,
      background: bg,
      border: isSubtle ? '1px solid var(--color-border)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: iconColor,
    }}>
      {glyphScale !== 1
        ? <div style={{ display: 'flex', transform: `scale(${glyphScale})` }}>{icon}</div>
        : icon}
    </div>
  )
}
