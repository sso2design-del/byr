import {
  Receipt, BarChart2, Calculator, Users, Sparkles, MessageCircle,
  Headphones, Send, Folder, Building2, Database, FileText, Search,
  Globe, Bot, type LucideIcon,
} from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconSize } from '@astryxdesign/core/Icon'

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '🧾': Receipt,
  '📊': BarChart2,
  '🧮': Calculator,
  '👥': Users,
  '✨': Sparkles,
  '💬': MessageCircle,
  '🎧': Headphones,
  '✈️': Send,
  '📂': Folder,
  '📁': Folder,
  '🏛️': Building2,
  '🗄️': Database,
  '📄': FileText,
  '📋': FileText,
  '🔍': Search,
  '🌐': Globe,
  '🤖': Bot,
}

function toAstryxSize(px: number): IconSize {
  if (px <= 12) return 'xsm'
  if (px <= 16) return 'sm'
  if (px <= 20) return 'md'
  return 'lg'
}

interface EmojiIconProps {
  emoji: string
  size?: number
  color?: string
}

export function EmojiIcon({ emoji, size = 20, color }: EmojiIconProps) {
  const LucideIcon = EMOJI_TO_ICON[emoji] ?? Bot
  return (
    <AstryxIcon
      icon={LucideIcon}
      size={toAstryxSize(size)}
      color="inherit"
      strokeWidth={1.5}
      style={color ? { color } : undefined}
    />
  )
}
