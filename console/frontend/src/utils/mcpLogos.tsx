import React from 'react'

function GmailLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6.5v11c0 .6.4 1 1 1h2.2V11l5.8 4.3L17.8 11v7.5H20c.6 0 1-.4 1-1v-11L12 13 3 6.5z" fill="#EA4335"/>
      <path d="M3 6.5 12 13l9-6.5V6c0-.6-.4-1-1-1h-.6L12 10.4 4.6 5H4c-.6 0-1 .4-1 1v.5z" fill="#FBBC04"/>
      <path d="M6.2 18.5V11L3 8.6V17.5c0 .6.4 1 1 1h2.2z" fill="#34A853"/>
      <path d="M17.8 18.5V11l3.2-2.4V17.5c0 .6-.4 1-1 1h-2.2z" fill="#4285F4"/>
    </svg>
  )
}

// 일반 이메일(멀티 provider) — 브랜드 중립 봉투
function EmailLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="5" width="19" height="14" rx="2.4" fill="#5B6472"/>
      <path d="M3.4 6.6 12 12.6l8.6-6" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function GoogleDriveLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3L7.2 11.5h9.6L12 3z" fill="#FBBC04"/>
      <path d="M2.5 20.5h9.5L7.2 11.5L2.5 20.5z" fill="#4285F4"/>
      <path d="M21.5 20.5h-9.5l4.8-9L21.5 20.5z" fill="#34A853"/>
      <path d="M2.5 20.5h19l-1 1.5H3.5L2.5 20.5z" fill="#FBBC04" opacity="0.6"/>
    </svg>
  )
}

function GoogleSheetsLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2" fill="#23A566"/>
      <rect x="6" y="6" width="12" height="1.5" rx="0.4" fill="white" opacity="0.85"/>
      <rect x="6" y="9.2" width="12" height="1.5" rx="0.4" fill="white" opacity="0.85"/>
      <rect x="6" y="12.4" width="12" height="1.5" rx="0.4" fill="white" opacity="0.85"/>
      <rect x="6" y="15.6" width="8" height="1.5" rx="0.4" fill="white" opacity="0.85"/>
      <rect x="6" y="6" width="1.5" height="11" rx="0.4" fill="white" opacity="0.5"/>
      <rect x="11.2" y="6" width="1.5" height="11" rx="0.4" fill="white" opacity="0.5"/>
    </svg>
  )
}

function NTSLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#003C8F"/>
      <rect x="5" y="7" width="14" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
      <rect x="5" y="10.8" width="14" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
      <rect x="5" y="14.6" width="9" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
    </svg>
  )
}

function ERPLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="5" rx="1.5" fill="#1e3a5f"/>
      <rect x="2" y="9.5" width="20" height="5" rx="1.5" fill="#2a5298"/>
      <rect x="2" y="16" width="20" height="5" rx="1.5" fill="#3b6fd4"/>
      <circle cx="18.5" cy="5.5" r="1.2" fill="#7dd3fc"/>
      <circle cx="18.5" cy="12" r="1.2" fill="#7dd3fc"/>
      <circle cx="18.5" cy="18.5" r="1.2" fill="#7dd3fc"/>
    </svg>
  )
}

function JiraLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="jira-a" x1="12" y1="11.14" x2="17.29" y2="6.02" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052CC"/>
          <stop offset="100%" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jira-b" x1="12" y1="12.83" x2="6.72" y2="17.95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052CC"/>
          <stop offset="100%" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
      <path d="M11.53 2.1L2.1 11.53a.66.66 0 000 .94l4.63 4.63 4.8-4.8 2.38-2.37L11.53 2.1z" fill="url(#jira-a)"/>
      <path d="M12.47 21.9l9.43-9.43a.66.66 0 000-.94l-4.63-4.63-4.8 4.8-2.38 2.37 2.38 7.83z" fill="url(#jira-b)"/>
      <circle cx="12" cy="12" r="2.7" fill="#2684FF"/>
    </svg>
  )
}

export const MCP_LOGOS: Record<string, React.FC<{ size?: number }>> = {
  gdrive:  GoogleDriveLogo,
  gmail:   GmailLogo,
  email:   EmailLogo,
  hometax: NTSLogo,
  erp:     ERPLogo,
  sheets:  GoogleSheetsLogo,
  jira:    JiraLogo,
}

export function McpLogoIcon({ mcpKey, size = 36, bare = false }: { mcpKey: string; size?: number; bare?: boolean }) {
  const Logo = MCP_LOGOS[mcpKey]
  if (bare) {
    return Logo ? <Logo size={size} /> : <span style={{ fontSize: size * 0.9 }}>📦</span>
  }
  const logoSize = Math.round(size * 0.54)
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: '#fff',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {Logo ? <Logo size={logoSize} /> : <span style={{ fontSize: logoSize * 0.9 }}>📦</span>}
    </div>
  )
}
