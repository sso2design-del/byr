import React, { createContext, useContext, useState } from 'react'

export type OrgRole = 'admin' | 'member'

interface RoleCtx {
  role: OrgRole
  setRole: (r: OrgRole) => void
}

const RoleContext = createContext<RoleCtx>({ role: 'admin', setRole: () => {} })

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<OrgRole>('admin')
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
