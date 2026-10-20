import React from 'react'
import { HStack } from '@astryxdesign/core/Layout'
import { Button } from '@astryxdesign/core/Button'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { X, Check } from 'lucide-react'

// ── 닫기 버튼 ─────────────────────────────────────────────────
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="닫기"
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />
    </button>
  )
}

// ── 스텝 칩 ───────────────────────────────────────────────────
export function StepChip({ label, stepNum, currentStep }: { label: string; stepNum: number; currentStep: number }) {
  const done   = currentStep > stepNum
  const active = currentStep === stepNum
  const future = !done && !active
  const muted  = done || future

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px 5px 5px',
      border: `${active ? 1.5 : 1}px solid ${active ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
      borderRadius: 20,
      background: 'var(--color-background-surface)',
      flexShrink: 0,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--color-text-primary)' : done ? 'var(--color-background-muted)' : 'transparent',
        border: future ? '1.5px solid var(--color-border)' : 'none',
        fontSize: 11, fontWeight: 700,
      }}>
        {done
          ? <AstryxIcon icon={Check} size="xsm" color="secondary" strokeWidth={2.5} />
          : <span style={{ color: active ? 'var(--color-background-surface)' : 'var(--color-text-disabled)' }}>{stepNum}</span>}
      </div>
      <span style={{
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
        fontFamily: 'inherit', lineHeight: 1,
      }}>
        {label}
      </span>
    </div>
  )
}

// ── 모달 CTA 버튼 공통 스타일 ─────────────────────────────────
export const MODAL_BUTTON_STYLE: React.CSSProperties = {
  paddingInline: '22px',
}

// ── 모달 푸터 ─────────────────────────────────────────────────
interface ModalFooterProps {
  leftAction?: React.ReactNode
  children: React.ReactNode
}

export function ModalFooter({ leftAction, children }: ModalFooterProps) {
  return (
    <div style={{
      borderTop: '1px solid var(--color-border)', padding: '14px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
      background: 'var(--color-background-surface)',
      borderRadius: '0 0 20px 20px',
    }}>
      <div>{leftAction ?? null}</div>
      <HStack gap={2}>{children}</HStack>
    </div>
  )
}
