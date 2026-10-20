import React from 'react'
import { Search, X } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'

export function SearchBar({
  value, onChange, placeholder = '검색...', onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onSubmit?: () => void
}) {
  return (
    <div className="m-search" style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 16px', height: 40, borderRadius: 'var(--radius-full)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-background-surface)',
    }}>
      <AstryxIcon icon={Search} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onSubmit) onSubmit() }}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent',
          fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <AstryxIcon icon={X} size="sm" color="secondary" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
