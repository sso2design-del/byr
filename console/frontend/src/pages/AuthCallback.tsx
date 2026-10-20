import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, type Profile } from '../lib/auth'

/**
 * 네이버·카카오 로그인 콜백 착지 페이지.
 * 백엔드(/api/auth/{provider}/callback)가 토큰 교환·프로필 조회를 마치고
 * /auth/callback#provider=…&id=…&name=…&email=… 으로 보낸다(URL 조각이라 서버 로그에 남지 않는다).
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1))
    const provider = p.get('provider')
    const id = p.get('id')
    // 주소창에서 프로필 조각을 바로 지운다
    window.history.replaceState(null, '', window.location.pathname)
    if ((provider === 'naver' || provider === 'kakao') && id) {
      const profile: Profile = { provider, id, name: p.get('name') || '', email: p.get('email') || '', image: p.get('image') || '' }
      signIn(profile)
      navigate('/overview', { replace: true })
    } else {
      navigate('/login?oauth_error=profile', { replace: true })
    }
  }, [navigate])
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontSize: 14, color: 'var(--color-text-secondary)' }}>
      로그인하는 중…
    </div>
  )
}
