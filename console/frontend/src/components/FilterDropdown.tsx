import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'

export function FilterDropdown<T extends string>({
  label, options, value, onChange, minDropdownWidth = 160,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  minDropdownWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasSelection = value !== options[0]

  const handleToggle = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left, minWidth: Math.max(rect.width, minDropdownWidth) })
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !wrapperRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={wrapperRef} style={{ flexShrink: 0 }}>
      <button
        onClick={handleToggle}
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
        {hasSelection ? value : label}
        <AstryxIcon
          icon={ChevronDown} size="sm" color="secondary" strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.minWidth,
            zIndex: 9999,
            background: 'var(--color-background-surface)',
            border: '1px solid var(--color-border-emphasized)',
            borderRadius: 'var(--radius-element)',
            boxShadow: 'var(--shadow-med)',
            overflow: 'hidden', padding: '4px 0',
          }}
        >
          {options.map(opt => {
            const selected = value === opt
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '9px 14px',
                  background: selected ? 'var(--color-background-muted)' : 'none',
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                {opt}
                {selected && <AstryxIcon icon={Check} size="sm" color="primary" strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
