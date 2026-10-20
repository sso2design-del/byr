const AUTH_KEY = 'byr-authenticated'
const PROFILE_KEY = 'byr-profile'

/** 소셜 로그인(네이버·카카오)으로 받은 프로필. id 는 공급자 고유 ID — 이메일은 바뀔 수 있어 식별에 쓰지 않는다 */
export type Profile = { provider: 'naver' | 'kakao' | 'google' | 'email'; id: string; name: string; email: string; image?: string }

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AUTH_KEY) === 'true'
}

export function signIn(profile?: Profile): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_KEY, 'true')
  if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function getProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.localStorage.getItem(PROFILE_KEY) || 'null') } catch { return null }
}

export function signOut(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_KEY)
  window.localStorage.removeItem(PROFILE_KEY)
}
