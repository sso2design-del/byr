import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useSpring, useTransform, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { VStack } from '@astryxdesign/core/Layout'
import { Center } from '@astryxdesign/core/Center'
import { Text, Heading } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@astryxdesign/core/Link'
import { Divider } from '@astryxdesign/core/Divider'
import { Banner } from '@astryxdesign/core/Banner'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import { Hourglass } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import type { IconType } from '@astryxdesign/core/Icon'
import { LayoutDashboard, Bot, Store, Receipt, Calculator, BarChart2, FileText, Bell,
  ShieldCheck, TrendingUp, Scale, Users, Terminal, ClipboardList, Check,
  Sparkles, Cpu, HardDrive, MessageSquare, BookOpen, Calendar } from 'lucide-react'
import { PlatformLogo } from '../utils/platformLogos'
import { McpLogoIcon } from '../utils/mcpLogos'
import { signIn } from '../lib/auth'

// 포트폴리오 데모 계정 — '데모 계정으로 둘러보기'로만 쓴다(입력 칸에 미리 채우지 않음)
const DEMO_EMAIL = 'soyi.hwang@company.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOT_APPROVED_MSG = '관리자가 승인한 계정이 아닙니다. 승인된 계정으로 로그인하거나 데모 계정으로 둘러보세요.'

// ── 소셜 아이콘 SVG ──────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect width="18" height="18" rx="3" fill="#03C75A"/>
      <path d="M10.18 9.27 7.52 5H5v8h2.82V8.73L10.48 13H13V5h-2.82v4.27z" fill="white"/>
    </svg>
  )
}

/* 버튼 가이드용 심볼 — 네이버: 녹색 바탕 위 흰 N 로고(16px 이상) / 카카오: 노란 바탕 위 검정 말풍선 */
/* 버튼 심볼 — 공식 에셋(captures/NaverBrand_Logotype_svg, captures/Kakao Login)에서 가져왔다 */
function NaverN() {
  // 네이버 공식 로고타입(Logotype_*.svg)의 N 글자 — 버튼 가이드: 흰색, 16px 이상
  return (
    <svg width="16" height="16" viewBox="0 0 443.69 443.69" aria-hidden="true">
      <polygon fill="#fff" points="303.19 0 303.19 237.47 141.4 0 0 0 0 443.69 140.5 443.69 140.5 206.22 302.29 443.69 443.69 443.69 443.69 359.23 443.69 0 303.19 0"/>
    </svg>
  )
}

const OAUTH_ERRORS: Record<string, string> = {
  cancelled: '로그인을 취소했습니다.',
  state_mismatch: '로그인 요청을 확인하지 못했습니다. 다시 시도해 주세요.',
  token: '로그인 정보를 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
  profile: '프로필 정보를 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
  not_configured: '아직 이 로그인 방식이 연결되지 않았습니다.',
  not_approved: NOT_APPROVED_MSG,
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect width="18" height="18" rx="3" fill="#FEE500"/>
      <path d="M9 3.5C5.96 3.5 3.5 5.47 3.5 7.9c0 1.49.93 2.8 2.34 3.6l-.6 2.2c-.05.2.17.35.33.23L8.1 12.5c.29.04.59.06.9.06 3.04 0 5.5-1.97 5.5-4.4C14.5 5.47 12.04 3.5 9 3.5z" fill="#391B1B"/>
    </svg>
  )
}

// ── Google OAuth 동의 화면 ────────────────────────────────────

/* 휴대폰 폭(≤760px)인지 — 구글 로그인은 모바일에서 카드 없이 전체 화면 한 열로 바뀐다 */
function useIsMobile(query = '(max-width: 760px)') {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

function GoogleG({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

/* 모바일 구글 로그인 — accounts.google.com 휴대폰 화면 구성:
   상단 G 로고 줄 → 앱 로고·「OO에 로그인」 → 계정 칩 → 공유 정보 → 안내 문단 → 오른쪽 아래 취소(텍스트)·계속(채움) → 언어·도움말 */
function GoogleOAuthMobile({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const link = { color: '#0b57d0', cursor: 'pointer', fontWeight: 500 } as const
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: '#fff', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif", color: '#1f1f1f',
    }}>
      {/* 상단 줄 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid #e1e3e1' }}>
        <GoogleG size={20} />
        <span style={{ fontSize: 14, color: '#1f1f1f' }}>Google 계정으로 로그인</span>
      </div>

      <div style={{ flex: 1, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        <BrandMark size={40} radius={22} />
        <h1 style={{ margin: '20px 0 0', fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: 0 }}>Byr에 로그인</h1>

        {/* 계정 칩 */}
        <button style={{
          alignSelf: 'flex-start', marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 4px 4px', borderRadius: 999, border: '1px solid #747775', background: '#fff',
          fontFamily: 'inherit', maxWidth: '100%', cursor: 'pointer',
        }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#374151', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>G</span>
          <span style={{ fontSize: 14, color: '#1f1f1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>guest.visitor@gmail.com</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6" stroke="#444746" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        {/* 공유 정보 */}
        <p style={{ margin: '32px 0 8px', fontSize: 16, lineHeight: '24px' }}>Google이 Byr에 다음 정보를 공유합니다</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid #e1e3e1' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="#444746" strokeWidth="1.5"/>
            <path d="M2 8l10 6 10-6" stroke="#444746" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis' }}>guest.visitor@gmail.com</div>
            <div style={{ fontSize: 12, lineHeight: '16px', color: '#444746' }}>이메일 주소</div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14, lineHeight: '20px', color: '#1f1f1f' }}>
          <p style={{ margin: 0 }}>
            Byr의 <span style={link}>개인정보처리방침</span> 및 <span style={link}>서비스 약관</span>을 검토하여 Byr가 귀하의 데이터를 처리·보호하는 방법을 확인하세요.
          </p>
          <p style={{ margin: 0 }}>언제든지 <span style={link}>Google 계정</span>에서 설정을 변경할 수 있습니다.</p>
          <p style={{ margin: 0 }}><span style={link}>Google로 로그인</span>에 대해 자세히 알아보기</p>
        </div>

        {/* 버튼 — 오른쪽 아래 */}
        <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ height: 40, padding: '0 16px', borderRadius: 20, border: 'none', background: 'transparent', color: '#0b57d0', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>취소</button>
          <button onClick={onContinue} style={{ height: 40, padding: '0 24px', borderRadius: 20, border: 'none', background: '#0b57d0', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>계속</button>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '12px 16px 20px', fontSize: 12, color: '#444746' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          한국어
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#444746" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
        <span style={{ display: 'inline-flex', gap: 16 }}>
          {['도움말', '개인정보처리방침', '약관'].map(t => <span key={t}>{t}</span>)}
        </span>
      </div>
    </div>
  )
}

function GoogleOAuthScreen({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const isMobile = useIsMobile()
  if (isMobile) return <GoogleOAuthMobile onContinue={onContinue} onCancel={onCancel} />
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: '#f1f3f4',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
    }}>
      {/* 카드 */}
      <div style={{
        background: '#fff', borderRadius: 28,
        boxShadow: '0 2px 10px rgba(0,0,0,0.12), 0 8px 40px rgba(0,0,0,0.08)',
        width: '100%', maxWidth: 800, overflow: 'hidden',
      }}>
        {/* 카드 헤더 */}
        <div style={{ padding: '22px 30px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e8eaed' }}>
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span style={{ fontSize: 16, color: '#202124', fontWeight: 400 }}>Google 계정으로 로그인</span>
        </div>

        {/* 바디 2열 */}
        <div style={{ display: 'flex', minHeight: 320 }}>
          <div style={{ flex: '0 0 45%', padding: '36px 40px 28px', borderRight: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <div style={{ marginBottom: 22 }}><BrandMark size={48} radius={22} /></div>
            <div style={{ fontSize: 26, fontWeight: 400, color: '#202124', marginBottom: 24, lineHeight: 1.3 }}>Byr에 로그인</div>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px', borderRadius: 999, border: '1px solid #dadce0', background: '#fff', cursor: 'pointer', maxWidth: '100%' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>G</span>
              </div>
              <span style={{ fontSize: 14, color: '#202124' }}>guest.visitor@gmail.com</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 2 }}>
                <path d="M6 9l6 6 6-6" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, padding: '36px 40px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 400, color: '#202124', marginBottom: 20, lineHeight: 1.4 }}>Google이 Byr에 다음 정보를 공유합니다</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: '1px solid #e8eaed' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="#5f6368" strokeWidth="1.5"/>
                  <path d="M2 8l10 6 10-6" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontSize: 15, color: '#202124', marginBottom: 2 }}>guest.visitor@gmail.com</div>
                  <div style={{ fontSize: 13, color: '#5f6368' }}>이메일 주소</div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#202124', lineHeight: 1.6 }}>
                  Byr의 <span style={{ color: '#1a73e8', cursor: 'pointer' }}>개인정보처리방침</span> 및 <span style={{ color: '#1a73e8', cursor: 'pointer' }}>서비스 약관</span>을 검토하여 Byr가 귀하의 데이터를 처리·보호하는 방법을 확인하세요.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#202124', lineHeight: 1.6 }}>
                  언제든지 <span style={{ color: '#1a73e8', cursor: 'pointer' }}>Google 계정</span>에서 설정을 변경할 수 있습니다.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#202124', lineHeight: 1.6 }}>
                  <span style={{ color: '#1a73e8', cursor: 'pointer' }}>Google로 로그인</span>에 대해 자세히 알아보기
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: '1px solid #dadce0', background: '#fff', fontSize: 15, color: '#1a73e8', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={onContinue} style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: '1px solid #dadce0', background: '#fff', fontSize: 15, color: '#1a73e8', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>계속</button>
            </div>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 800, marginTop: 16, padding: '0 4px' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#5f6368', fontFamily: 'inherit', padding: '4px 8px' }}>
          한국어 (대한민국)
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ display: 'flex', gap: 20 }}>
          {['도움말', '개인정보처리방침', '약관'].map(t => (
            <span key={t} style={{ fontSize: 13, color: '#5f6368', cursor: 'pointer' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 네이버·카카오 연동 로그인 — 실제 화면 구성을 따른다 ──────────────
// 네이버(nid.naver.com): NAVER 로고 → 로그인 방식 탭 → 아이디·비밀번호 묶음 → 로그인 상태 유지 → 초록 버튼 → 찾기·가입 링크
//   → 동의 화면: 앱 정보 → 전체 동의 → 필수·선택 제공 항목 → 취소/동의하기
// 카카오(accounts.kakao.com): kakao 로고 → 입력 2개 → 간편로그인 정보 저장 → 노란 버튼 → 또는 → QR코드 로그인 → 링크
//   → 동의 화면(kauth.kakao.com): 앱 이름 → 전체 동의하기 → [필수]/[선택] 항목 → 동의하고 계속하기
// 둘 다 흰 바탕 가운데 한 열이라 휴대폰과 데스크톱에서 같은 구조로 보인다.

const KR_FONT = "'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

function NaverWordmark({ height = 30 }: { height?: number }) {
  // 네이버 공식 로고타입(2315:444) — captures/NaverBrand_Logotype_svg/Logotype_Green.svg
  return <img src="/brand/naver-logotype-green.svg" alt="NAVER" style={{ height, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }} />
}

function CheckBox({ on, color, size = 22 }: { on: boolean; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: on ? color : '#fff', border: on ? 'none' : '1px solid #c6c6c6', transition: 'background .15s',
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={on ? '#fff' : '#c6c6c6'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
    </span>
  )
}

const pageShell = (bg = '#fff'): React.CSSProperties => ({
  position: 'fixed', inset: 0, zIndex: 500, background: bg, overflowY: 'auto',
  display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: KR_FONT, color: '#222',
})

function NaverOAuthScreen({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState<'login' | 'consent'>('login')
  const [tab, setTab] = useState(0)
  const [naverId, setNaverId] = useState('')
  const [naverPw, setNaverPw] = useState('')
  const [keep, setKeep] = useState(false)
  const [agree, setAgree] = useState<Record<string, boolean>>({ name: false, email: false, photo: false })
  const allOn = Object.values(agree).every(Boolean)
  const reqOn = agree.name && agree.email
  const G = '#03C75A'

  if (step === 'login') {
    const rowIcon = (d: string) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d}/></svg>
    )
    const input = { flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', color: '#222', background: 'transparent' } as const
    return (
      <div style={pageShell()}>
        <div style={{ width: '100%', maxWidth: 460, padding: '56px 20px 32px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}><NaverWordmark height={30} /></div>

          <div style={{ border: '1px solid #c6c6c6', borderRadius: 6, overflow: 'hidden', boxShadow: '0 5px 8px rgba(68,68,68,.04)' }}>
            {/* 로그인 방식 탭 */}
            <div style={{ display: 'flex' }}>
              {['ID 로그인', '일회용 번호', 'QR코드'].map((t, i) => (
                <button key={t} onClick={() => setTab(i)} style={{
                  flex: 1, height: 52, border: 'none', fontFamily: 'inherit', cursor: 'pointer', fontSize: 15,
                  fontWeight: tab === i ? 700 : 400, color: tab === i ? '#222' : '#777',
                  background: tab === i ? '#fff' : '#f8f9fa',
                  borderBottom: tab === i ? 'none' : '1px solid #e3e5e8',
                  borderLeft: i > 0 ? '1px solid #e3e5e8' : 'none',
                }}>{t}</button>
              ))}
            </div>

            <div style={{ padding: '20px 20px 26px' }}>
              {/* 아이디·비밀번호 묶음 */}
              <div style={{ border: '1px solid #dadada', borderRadius: 6, overflow: 'hidden' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderBottom: '1px solid #dadada' }}>
                  {rowIcon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0')}
                  <input value={naverId} onChange={e => setNaverId(e.target.value)} placeholder="아이디 또는 전화번호" style={input} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px' }}>
                  {rowIcon('M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4')}
                  <input value={naverPw} onChange={e => setNaverPw(e.target.value)} type="password" placeholder="비밀번호" style={input} />
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 22px' }}>
                <button onClick={() => setKeep(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#777' }}>
                  <CheckBox on={keep} color={G} size={20} /> 로그인 상태 유지
                </button>
                <span style={{ fontSize: 13, color: '#777' }}>IP보안 <b style={{ color: G }}>ON</b></span>
              </div>

              <button onClick={() => setStep('consent')} disabled={!naverId.trim() || !naverPw} style={{
                width: '100%', height: 52, borderRadius: 6, border: 'none', background: G,
                fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
                cursor: naverId.trim() && naverPw ? 'pointer' : 'not-allowed', opacity: naverId.trim() && naverPw ? 1 : 0.4,
              }}>로그인</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            {['비밀번호 찾기', '아이디 찾기', '회원가입'].map((t, i) => (
              <span key={t} style={{ fontSize: 14, color: '#777', padding: '0 12px', borderLeft: i ? '1px solid #dadada' : 'none', cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 13, color: '#8e8e8e', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Byr로 돌아가기</button>
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: '24px 0 28px', fontSize: 12, color: '#8e8e8e', textAlign: 'center' }}>
          이용약관 · <b style={{ color: '#555' }}>개인정보처리방침</b> · 책임의 한계와 법적고지 · 회원정보 고객센터
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><img src="/brand/naver-logotype-green.svg" alt="NAVER" style={{ height: 9, width: 'auto' }} />Copyright © NAVER Corp. All Rights Reserved.</div>
        </div>
      </div>
    )
  }

  const item = (key: string, label: string) => (
    <button key={key} onClick={() => setAgree(a => ({ ...a, [key]: !a[key] }))} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 0', background: 'none', border: 'none',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, color: '#222', textAlign: 'left',
    }}>
      <CheckBox on={agree[key]} color={G} /> {label}
    </button>
  )
  return (
    <div style={pageShell()}>
      <div style={{ width: '100%', maxWidth: 460, padding: isMobile ? '28px 20px 24px' : '56px 20px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '100%' : undefined }}>
        <NaverWordmark height={22} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32 }}>
          <BrandMark size={48} radius={22} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Byr</div>
            <div style={{ fontSize: 13, color: '#777', marginTop: 2 }}>byr-console.vercel.app</div>
          </div>
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 15, lineHeight: 1.6 }}>
          <b>Byr</b>에서 <b>네이버 아이디로 로그인</b>을 요청합니다. 아래 정보 제공에 동의해 주세요.
        </p>

        <button onClick={() => { const v = !allOn; setAgree({ name: v, email: v, photo: v }) }} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24, padding: '16px', borderRadius: 8,
          border: `1px solid ${allOn ? G : '#dadada'}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <CheckBox on={allOn} color={G} />
          <span>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#222' }}>전체 동의하기</span>
            <span style={{ display: 'block', fontSize: 13, color: '#8e8e8e', marginTop: 4, lineHeight: 1.5 }}>선택 항목에 대한 동의를 포함합니다. 선택 항목은 동의하지 않아도 서비스를 이용할 수 있습니다.</span>
          </span>
        </button>

        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700 }}>필수 제공 항목</div>
        {item('name', '이름')}
        {item('email', '이메일 주소')}
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>선택 제공 항목</div>
        {item('photo', '프로필 사진')}

        <p style={{ margin: '16px 0 0', fontSize: 12, color: '#8e8e8e', lineHeight: 1.6 }}>
          제공된 정보는 이용자 식별, 계정 연동 및 고객 응대를 위해 서비스 이용 기간 동안 활용·보관됩니다. 필수 제공 항목은 Byr 서비스를 이용하기 위해 반드시 필요합니다.
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 28 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 52, borderRadius: 6, border: 'none', background: '#f1f2f4', fontSize: 16, fontWeight: 700, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={reqOn ? onContinue : undefined} disabled={!reqOn} style={{
            flex: 2, height: 52, borderRadius: 6, border: 'none', background: reqOn ? G : '#b5e8cb',
            fontSize: 16, fontWeight: 700, color: '#fff', cursor: reqOn ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>동의하기</button>
        </div>
      </div>
    </div>
  )
}

function KakaoWordmark({ size = 30 }: { size?: number }) {
  // 카카오 공식 로고(418:128) — captures/Kakao Login/kaka0_logo.svg
  return <img src="/brand/kakao-logo.svg" alt="kakao" style={{ height: Math.round(size * 0.9), width: 'auto', display: 'inline-block', verticalAlign: 'middle' }} />
}

function KakaoOAuthScreen({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState<'login' | 'consent'>('login')
  const [kId, setKId] = useState('')
  const [kPw, setKPw] = useState('')
  const [save, setSave] = useState(false)
  const [agree, setAgree] = useState<Record<string, boolean>>({ email: false, nick: false, photo: false })
  const allOn = Object.values(agree).every(Boolean)
  const reqOn = agree.email && agree.nick
  const Y = '#FEE500'

  if (step === 'login') {
    const field = { width: '100%', height: 50, padding: '0 2px', boxSizing: 'border-box', border: 'none', borderBottom: '2px solid #e5e5e5', outline: 'none', fontSize: 16, fontFamily: 'inherit', color: '#191919', background: 'transparent', display: 'block' } as const
    return (
      <div style={pageShell()}>
        <div style={{ width: '100%', maxWidth: 400, padding: '64px 24px 32px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}><KakaoWordmark size={34} /></div>
          <input value={kId} onChange={e => setKId(e.target.value)} placeholder="카카오메일 아이디, 이메일, 전화번호" style={field} />
          <input value={kPw} onChange={e => setKPw(e.target.value)} type="password" placeholder="비밀번호" style={{ ...field, marginTop: 8 }} />
          <button onClick={() => setSave(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 26px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#555' }}>
            <CheckBox on={save} color="#191919" size={20} /> 간편로그인 정보 저장
          </button>
          <button onClick={() => setStep('consent')} disabled={!kId.trim() || !kPw} style={{ width: '100%', height: 50, borderRadius: 6, border: 'none', background: Y, fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,.85)', fontFamily: 'inherit', cursor: kId.trim() && kPw ? 'pointer' : 'not-allowed', opacity: kId.trim() && kPw ? 1 : 0.4 }}>로그인</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', fontSize: 13, color: '#999' }}>
            <span style={{ flex: 1, height: 1, background: '#e5e5e5' }} />또는<span style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          </div>
          <button style={{ width: '100%', height: 50, borderRadius: 6, border: 'none', background: '#f2f2f2', fontSize: 16, fontWeight: 600, color: '#191919', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></svg>
            QR코드 로그인
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
            {['회원가입', '계정 찾기', '비밀번호 재설정'].map((t, i) => (
              <span key={t} style={{ fontSize: 13, color: '#555', padding: '0 10px', borderLeft: i ? '1px solid #e5e5e5' : 'none', cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 13, color: '#999', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Byr로 돌아가기</button>
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: '24px 0 28px', fontSize: 12, color: '#999', textAlign: 'center' }}>
          이용약관 · <b style={{ color: '#555' }}>개인정보 처리방침</b> · 운영정책 · 고객센터
          <div style={{ marginTop: 8 }}>© Kakao Corp.</div>
        </div>
      </div>
    )
  }

  const item = (key: string, req: boolean, label: string) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
      <button onClick={() => setAgree(a => ({ ...a, [key]: !a[key] }))} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, color: '#191919', textAlign: 'left' }}>
        <CheckBox on={agree[key]} color={Y} />
        <span><span style={{ color: req ? '#191919' : '#999' }}>[{req ? '필수' : '선택'}]</span> {label}</span>
      </button>
      <span style={{ fontSize: 13, color: '#999', textDecoration: 'underline', cursor: 'pointer', flexShrink: 0 }}>보기</span>
    </div>
  )
  return (
    <div style={pageShell()}>
      <div style={{ width: '100%', maxWidth: 400, padding: isMobile ? '24px' : '56px 24px 40px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '100%' : undefined }}>
        <KakaoWordmark size={22} />
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <div style={{ display: 'inline-block' }}><BrandMark size={64} radius={22} /></div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>Byr</div>
          <div style={{ fontSize: 14, color: '#777', marginTop: 6 }}>서비스 이용을 위해 아래 정보 제공에 동의해 주세요.</div>
        </div>

        <button onClick={() => { const v = !allOn; setAgree({ email: v, nick: v, photo: v }) }} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 32, padding: '16px 0', background: 'none',
          border: 'none', borderBottom: '1px solid #e5e5e5', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <CheckBox on={allOn} color={Y} />
          <span>
            <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: '#191919' }}>전체 동의하기</span>
            <span style={{ display: 'block', fontSize: 13, color: '#999', marginTop: 4, lineHeight: 1.5 }}>전체동의는 선택목적에 대한 동의를 포함하고 있으며, 선택목적에 대한 동의를 거부해도 서비스 이용이 가능합니다.</span>
          </span>
        </button>
        <div style={{ paddingTop: 6 }}>
          {item('email', true, '카카오계정(이메일)')}
          {item('nick', true, '닉네임')}
          {item('photo', false, '프로필 사진')}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 28 }}>
          <button onClick={reqOn ? onContinue : undefined} disabled={!reqOn} style={{
            width: '100%', height: 50, borderRadius: 6, border: 'none', background: reqOn ? Y : '#f2f2f2',
            fontSize: 16, fontWeight: 600, color: reqOn ? 'rgba(0,0,0,.85)' : '#b2b2b2', cursor: reqOn ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>동의하고 계속하기</button>
          <button onClick={onCancel} style={{ width: '100%', height: 44, marginTop: 8, border: 'none', background: 'none', fontSize: 14, color: '#777', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 온보딩 회원가입 (이메일 → 인증 → 직무 선택) ─────────────

const ONBOARDING_JOBS = [
  { key: 'vat_reconcile',       label: '재무·회계',     desc: '부가세 대사·월마감·전표 처리' },
  { key: 'insurance_fp',        label: '보험 FP',       desc: '제안서 자동화·보장 갭 분석·약관 Q&A' },
  { key: 'securities_research', label: '증권 리서치',   desc: '투자리포트 초안·DART 공시 분석' },
  { key: 'compliance_aml',      label: '준법·내부감사', desc: 'STR 초안·이상거래 조사' },
  { key: 'hr',                  label: '인사·총무',     desc: '근태 요약·채용 공고·급여 명세' },
  { key: 'pm_brief',            label: '기획/PM',       desc: '회의록 정리·기획서·경쟁사 리서치' },
  { key: 'dev_incident',        label: '개발·운영',     desc: '로그 분석·배포 현황·PR 리뷰 요약' },
]

function SignupScreen({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'verify' | 'job' | 'pending'>('email')
  const [email, setEmail] = useState('')
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])
  const codeComplete = codeDigits.every(d => d !== '')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [resendAlert, setResendAlert] = useState(false)
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 18px', boxSizing: 'border-box',
    border: '1.5px solid var(--color-border-emphasized)', borderRadius: 999, fontSize: 14,
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)', display: 'block',
    background: 'var(--color-background-surface)',
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }
  const reqMark = <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>
  const optMark = <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 3 }}>(선택)</span>

  // 가입을 마쳐도 관리자가 승인하기 전에는 들어가지 않는다 → 승인 대기 안내
  const goToAgents = (_role: string) => {
    setStep('pending')
  }
  const enterDemo = () => {
    signIn({ provider: 'email', id: 'demo-soyi', name: '황소이 선임', email: DEMO_EMAIL })
    navigate('/overview')
  }

  // ── 5단계: 관리자 승인 대기 ──
  if (step === 'pending') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '52px 24px', overflowY: 'auto',
      }}>
        <div role="status" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-background-yellow, #fef3c7)', display: 'grid', placeItems: 'center' }}>
            <AstryxIcon icon={Hourglass} size="md" color="primary" />
          </div>
          <Heading level={2}>관리자 승인을 기다리고 있어요</Heading>
          <Text type="body" color="secondary">
            <b style={{ color: 'var(--color-text-primary)' }}>{email.trim()}</b> 계정의 가입 신청이 접수됐습니다.
            관리자가 승인하면 이 계정으로 로그인할 수 있어요. 그 전에는 데모 계정으로 둘러볼 수 있습니다.
          </Text>
          <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
            <button onClick={onCancel} style={{
              flex: 1, height: 52, borderRadius: 999, border: 'none', background: 'var(--color-accent)',
              color: 'var(--color-on-accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>로그인 화면으로</button>
            <button onClick={enterDemo} style={{
              flex: 1, height: 52, borderRadius: 999, background: 'transparent', border: 'none',
              boxShadow: 'inset 0 0 0 1.5px var(--color-text-primary)', color: 'var(--color-text-primary)',
              fontSize: 'clamp(13px, 3.4vw, 15px)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '0 10px',
            }}>데모 계정으로 둘러보기</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 1단계: 가입 폼 (이메일 + 기본정보 + 동의) ──
  if (step === 'email') {
    const signupReady = email.trim().length > 0 && name.trim().length > 0 && phone.trim().length > 0 && privacyConsent
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500, background: '#fff',
        overflowY: 'auto',
        fontFamily: "'Apple SD Gothic Neo', -apple-system, sans-serif",
      }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '48px 24px 56px' }}>

          {/* 헤더 */}
          <div style={{ marginBottom: 24 }}><BrandMark size={32} radius={22} /></div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', marginBottom: 6, lineHeight: 1.2 }}>Byr 시작하기</div>
          <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 28 }}>
            가입 시 무료 크레딧이 즉시 지급됩니다.
          </div>

          {/* 입력 필드 — 레이블 표시형 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>업무용 이메일{reqMark}</span>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@company.com" style={{ ...inputStyle }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>이름{reqMark}</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" style={{ ...inputStyle }} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>휴대폰 번호{reqMark}</span>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="010-0000-0000" style={{ ...inputStyle }} />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelStyle}>회사{optMark}</span>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="회사명" style={{ ...inputStyle }} />
            </label>
          </div>

          {/* 동의문 스크롤 영역 */}
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9ca3af', marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            이용약관 및 개인정보 처리방침
          </div>
          <div style={{
            border: '1px solid #e5e7eb', borderRadius: 10, height: 136, overflowY: 'auto',
            padding: '14px 16px', background: '#fafafa',
            fontSize: 11.5, color: '#374151', lineHeight: 1.65, marginBottom: 12,
          }}>
            <div style={{ fontWeight: 700, color: '#111', marginBottom: 5 }}>개인정보 처리방침 (필수)</div>
            <div style={{ color: '#555' }}>Byr는 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 2 }}>
              <div>· 수집 항목: 이메일, 이름, 휴대폰 번호</div>
              <div>· 수집 목적: 서비스 제공, 계정 관리, 고객 지원</div>
              <div>· 보유 기간: 회원 탈퇴 시 즉시 파기 (관계 법령에 따라 일정 기간 보관 가능)</div>
            </div>
            <div style={{ marginTop: 7, fontSize: 11, color: '#9ca3af' }}>위 항목의 동의를 거부할 권리가 있으나, 거부 시 서비스 이용이 제한될 수 있습니다.</div>

            <div style={{ borderTop: '1px solid #e9ecef', margin: '12px 0' }} />

            <div style={{ fontWeight: 700, color: '#111', marginBottom: 5 }}>마케팅 정보 수신 동의 (선택)</div>
            <div style={{ color: '#555' }}>수집된 정보를 마케팅 목적으로 활용합니다.</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 2 }}>
              <div>· 수집 항목: 이름, 연락처</div>
              <div>· 활용 목적: 신규 기능 안내, 이벤트·혜택 정보 제공</div>
              <div>· 보유 기간: 동의 철회 시 즉시 파기</div>
            </div>
            <div style={{ marginTop: 7, fontSize: 11, color: '#9ca3af' }}>동의하지 않아도 서비스 이용에 제한이 없습니다.</div>
          </div>

          {/* 동의 체크박스 — 카드 UI 없이 단순 행 형태 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '2px 0' }}>
              <div
                onClick={() => setPrivacyConsent(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${privacyConsent ? '#1a1a1a' : '#d1d5db'}`,
                  background: privacyConsent ? '#1a1a1a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.14s',
                }}
              >
                {privacyConsent && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
              </div>
              <span onClick={() => setPrivacyConsent(v => !v)} style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                <span style={{ color: '#dc2626', marginRight: 3 }}>[필수]</span>개인정보 처리방침에 동의합니다
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer', padding: '2px 0' }}>
              <div
                onClick={() => setMarketingConsent(v => !v)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `2px solid ${marketingConsent ? '#1a1a1a' : '#d1d5db'}`,
                  background: marketingConsent ? '#1a1a1a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.14s',
                }}
              >
                {marketingConsent && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
              </div>
              <div onClick={() => setMarketingConsent(v => !v)}>
                <span style={{ fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#6b7280', marginRight: 3 }}>[선택]</span>마케팅 정보 수신에 동의합니다
                </span>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>신규 기능·이벤트 안내를 받을 수 있어요</div>
              </div>
            </label>
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{
              flex: '0 0 auto', height: 52, padding: '0 28px',
              borderRadius: 999, border: '1.5px solid var(--color-border-emphasized)',
              background: 'var(--color-background-surface)', color: 'var(--color-text-secondary)',
              fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>돌아가기</button>
            <button
              onClick={() => { if (signupReady) setStep('verify') }}
              disabled={!signupReady}
              style={{
                flex: 1, height: 52, borderRadius: 999, border: 'none',
                background: signupReady ? 'var(--color-text-primary)' : 'var(--color-background-muted)',
                fontSize: 15, fontWeight: 600,
                color: signupReady ? 'var(--color-background-surface)' : 'var(--color-text-secondary)',
                cursor: signupReady ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
            >계속하기</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 2단계: 이메일 인증 ──
  if (step === 'verify') {
    const handleDigit = (i: number, val: string) => {
      const digit = val.replace(/\D/g, '').slice(-1)
      const next = [...codeDigits]
      next[i] = digit
      setCodeDigits(next)
      if (digit && i < 5) codeRefs.current[i + 1]?.focus()
    }
    const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !codeDigits[i] && i > 0) codeRefs.current[i - 1]?.focus()
      if (e.key === 'Enter' && codeComplete) setStep('job')
    }
    const handlePaste = (e: React.ClipboardEvent) => {
      const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      if (!paste) return
      e.preventDefault()
      const next = paste.padEnd(6, '').slice(0, 6).split('')
      setCodeDigits(next)
      codeRefs.current[Math.min(paste.length, 5)]?.focus()
    }

    return (
      <div className="m-auth" style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', fontFamily: "'Apple SD Gothic Neo', -apple-system, sans-serif",
      }}>
        <style>{`@keyframes fadeSlideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>
        {/* ── 왼쪽: 폼 ── */}
        <div className="m-auth__form" style={{
          width: '42%', minWidth: 400, background: '#fff',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '40px 56px 36px',
        }}>
          {/* 로고 */}
          <BrandMark size={28} radius={22} />

          {/* 본문 */}
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 10, lineHeight: 1.2 }}>
              이메일을 확인해 주세요
            </div>
            <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 36 }}>
              <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{email}</span>로 인증 코드를 보냈습니다.
            </div>

            {/* OTP — 단일 pill 컨테이너 + 6셀 divider */}
            <div style={{
              display: 'flex', alignItems: 'center',
              border: '1.5px solid var(--color-border-emphasized)', borderRadius: 999,
              overflow: 'hidden', height: 62, marginBottom: 14,
              background: 'var(--color-background-surface)',
            }}>
              {codeDigits.map((digit, i) => (
                <React.Fragment key={i}>
                  <input
                    ref={el => { codeRefs.current[i] = el }}
                    value={digit}
                    placeholder="0"
                    maxLength={1}
                    inputMode="numeric"
                    autoFocus={i === 0}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    style={{
                      flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
                      textAlign: 'center', fontSize: 22, fontWeight: 500,
                      background: 'transparent', fontFamily: 'inherit',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  {i < 5 && (
                    <div style={{ width: 1, height: 28, background: 'var(--color-border-emphasized)', flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 재발송 알럿 — 전체화면 알럿과 동일한 Astryx Banner 컴포넌트 */}
            {resendAlert && (
              <div style={{ marginBottom: 12, animation: 'fadeSlideDown 0.22s ease' }}>
                <Banner
                  status="info"
                  title="인증 코드를 재발송했습니다"
                  description="3분 이내에 코드를 입력해 주세요. 시간이 지나면 코드가 만료됩니다."
                />
              </div>
            )}

            {/* 재발송 */}
            <button
              onClick={() => {
                setCodeDigits(['', '', '', '', '', ''])
                codeRefs.current[0]?.focus()
                setResendAlert(true)
                if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
                resendTimerRef.current = setTimeout(() => setResendAlert(false), 8000)
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 13, color: '#888', fontFamily: 'inherit', marginBottom: 32,
                textDecoration: 'underline', fontWeight: 600,
              }}
            >코드를 못 받으셨나요? 재발송</button>

            {/* CTA 2버튼 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('email')}
                style={{
                  flex: '0 0 auto', height: 52, padding: '0 28px',
                  borderRadius: 999, border: '1.5px solid var(--color-border-emphasized)',
                  background: 'var(--color-background-surface)', color: 'var(--color-text-secondary)',
                  fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >돌아가기</button>
              <button
                onClick={() => { if (codeComplete) setStep('job') }}
                disabled={!codeComplete}
                style={{
                  flex: 1, height: 52, borderRadius: 999, border: 'none',
                  background: codeComplete ? '#1a1a1a' : 'var(--color-background-muted)',
                  color: codeComplete ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 15, fontWeight: 600,
                  cursor: codeComplete ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}
              >인증하기</button>
            </div>
          </div>

        </div>

        {/* ── 오른쪽: 프로덕트 목업 ── */}
        <div className="m-auth__mock" style={{
          ...(MOCKUP_VARIANT === 2 ? { colorScheme: 'dark' as const } : {}),
          flex: 1, background: MOCKUP_VARIANT === 2 ? 'var(--color-background-body)' : '#0d0d0d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: MOCKUP_VARIANT === 2 ? 0 : '48px 40px',
          overflow: 'hidden',
        }}>
          {MOCKUP_VARIANT === 2 ? (
            <ProductMockup />
          ) : (
            <div style={{ width: '100%', maxWidth: 640 }}>
              <ProductMockup />
            </div>
          )}
        </div>
      </div>
    )
  }


  // ── 4단계: 직무 선택 ──
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', overflowY: 'auto',
      fontFamily: "'Apple SD Gothic Neo', -apple-system, sans-serif",
      padding: '52px 24px 52px',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, lineHeight: 1.2 }}>
            어떤 업무를 담당하시나요?
          </div>
          <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>
            직무에 맞는 에이전트를 바로 추천해 드릴게요.
          </div>
        </div>

        {/* 직무 카드 7개 — 2열 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {ONBOARDING_JOBS.map(job => (
            <button
              key={job.key}
              onClick={() => goToAgents(job.key)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                background: 'var(--color-background-surface)', border: '1.5px solid var(--color-border-emphasized)', fontFamily: 'inherit',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-background-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-emphasized)'; e.currentTarget.style.background = 'var(--color-background-surface)' }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{job.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{job.desc}</div>
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>직무 선택이 어렵다면</span>
          <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
        </div>

        {/* 하단 2열: 공통 업무 + 직접 구성 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => goToAgents('common')}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: 'var(--color-background-muted)', border: '1.5px solid var(--color-border-emphasized)', fontFamily: 'inherit',
              transition: 'border-color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-emphasized)' }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>공통 업무로 시작</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>직무 구분 없이 누구나 쓰는 기본 에이전트 4종</div>
          </button>
          <button
            onClick={() => goToAgents('blank')}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: 'var(--color-background-muted)', border: '1.5px dashed var(--color-border-emphasized)', fontFamily: 'inherit',
              transition: 'border-color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-emphasized)' }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', lineHeight: 1.2 }}>직접 구성</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>에이전트를 직접 만들어 시작합니다</div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 제품 목업 (오른쪽 패널) — 실제 프로토타입 기반 4-씬 플로우 ──

// 실제 프로토타입 라이트 모드 팔레트 (CSS 변수 대신 직접 값 — 배경색 무관하게 동일하게 보임)
const M = {
  body:    '#f5f5f5',
  surface: '#ffffff',
  border:  '#e5e7eb',
  text:    '#111827',
  muted:   '#6b7280',
  lnb:     '#fafafa',
}

// 공통 LNB — 실제 Layout.tsx 수치 기반
function MockLNB() {
  return (
    <div style={{
      width: 170, background: M.lnb,
      borderRight: `1px solid ${M.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '10px 8px', gap: 2, flexShrink: 0,
    }}>
      {/* 로고 영역 — 실제: 28×28 정사각형 black bg */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', marginBottom: 6 }}>
        <BrandMark size={22} radius={24} />
        <span style={{ fontSize: 13, fontWeight: 700, color: M.text, fontFamily: 'inherit' }}>Byr</span>
      </div>
      {/* Nav items — 실제 콘솔 사이드바와 같은 순서(개요 · 내 에이전트 · 팀 에이전트 · 검토·승인 · 지식 · 마켓플레이스) */}
      {([
        [LayoutDashboard, '개요', false],
        [Bot, '내 에이전트', true],
        [Users, '팀 에이전트', false],
        [ShieldCheck, '검토 · 승인', false],
        [BookOpen, '지식', false],
        [Store, '마켓플레이스', false],
      ] as [typeof Bot, string, boolean][]).map(([Ic, label, on]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: on ? 'rgba(0,0,0,0.07)' : 'transparent' }}>
          <AstryxIcon icon={Ic} size="xsm" color={on ? 'inherit' : 'secondary'} strokeWidth={on ? 2.2 : 1.8} />
          <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? M.text : M.muted, fontFamily: 'inherit' }}>{label}</span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {/* 프로필 footer — 실제: 28×28 아바타, borderRadius: 50% */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>황</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: M.text, lineHeight: 1.2, fontFamily: 'inherit' }}>황소이 선임</div>
          <div style={{ fontSize: 9, color: M.muted, lineHeight: 1.2, fontFamily: 'inherit' }}>soyi.hwang@co...</div>
        </div>
      </div>
    </div>
  )
}

// 에이전트 카드 — 실제 AgentList 카드 구조 기반 (ClickableCard 내부 재현)
function MockAgentCard({ iconBg, icon, name, role, purpose, channel }: {
  iconBg: string; icon: IconType; name: string; role: string
  purpose: string; channel?: string
}) {
  return (
    <div style={{
      background: M.surface, borderRadius: 12,
      border: `1px solid ${M.border}`,
      padding: '12px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* 상단: 아이콘 배지 + 이름/역할 (실제: boxSize=46, radius=14) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
          <AstryxIcon icon={icon} size="sm" color="inherit" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: M.text, lineHeight: 1.3, fontFamily: 'inherit' }}>{name}</div>
          <div style={{ fontSize: 10, color: M.muted, marginTop: 1, fontFamily: 'inherit' }}>{role}</div>
        </div>
      </div>
      {/* purpose */}
      <div style={{ fontSize: 10.5, color: M.muted, lineHeight: 1.5, fontFamily: 'inherit' }}>{purpose}</div>
      {/* 상태 pill — 실제: height:22, padding:'0 10px 0 8px', borderRadius:99 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 9px 0 7px', borderRadius: 99, border: `1px solid ${M.border}`, background: M.body, fontSize: 10, color: M.muted, fontFamily: 'inherit' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: channel ? '#16a34a' : '#d1d5db', flexShrink: 0 }} />
          {channel ?? '미배치'}
        </div>
      </div>
    </div>
  )
}

// 씬 0 — 내 에이전트 목록 (실제 AgentList 기반)
function AgentListScene({ onHire }: { onHire?: () => void }) {
  return (
    <div style={{ flex: 1, padding: '18px 16px 12px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, background: M.body }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: M.text, fontFamily: 'inherit' }}>내 에이전트</div>
      {/* 검색 + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'inherit' }}>에이전트 검색...</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface, fontSize: 10, color: M.muted, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          배치 상태
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div
          onClick={onHire}
          style={{ height: 30, padding: '0 11px', borderRadius: 999, background: M.text, color: '#fff', display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit', cursor: onHire ? 'pointer' : 'default', userSelect: 'none' }}
        >
          + 에이전트 만들기
        </div>
      </div>
      {/* 탭 — 실제: borderRadius: 999 pill */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['전체', '즐겨찾기'].map((tab, i) => (
          <div key={tab} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, border: `1px solid ${M.border}`, background: i === 0 ? 'rgba(0,0,0,0.06)' : 'transparent', color: i === 0 ? M.text : M.muted, fontWeight: i === 0 ? 600 : 400, fontFamily: 'inherit' }}>{tab}</div>
        ))}
      </div>
      {/* 에이전트 카드 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MockAgentCard iconBg="#1e40af" icon={Calculator} name="부가세 대사 에이전트" role="세무 자동화" purpose="매입·매출 세금계산서를 자동으로 대조합니다" channel="#세무팀" />
        <MockAgentCard iconBg="#0369a1" icon={BarChart2} name="월 마감 요약 에이전트" role="재무 보고" purpose="월별 재무 데이터를 수집·분석합니다" channel="#재무팀" />
        <MockAgentCard iconBg="#0f766e" icon={FileText} name="계약서 검토 에이전트" role="법무 지원" purpose="계약서의 위험 조항을 탐지합니다" />
        <MockAgentCard iconBg="#9333ea" icon={Bell} name="고객 문의 분류 에이전트" role="CS 지원" purpose="문의를 카테고리별로 분류합니다" />
      </div>
    </div>
  )
}

// 씬 1 — 에이전트 만들기 모달 (실제 HireModal 기반)
function HireModalScene() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [clickedCard, setClickedCard] = useState<number | null>(null)

  useEffect(() => {
    // 커서 클릭(≈900ms) 직후 카드 선택 + 눌림 애니메이션 → 결과는 남은 시간 동안 hold
    const t1 = setTimeout(() => { setClickedCard(0); setHoveredCard(0) }, 950)
    const t2 = setTimeout(() => setClickedCard(null), 1070) // 120ms 후 눌림 해제(hover 유지)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const TPL = [
    { iconBg: '#1e40af', icon: Receipt,    name: '세금계산서 검증', desc: '세금계산서 누락·불일치 자동 점검' },
    { iconBg: '#7c3aed', icon: Calculator, name: '부가세 대사',     desc: '매입·매출 대사와 신고 전 차이 정리' },
    { iconBg: '#0369a1', icon: BarChart2,  name: '월마감',          desc: '마감 체크리스트와 보고서 초안' },
    { iconBg: '#15803d', icon: FileText,   name: '경비 정산',       desc: '지출결의·증빙 요약과 누락 확인' },
  ]
  return (
    <div style={{ flex: 1, background: M.body, position: 'relative', overflow: 'hidden' }}>
      {/* 흐린 배경 */}
      <div style={{ padding: '18px 16px', opacity: 0.2, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: M.text }}>내 에이전트</div>
        <div style={{ height: 30, borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface }} />
        <div style={{ height: 16, borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface, width: 120 }} />
      </div>
      {/* 오버레이 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      {/* 모달 — 실제: borderRadius:20, shadow: 0 8px 16px rgba(.06), 0 24px 64px rgba(.12) */}
      <div style={{
        position: 'absolute', inset: '8px 56px 10px 56px',
        background: M.surface, borderRadius: 20,
        boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 모달 헤더 */}
        <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${M.border}` }}>
          {/* Bot 아이콘 뱃지 — 실제: 32×32, borderRadius:8 */}
          <div style={{ width: 26, height: 26, borderRadius: 7, background: M.body, border: `1px solid #e5e5e5`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, color: '#525252' }}>
            <AstryxIcon icon={Bot} size="xsm" color="inherit" strokeWidth={1.8} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'inherit', marginBottom: 8 }}>에이전트 만들기</div>
          {/* 스텝 칩 — 실제: 스텝 1 active */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['기본 정보', '스킬', '채널 배치'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: i === 0 ? M.text : M.body, border: `1px solid ${i === 0 ? M.text : M.border}`, fontSize: 9, color: i === 0 ? '#fff' : M.muted, fontFamily: 'inherit' }}>
                <span style={{ fontWeight: 600 }}>{i+1}</span> {s}
              </div>
            ))}
          </div>
        </div>
        {/* 템플릿 그리드 */}
        <div style={{ flex: 1, padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, overflowY: 'hidden' }}>
          {TPL.map((t, i) => (
            <div key={t.name} style={{
              padding: '10px', borderRadius: 10,
              border: `1.5px solid ${hoveredCard === i ? '#111827' : '#e5e7eb'}`,
              background: hoveredCard === i ? '#f4f4f5' : M.surface,
              display: 'flex', flexDirection: 'column', gap: 6,
              transform: clickedCard === i ? 'scale(0.96)' : 'scale(1)',
              transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.1s ease',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <AstryxIcon icon={t.icon} size="xsm" color="inherit" strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: M.text, fontFamily: 'inherit' }}>{t.name}</div>
              <div style={{ fontSize: 9.5, color: M.muted, lineHeight: 1.4, fontFamily: 'inherit' }}>{t.desc}</div>
            </div>
          ))}
        </div>
        {/* 모달 푸터 — 실제: borderTop, 취소/다음 버튼 */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${M.border}`, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <div style={{ height: 28, padding: '0 12px', borderRadius: 999, border: '1.5px solid #e5e5e5', background: M.surface, display: 'flex', alignItems: 'center', fontSize: 10.5, color: '#525252', fontFamily: 'inherit' }}>취소</div>
          <div style={{ height: 28, padding: '0 12px', borderRadius: 999, background: '#1a1a1a', display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}>다음 →</div>
        </div>
      </div>
    </div>
  )
}

// 씬 2 — 에이전트 만들기 모달 스텝 3: 채널 배치 (HireModal과 동일한 모달 UI 내에서 진행)
function ChannelDeployModalScene() {
  const [deployed, setDeployed] = useState(false)
  useEffect(() => {
    // 커서 클릭(≈900ms) 직후 배치 완료 애니메이션
    const t1 = setTimeout(() => setDeployed(true), 980)
    return () => clearTimeout(t1)
  }, [])

  const STEP_CHIPS = ['기본 정보', '스킬', '채널 배치']

  return (
    <div style={{ flex: 1, background: M.body, position: 'relative', overflow: 'hidden' }}>
      {/* 흐린 배경 */}
      <div style={{ padding: '18px 16px', opacity: 0.2, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: M.text }}>내 에이전트</div>
        <div style={{ height: 30, borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface }} />
        <div style={{ height: 16, borderRadius: 999, border: `1px solid ${M.border}`, background: M.surface, width: 120 }} />
      </div>
      {/* 오버레이 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      {/* 모달 — HireModal과 동일한 위치·스타일 */}
      <div style={{
        position: 'absolute', inset: '8px 56px 10px 56px',
        background: M.surface, borderRadius: 20,
        boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 모달 헤더 */}
        <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${M.border}` }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: M.body, border: `1px solid #e5e5e5`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, color: '#525252' }}>
            <AstryxIcon icon={Bot} size="xsm" color="inherit" strokeWidth={1.8} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', fontFamily: 'inherit', marginBottom: 8 }}>에이전트 만들기</div>
          {/* 스텝 칩 — 1·2 완료, 3 활성 */}
          <div style={{ display: 'flex', gap: 4 }}>
            {STEP_CHIPS.map((s, i) => {
              const done = i < 2
              const active = i === 2
              return (
                <div key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999,
                  background: active ? M.text : done ? '#f0fdf4' : M.body,
                  border: `1px solid ${active ? M.text : done ? '#86efac' : M.border}`,
                  fontSize: 9, color: active ? '#fff' : done ? '#16a34a' : M.muted,
                  fontFamily: 'inherit',
                }}>
                  {done
                    ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    : <span style={{ fontWeight: 600 }}>{i + 1}</span>
                  }
                  {s}
                </div>
              )
            })}
          </div>
        </div>

        {/* 채널 배치 콘텐츠 */}
        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'hidden' }}>
          {/* 선택된 템플릿 요약 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: M.body, borderRadius: 10, border: `1px solid ${M.border}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <AstryxIcon icon={Receipt} size="xsm" color="inherit" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: M.text, fontFamily: 'inherit' }}>세금계산서 검증</div>
              <div style={{ fontSize: 9.5, color: '#16a34a', fontFamily: 'inherit' }}>✓ 선택됨</div>
            </div>
          </div>

          {/* 메신저 플랫폼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: M.text, fontFamily: 'inherit' }}>메신저 플랫폼</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {['Slack', 'Discord', 'Telegram'].map((p, i) => (
                <div key={p} style={{ height: 24, padding: '0 10px', borderRadius: 999, border: `1.5px solid ${i === 0 ? M.text : '#d1d5db'}`, background: i === 0 ? M.text : 'transparent', color: i === 0 ? '#fff' : M.muted, fontSize: 10, fontWeight: i === 0 ? 600 : 400, display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}>{p}</div>
              ))}
            </div>
          </div>

          {/* 채널 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: M.text, fontFamily: 'inherit' }}>채널</div>
            <div style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, border: `1.5px solid #d1d5db`, background: M.surface }}>
              <span style={{ fontSize: 10, color: M.text, fontFamily: 'inherit' }}>#재무팀</span>
            </div>
          </div>

          {/* 배치 완료 상태 — AgentDetail 서비스 스타일: 흰 카드 + 상태 점 */}
          {deployed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: M.body, border: `1.5px solid ${M.border}`, animation: 'fadeSlideUp 0.35s ease' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: M.text, fontFamily: 'inherit' }}>Slack에 배치됨</div>
                <div style={{ fontSize: 10, color: M.muted, fontFamily: 'inherit', marginTop: 1 }}>#재무팀</div>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${M.border}`, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <div style={{ height: 28, padding: '0 12px', borderRadius: 999, border: '1.5px solid #e5e5e5', background: M.surface, display: 'flex', alignItems: 'center', fontSize: 10.5, color: '#525252', fontFamily: 'inherit' }}>이전</div>
          <div style={{
            height: 28, padding: '0 14px', borderRadius: 999,
            background: deployed ? '#16a34a' : M.text,
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 600, color: '#fff', fontFamily: 'inherit',
            transition: 'background 0.3s ease',
          }}>
            {deployed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
            {deployed ? '완료' : '배치하기'}
          </div>
        </div>
      </div>
    </div>
  )
}

// 씬 3 — 폰 목업(채널 탭) → 풀스크린 채팅 UI (Slack 스타일) 전환
function PhoneChat() {
  const [phase, setPhase] = useState<'list' | 'tapping' | 'chat'>('list')
  const [chatStep, setChatStep] = useState(0)
  const [typed, setTyped] = useState('')
  const reduce = useReducedMotion() ?? false
  const reply = '6월 세금계산서 검증 초안을 만들었어요\n\n📄 매입 세금계산서 42건 확인\n⚠️ 확인이 필요한 4건\n• 공급가액 불일치 3건\n• 사업자번호 오류 1건\n\n검토 후 \'승인\' 또는 \'반려: 사유\'로 답해주세요'

  useEffect(() => {
    if (phase === 'list') { const t = setTimeout(() => setPhase('tapping'), 1800); return () => clearTimeout(t) }
    if (phase === 'tapping') { const t = setTimeout(() => setPhase('chat'), 520); return () => clearTimeout(t) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'chat') return
    let t: ReturnType<typeof setTimeout>
    if (chatStep === 0) t = setTimeout(() => setChatStep(1), 700)
    else if (chatStep === 1) t = setTimeout(() => setChatStep(2), 1300)
    else if (chatStep >= 2 && typed.length < reply.length) {
      t = setTimeout(() => setTyped(reply.slice(0, typed.length + 1)), 24)
    }
    return () => clearTimeout(t)
  }, [phase, chatStep, typed, reply])

  const CHANNELS = [
    { name: '재무팀', active: true },
    { name: '예산-집행-현황', active: false },
    { name: '제안서-작성발송', active: false },
    { name: '일반', active: false },
  ]

  const tr = reduce
    ? { duration: 0.12 }
    : { duration: 0.38, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }

  return (
    <AnimatePresence mode="sync" initial={false}>
      {phase !== 'chat' ? (
        // ── 폰 목업 (list/tapping 단계) ──
        <motion.div
          key="phone"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.88, y: reduce ? 0 : 14 }}
          transition={tr}
          style={{ flexShrink: 0 }}
        >
          <div style={{
            width: 200,
            background: 'linear-gradient(145deg, #fafafa 0%, #d0d0d0 14%, #f2f2f2 28%, #a4a4a4 46%, #e0e0e0 60%, #8a8a8a 76%, #c4c4c4 88%, #666666 100%)',
            borderRadius: 40, padding: '3px',
            boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.95), 0 40px 80px rgba(0,0,0,0.55), 0 12px 32px rgba(0,0,0,0.35)',
          }}>
            <div style={{ borderRadius: 37, background: '#0e0e0e', padding: '6px 6px 6px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <div style={{ width: 60, height: 26, background: '#000', borderRadius: 20 }} />
              </div>
              <div style={{ borderRadius: 32, overflow: 'hidden', height: 399, background: '#19191d', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6', fontFamily: 'inherit' }}>내 에이전트</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'inherit' }}>조직 온라인</span>
                  </div>
                </div>
                <div style={{ padding: '10px 14px 4px', fontSize: 10, fontWeight: 600, color: '#6b7280', fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase' }}>채널</div>
                {CHANNELS.map(ch => (
                  <div key={ch.name} style={{
                    padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7,
                    background: ch.active && phase === 'tapping' ? 'rgba(59,130,246,0.22)' : ch.active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'background 0.22s',
                  }}>
                    <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>#</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: ch.active ? '#e5e7eb' : '#9ca3af', fontWeight: ch.active ? 600 : 400, fontFamily: 'inherit' }}>{ch.name}</span>
                    {ch.active && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>새</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                <div style={{ width: 88, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        // ── Slack 스타일 풀스크린 채팅 UI (phase=chat) ──
        <motion.div
          key="slack"
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...tr, delay: reduce ? 0 : 0.08 }}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}
        >
          {/* ── 사이드바 ── */}
          <div style={{ width: 158, background: '#19191d', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>내 에이전트</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>온라인</span>
              </div>
            </div>
            <div style={{ padding: '10px 0 0' }}>
              <div style={{ padding: '2px 14px 6px', fontSize: 10, fontWeight: 600, color: '#6b7280', fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase' }}>채널</div>
              {CHANNELS.map(ch => (
                <div key={ch.name} style={{
                  padding: '5px 8px 5px 14px', display: 'flex', alignItems: 'center', gap: 6,
                  background: ch.active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderRadius: ch.active ? 6 : 0, margin: ch.active ? '1px 4px' : '1px 0',
                }}>
                  <span style={{ fontSize: 14, color: ch.active ? '#e5e7eb' : '#6b7280', flexShrink: 0 }}>#</span>
                  <span style={{ fontSize: 13, color: ch.active ? '#fff' : '#6b7280', fontWeight: ch.active ? 600 : 400, fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 메인 채팅 영역 ── */}
          <div style={{ flex: 1, background: '#222529', display: 'flex', flexDirection: 'column' }}>
            {/* 채널 헤더 */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <AstryxIcon icon={Receipt} size="xsm" color="inherit" strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>세금계산서 검증</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'inherit' }}>온라인 · #재무팀</span>
                </div>
              </div>
            </div>

            {/* 메시지 영역 — flex-end 정렬로 최신 메시지가 항상 하단에 */}
            <div style={{ flex: 1, padding: '16px 18px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, overflow: 'hidden' }}>
              {chatStep >= 1 && (
                <div style={{ display: 'flex', gap: 10, animation: 'fadeSlideUp 0.3s ease' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>김</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>김민지</span>
                      <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>오전 10:42</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#d1d5db', lineHeight: 1.5, fontFamily: 'inherit' }}>이번 달 세금계산서 정리해줘</div>
                  </div>
                </div>
              )}
              {chatStep === 1 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                    <AstryxIcon icon={Receipt} size="xsm" color="inherit" strokeWidth={1.8} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 10 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', animation: `typingDot 1.2s ${i*0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              {chatStep >= 2 && typed.length > 0 && (
                <div style={{ display: 'flex', gap: 10, animation: 'fadeSlideUp 0.3s ease' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                    <AstryxIcon icon={Receipt} size="xsm" color="inherit" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', fontFamily: 'inherit' }}>세금계산서 검증</span>
                      <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>오전 10:43</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#e5e7eb', lineHeight: 1.6, whiteSpace: 'pre-line', fontFamily: 'inherit' }}>
                      {typed}
                      {typed.length < reply.length && (
                        <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#e5e7eb', marginLeft: 1, animation: 'blink 0.75s infinite', verticalAlign: 'text-bottom' }} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 입력 바 */}
            <div style={{ padding: '8px 18px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, padding: '0 14px', borderRadius: 8, background: '#2f3136', border: '1px solid rgba(255,255,255,0.1)', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#6b7280', fontFamily: 'inherit' }}>#재무팀에 메시지 보내기</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/></svg>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── 브라우저 크롬 바 (공유) ──────────────────────────────────
function ChromeBar() {
  return (
    <div style={{ height: 34, background: '#f0f0f2', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6, borderBottom: `1px solid ${M.border}`, flexShrink: 0 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ height: 20, padding: '0 12px', borderRadius: 5, background: '#e5e5e7', display: 'flex', alignItems: 'center', fontSize: 10, color: '#9ca3af', fontFamily: 'inherit' }}>
          byr-console.vercel.app/agents
        </div>
      </div>
    </div>
  )
}

// ── 프로토타입 원형 커서 (파란 점) ──────────────────────────────
function ProtoCursor({ clicking }: { clicking: boolean }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: '50%',
      background: '#89e900',
      border: '2.5px solid rgba(255,255,255,0.6)',
      boxShadow: '0 2px 10px rgba(137,233,0,0.55)',
      transform: clicking ? 'scale(0.68)' : 'scale(1)',
      transition: 'transform 0.1s ease',
    }} />
  )
}

// 씬별 커서 좌표 (640×456 컨테이너 기준) — idle: 씬 시작 위치, click: 클릭 대상
const CURSOR_WP = [
  { idle: { x: 340, y: 280 }, click: { x: 550, y: 92 } },   // 씬0: + 에이전트 만들기
  { idle: { x: 490, y: 318 }, click: { x: 320, y: 210 } },  // 씬1: 카드3 → 카드0 클릭 (MockLNB=170, ChromeBar=34, modal inset 8/56)
  { idle: { x: 380, y: 280 }, click: { x: 530, y: 420 } },  // 씬2: 채널배치 모달 "배치하기" 버튼 (modal right=584, bottom=446)
  { idle: { x: 316, y: 200 }, click: { x: 316, y: 148 } },  // 씬3: 채널 탭
]

// 씬 하나의 화면 내용 (브라우저 크롬 씬 0~2 / 폰 씬 3)
function SceneContent({ index, onHire }: { index: number; onHire?: () => void }) {
  if (index >= 3) return <PhoneChat />
  return (
    <>
      <ChromeBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <MockLNB />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {index === 0 && <AgentListScene onHire={onHire} />}
          {index === 1 && <HireModalScene />}
          {index === 2 && <ChannelDeployModalScene />}
        </div>
      </div>
    </>
  )
}

function ProductMockupV1() {
  const [cur, setCur] = useState(0)
  const [cursorClicking, setCursorClicking] = useState(false)
  const reduce = useReducedMotion() ?? false

  // 각 장면 노출 시간 — 클릭→결과→짧은 읽기 여유 후 바로 전환(불필요한 hold 제거)
  //  씬0 클릭0.9s+여유 / 씬1 카드눌림~1.07s+여유 / 씬2 배치됨1.68s+~0.6s / 씬3 타이핑8.06s+읽기여유
  const DURATIONS = [1600, 1900, 2400, 8700]

  // 커서 관성: useSpring 으로 가속→감속 이동
  const springCfg = { stiffness: 260, damping: 26, mass: 0.9 }
  const cursorX = useSpring(CURSOR_WP[0].idle.x, springCfg)
  const cursorY = useSpring(CURSOR_WP[0].idle.y, springCfg)
  // 커서 중심(-9) 보정 → 좌상단 기준 translate 값
  const offX = useTransform(cursorX, v => v - 9)
  const offY = useTransform(cursorY, v => v - 9)
  const prevCurRef = useRef(0)

  // 씬 초반에 커서가 click 대상으로 이동+클릭하는 시점 (씬 시작 기준 ms) — 정지 구간 제거
  const CURSOR_TIMING = [
    { moveAt: 150, clickAt: 900 },  // 씬0: + 에이전트 만들기
    { moveAt: 150, clickAt: 900 },  // 씬1: 템플릿 카드
    { moveAt: 150, clickAt: 900 },  // 씬2: 저장 버튼
  ]

  // 씬 전환 자동 타이머 — 순서·노출 시간(DURATIONS) 그대로, 전환은 motion 담당
  useEffect(() => {
    const hold = setTimeout(() => setCur(c => (c + 1) % 4), DURATIONS[cur])
    return () => clearTimeout(hold)
  }, [cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // 씬별 커서: 씬 시작 즉시(이전 위치에서 연속 관성 이동) click 대상으로 → 초반 클릭 → 결과 hold
  useEffect(() => {
    const prev = prevCurRef.current
    prevCurRef.current = cur
    const wp = CURSOR_WP[cur] ?? CURSOR_WP[0]

    // 폰 씬(3): 커서 숨김 — 이동/클릭 타이머 없음
    if (cur >= 3) { setCursorClicking(false); return }

    // 폰 씬에서 루프 복귀 시: 숨김 상태에서 씬0 시작 지점으로 리셋(긴 텔레포트 글라이드 방지)
    if (prev >= 3) { cursorX.jump(wp.idle.x); cursorY.jump(wp.idle.y) }
    setCursorClicking(false)

    const t = CURSOR_TIMING[cur] ?? CURSOR_TIMING[0]
    const move = setTimeout(() => {
      if (reduce) { cursorX.jump(wp.click.x); cursorY.jump(wp.click.y) }
      else { cursorX.set(wp.click.x); cursorY.set(wp.click.y) }
    }, t.moveAt)
    const click = setTimeout(() => setCursorClicking(true), t.clickAt)
    const unclick = setTimeout(() => setCursorClicking(false), t.clickAt + 380)
    return () => { clearTimeout(move); clearTimeout(click); clearTimeout(unclick) }
  }, [cur, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  // 사용자가 CTA를 직접 누르면 즉시 씬1로 점프(자동 타이머는 cur 변경으로 리셋)
  const jumpTo = (next: number) => setCur(next)

  // 장면 전환 모션 — opacity 페이드 + 미묘한 scale. reduced-motion 시 scale 제거·짧게
  const sceneTransition = reduce
    ? { duration: 0.2, ease: 'linear' as const }
    : { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
  const enterScale = reduce ? 1 : 0.98
  const exitScale = reduce ? 1 : 1.01

  const isPhone = cur >= 3
  const cardStyle: React.CSSProperties = isPhone
    ? { position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }
    : { position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: `1px solid ${M.border}`, background: M.surface, display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ width: '100%', maxWidth: 640, position: 'relative', height: 456, userSelect: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes typingDot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes cursorRipple { 0%{transform:scale(0.3);opacity:0.7} 100%{transform:scale(2.2);opacity:0} }
      `}</style>

      {/* ── 장면 크로스페이드 (motion) ── */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={cur}
          style={cardStyle}
          initial={{ opacity: 0, scale: enterScale }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: exitScale }}
          transition={sceneTransition}
        >
          <SceneContent index={cur} onHire={cur === 0 ? () => jumpTo(1) : undefined} />
        </motion.div>
      </AnimatePresence>

      {/* ── 프로토타입 원형 커서 오버레이 (관성 스프링) · 폰 씬에선 숨김 ── */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          x: offX,
          y: offY,
          pointerEvents: 'none',
          zIndex: 20,
        }}
        animate={{ opacity: cur >= 3 ? 0 : 1 }}
        transition={{ duration: 0.25, ease: 'linear' }}
      >
        <ProtoCursor clicking={cursorClicking} />
        {cursorClicking && (
          <div style={{
            position: 'absolute', left: -10, top: -10,
            width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(137,233,0,0.35)',
            animation: 'cursorRipple 0.52s ease-out forwards',
          }} />
        )}
      </motion.div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  2시안 — 키네틱 위저드 모션그래픽 (실제 서비스 다크 테마 + accent)
// ════════════════════════════════════════════════════════════════

// 배경/표면/텍스트는 실제 서비스 토큰(colorScheme:dark 하 다크값). 선택/버튼 액센트는 참조 영상 라임.
const V2_ACCENT = '#cbfc00'      // 선택/버튼 액센트(참조 영상 라임) — 소이님 최신 결정
const V2_ON_ACCENT = '#0d0d0d'   // 라임 위 글자/글리프는 다크 대비
const V2_BG = 'var(--color-background-body)'     // 무대 배경(콘텐츠 영역 블랙)
const V2_SURFACE = 'var(--color-background-surface)' // 떠 있는 칩/카드 표면(다크그레이)
const V2_BORDER = 'var(--color-border)'
const V2_BORDER_EM = 'var(--color-border-emphasized)'
const V2_TEXT = 'var(--color-text-primary)'
const V2_TEXT2 = 'var(--color-text-secondary)'

// 직무 7종 타일 — 기획·PM 이 중앙(index 3), 체크 표시.
// 색은 참조 영상 카드색 실측값. fg = 타일 명도별 글리프색(밝은 타일=다크, 어두운 타일=흰색).
const DARK_FG = '#0d0d0d'
const WHITE_FG = '#ffffff'
const V2_JOB_TILES: { name: string; icon: IconType; bg: string; fg: string; center?: boolean }[] = [
  { name: '재무·회계',     icon: Calculator,    bg: '#e2edf6', fg: DARK_FG },  // 연회색/화이트
  { name: '보험 FP',       icon: ShieldCheck,   bg: '#cbfc00', fg: DARK_FG },  // 라임
  { name: '증권 리서치',   icon: TrendingUp,    bg: '#fc8afb', fg: DARK_FG },  // 핑크
  { name: '기획·PM',       icon: ClipboardList, bg: '#0056f0', fg: WHITE_FG, center: true }, // 블루(중앙)
  { name: '준법·내부감사', icon: Scale,         bg: '#fd4f00', fg: WHITE_FG }, // 오렌지
  { name: '인사·총무',     icon: Users,         bg: '#68cae1', fg: DARK_FG },  // 스카이
  { name: '개발·운영',     icon: Terminal,      bg: '#00db00', fg: DARK_FG },  // 그린
]

// 파일 상단 ONBOARDING_JOBS(key/label/desc) 값을 그대로 쓰되, V2 시각화용 아이콘·색만 key로 매핑
// (색은 위 참조 영상 카드색과 동일)
const V2_JOB_META: Record<string, { icon: IconType; bg: string }> = {
  vat_reconcile:       { icon: Calculator,    bg: '#e2edf6' },
  insurance_fp:        { icon: ShieldCheck,   bg: '#cbfc00' },
  securities_research: { icon: TrendingUp,    bg: '#fc8afb' },
  compliance_aml:      { icon: Scale,         bg: '#fd4f00' },
  hr:                  { icon: Users,         bg: '#68cae1' },
  pm_brief:            { icon: ClipboardList, bg: '#0056f0' },
  dev_incident:        { icon: Terminal,      bg: '#00db00' },
}

// 칩 (스킬·모델·추천 업무·직무) — 팝인 + 선택 시 accent 채움. 참조 영상처럼 크게.
function V2Chip({ label, index, selected = false, dashed = false, icon, reduce }: {
  label: string; index: number; selected?: boolean; dashed?: boolean; icon?: IconType; reduce: boolean
}) {
  const selDelay = index * 0.07 + 0.3
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 8 }}
      animate={{
        opacity: 1, scale: 1, y: 0,
        backgroundColor: selected ? V2_ACCENT : V2_SURFACE,
        color: selected ? V2_ON_ACCENT : V2_TEXT,
      }}
      transition={reduce
        ? { duration: 0.18, delay: index * 0.03 }
        : {
            opacity: { delay: index * 0.07, duration: 0.25 },
            scale: { type: 'spring' as const, stiffness: 420, damping: 24, delay: index * 0.07 },
            y: { type: 'spring' as const, stiffness: 420, damping: 24, delay: index * 0.07 },
            backgroundColor: { delay: selected ? selDelay : index * 0.07, duration: 0.4 },
            color: { delay: selected ? selDelay : index * 0.07, duration: 0.4 },
          }}
      style={{
        padding: icon ? '12px 22px 12px 13px' : '14px 24px', borderRadius: 999,
        minHeight: 48, boxSizing: 'border-box',
        fontSize: 15, fontWeight: selected ? 700 : 600,
        border: dashed ? `1.5px dashed ${V2_BORDER_EM}` : `1px solid ${V2_BORDER}`,
        display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', lineHeight: 1,
      }}
    >
      {icon && (
        <span style={{ width: 28, height: 28, borderRadius: 9, background: selected ? 'rgba(0,0,0,0.16)' : 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selected ? V2_ON_ACCENT : V2_TEXT2, flexShrink: 0 }}>
          <AstryxIcon icon={icon} size="sm" color="inherit" strokeWidth={1.8} />
        </span>
      )}
      {label}
    </motion.div>
  )
}

// 지식 연동 리스트 행 — 좌측에서 슬라이드인. badge 있으면 실제 브랜드 로고(흰 배지) 사용, 없으면 Astryx 아이콘.
function V2Row({ label, index, icon, badge, reduce }: { label: string; index: number; icon: IconType; badge?: React.ReactNode; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? { duration: 0.18, delay: index * 0.04 } : { type: 'spring' as const, stiffness: 380, damping: 26, delay: index * 0.08 }}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 18px', borderRadius: 14, background: V2_SURFACE, border: `1px solid ${V2_BORDER}`, width: 380 }}
    >
      {badge ?? (
        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2_ACCENT, flexShrink: 0 }}>
          <AstryxIcon icon={icon} size="sm" color="inherit" strokeWidth={1.8} />
        </span>
      )}
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: V2_TEXT }}>{label}</span>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: V2_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2_ON_ACCENT, flexShrink: 0 }}>
        <AstryxIcon icon={Check} size="xsm" color="inherit" strokeWidth={2.5} />
      </span>
    </motion.div>
  )
}

// 업무 채널 칩 — 실제 브랜드 로고(PlatformLogo) + 선택 시 라임 채움
function V2ChannelChip({ platform, label, index, selected = false, channel, reduce }: {
  platform: string; label: string; index: number; selected?: boolean; channel?: string; reduce: boolean
}) {
  const selDelay = index * 0.07 + 0.3
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, backgroundColor: selected ? V2_ACCENT : V2_SURFACE, color: selected ? V2_ON_ACCENT : V2_TEXT }}
      transition={reduce
        ? { duration: 0.18, delay: index * 0.03 }
        : {
            opacity: { delay: index * 0.07, duration: 0.25 },
            scale: { type: 'spring' as const, stiffness: 420, damping: 24, delay: index * 0.07 },
            y: { type: 'spring' as const, stiffness: 420, damping: 24, delay: index * 0.07 },
            backgroundColor: { delay: selected ? selDelay : index * 0.07, duration: 0.4 },
            color: { delay: selected ? selDelay : index * 0.07, duration: 0.4 },
          }}
      style={{
        padding: '12px 20px 12px 13px', borderRadius: 999, minHeight: 48, boxSizing: 'border-box',
        fontSize: 15, fontWeight: selected ? 700 : 600, border: `1px solid ${V2_BORDER}`,
        display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', lineHeight: 1,
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PlatformLogo platform={platform} size={18} />
      </span>
      {label}
      {selected && channel && (
        <span style={{ marginLeft: 4, padding: '4px 11px', borderRadius: 999, background: 'rgba(0,0,0,0.16)', color: V2_ON_ACCENT, fontSize: 13, fontWeight: 600 }}>{channel}</span>
      )}
    </motion.div>
  )
}

function ProductMockupV2() {
  const reduce = useReducedMotion() ?? false
  const [beat, setBeat] = useState(0)
  // 8비트: 0 시작CTA / 1 직무선택 / 2 스킬 / 3 모델 / 4 지식연동 / 5 추천업무 / 6 업무채널 / 7 준비완료+캐러셀
  // 레퍼런스 영상의 measured한 페이스(스텝당 ~2~2.5s). 총 ~16.7s.
  const BEAT_MS = [1500, 2200, 2000, 2000, 2200, 2200, 2000, 2600]
  const BEATS = BEAT_MS.length

  // 비트 자동 순환 → 루프
  useEffect(() => {
    const t = setTimeout(() => setBeat(b => (b + 1) % BEATS), BEAT_MS[beat])
    return () => clearTimeout(t)
  }, [beat]) // eslint-disable-line react-hooks/exhaustive-deps

  // 비트7 — 단일 타일 → 캐러셀 2단계
  const [reveal, setReveal] = useState<'single' | 'carousel'>('single')
  useEffect(() => {
    setReveal('single')
    if (beat !== 7) return
    const t = setTimeout(() => setReveal('carousel'), reduce ? 0 : 1000)
    return () => clearTimeout(t)
  }, [beat, reduce])

  // 상단 스텝 라벨(8비트) / 위저드 스텝 도트는 스킬·모델·지식·추천·채널 5개
  const STEP_LABELS = ['시작', '직무 선택', '스킬', '모델', '지식 연동', '추천 업무', '업무 채널', '완료']
  const AGENT_NAME = '기획 PM 도우미'
  const showAgentName = beat >= 2 && beat <= 6

  const beatFade = { duration: reduce ? 0.15 : 0.45, ease: 'easeInOut' as const }

  // 비트별 중앙 콘텐츠
  const renderBeat = () => {
    // 비트0 — 생성 시작 CTA (버튼 프레스 + accent 글로우)
    if (beat === 0) {
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: V2_TEXT, letterSpacing: '-0.02em', marginBottom: 12 }}>새 에이전트 만들기</div>
          <div style={{ fontSize: 16, color: V2_TEXT2, marginBottom: 38 }}>업무를 자동화할 에이전트를 몇 번의 클릭으로</div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* accent 글로우 링(리플) — blur 없이 확장·페이드 */}
            {!reduce && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: [0, 0.5, 0], scale: [0.85, 1.35, 1.7] }}
                transition={{ duration: 0.75, delay: 0.62, times: [0, 0.4, 1] }}
                style={{ position: 'absolute', inset: -4, borderRadius: 999, background: V2_ACCENT, opacity: 0.4, zIndex: 0 }}
              />
            )}
            <motion.button
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: [1, 1, 0.93, 1.03, 1] }}
              transition={reduce ? { duration: 0.2 } : {
                opacity: { duration: 0.3 }, y: { duration: 0.3 },
                scale: { times: [0, 0.5, 0.66, 0.83, 1], duration: 1.0, delay: 0.4 },
              }}
              style={{
                position: 'relative', zIndex: 1, cursor: 'default',
                background: V2_ACCENT, color: V2_ON_ACCENT, border: 'none',
                padding: '18px 36px', borderRadius: 999, fontSize: 17, fontWeight: 700,
                fontFamily: 'inherit', boxShadow: '0 12px 34px rgba(0,0,0,0.35)',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}
            >
              <AstryxIcon icon={Sparkles} size="md" color="inherit" strokeWidth={2} />
              에이전트 생성 시작하기
            </motion.button>
          </div>
        </div>
      )
    }
    // 비트1 — 직무 선택 (온보딩 직무 7종, 기획·PM accent 선택)
    if (beat === 1) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 600 }}>
          {ONBOARDING_JOBS.map((job, i) => (
            <V2Chip key={job.key} label={job.label} index={i} selected={job.key === 'pm_brief'} icon={V2_JOB_META[job.key]?.icon} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트2 — 스킬
    if (beat === 2) {
      const SKILLS = [
        { label: '회의록 요약' },
        { label: '액션아이템 추출', selected: true },
        { label: '기획서 초안' },
        { label: '경쟁사 리서치' },
        { label: 'Custom', dashed: true },
      ]
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 540 }}>
          {SKILLS.map((s, i) => (
            <V2Chip key={s.label} label={s.label} index={i} selected={s.selected} dashed={s.dashed} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트3 — 모델 (실제 AgentDetail LLM_MODELS 3종, 내장 LLM 기본 선택)
    if (beat === 3) {
      const MODELS: { label: string; icon: IconType; selected?: boolean }[] = [
        { label: '내장 LLM', icon: Cpu, selected: true },
        { label: 'OpenAI GPT-4o', icon: Bot },
        { label: 'Anthropic Claude', icon: Bot },
      ]
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 480 }}>
          {MODELS.map((m, i) => (
            <V2Chip key={m.label} label={m.label} index={i} selected={m.selected} icon={m.icon} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트4 — 지식 연동 (실제 로고 있으면 사용: Google Drive=mcpLogos.gdrive, Slack=platformLogos)
    if (beat === 4) {
      const slackBadge = (
        <span style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PlatformLogo platform="slack" size={20} />
        </span>
      )
      const SOURCES: { label: string; icon: IconType; badge?: React.ReactNode }[] = [
        { label: '사내 문서 8,200건', icon: FileText },
        { label: 'Google Drive', icon: HardDrive, badge: <McpLogoIcon mcpKey="gdrive" size={36} /> },
        { label: 'Slack', icon: MessageSquare, badge: slackBadge },
        { label: 'Notion', icon: BookOpen },
        { label: 'Google Calendar', icon: Calendar },
      ]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SOURCES.map((s, i) => (
            <V2Row key={s.label} label={s.label} index={i} icon={s.icon} badge={s.badge} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트5 — 추천 업무
    if (beat === 5) {
      const TASKS = [
        { label: '회의록 요약', selected: true },
        { label: '액션아이템 추출', selected: true },
        { label: '경쟁사 리서치' },
        { label: '기획서 초안', selected: true },
      ]
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 440 }}>
          {TASKS.map((t, i) => (
            <V2Chip key={t.label} label={t.label} index={i} selected={t.selected} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트6 — 업무 채널 (실제 브랜드 로고, Slack 선택 → #기획팀-봇)
    if (beat === 6) {
      const CHANNELS = [
        { platform: 'slack', label: 'Slack', selected: true, channel: '#기획팀-봇' }, // JOB_CHANNEL_DEFAULTS.pm_brief.slack
        { platform: 'discord', label: 'Discord' },
        { platform: 'telegram', label: 'Telegram' },
      ]
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 520 }}>
          {CHANNELS.map((c, i) => (
            <V2ChannelChip key={c.platform} platform={c.platform} label={c.label} index={i} selected={c.selected} channel={c.channel} reduce={reduce} />
          ))}
        </div>
      )
    }
    // 비트7 — 최종 리빌 (단일 타일 → 전체 폭 캐러셀)
    return (
      <AnimatePresence mode="wait">
        {reveal === 'single' ? (
          <motion.div key="single" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.15 : 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 260, damping: 20 }}
              style={{ position: 'relative', width: 132, height: 132, borderRadius: 32, background: '#0056f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE_FG, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
            >
              <span style={{ display: 'flex', transform: 'scale(2.1)' }}>
                <AstryxIcon icon={ClipboardList} size="lg" color="inherit" strokeWidth={1.8} />
              </span>
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 500, damping: 15, delay: 0.45 }}
                style={{ position: 'absolute', top: -9, right: -9, width: 36, height: 36, borderRadius: '50%', background: V2_ACCENT, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2_ON_ACCENT }}
              >
                <AstryxIcon icon={Check} size="sm" color="inherit" strokeWidth={3} />
              </motion.div>
            </motion.div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: V2_TEXT }}>에이전트 준비 완료</div>
              <div style={{ fontSize: 13, color: V2_TEXT2, marginTop: 5 }}>Slack #기획팀-봇에 배치됨</div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="carousel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0.15 : 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, width: '100%' }}>
            {/* 전체 폭 가로 캐러셀 — 양옆 타일은 패널 밖으로 자연스럽게 잘림 */}
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {V2_JOB_TILES.map((tile, i) => {
                const dist = Math.abs(i - 3)
                const isCenter = !!tile.center
                return (
                  <motion.div key={tile.name}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, x: (3 - i) * 22 }}
                    animate={{ opacity: 1, scale: isCenter ? 1.12 : 1, x: 0 }}
                    transition={reduce ? { duration: 0.2, delay: i * 0.03 } : { type: 'spring' as const, stiffness: 280, damping: 24, delay: isCenter ? 0 : 0.14 + dist * 0.1 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0, position: 'relative', zIndex: isCenter ? 2 : 1 }}
                  >
                    {/* 컬러 타일(글리프만) — 라벨은 아래 검은 무대 위 흰색 */}
                    <div style={{ width: 128, height: 128, borderRadius: 26, background: tile.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: tile.fg, boxShadow: isCenter ? '0 12px 36px rgba(0,0,0,0.5)' : '0 8px 22px rgba(0,0,0,0.45)' }}>
                      <span style={{ display: 'flex', transform: 'scale(2)' }}>
                        <AstryxIcon icon={tile.icon} size="lg" color="inherit" strokeWidth={1.8} />
                      </span>
                      {isCenter && (
                        <span style={{ position: 'absolute', top: -9, right: -9, width: 30, height: 30, borderRadius: '50%', background: V2_ACCENT, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2_ON_ACCENT }}>
                          <AstryxIcon icon={Check} size="sm" color="inherit" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: isCenter ? 700 : 500, color: '#fff', textAlign: 'center', lineHeight: 1.2, padding: '0 2px', maxWidth: 140 }}>{tile.name}</span>
                  </motion.div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: V2_TEXT }}>업종별 에이전트, 클릭 한 번으로</div>
              <div style={{ fontSize: 12.5, color: V2_TEXT2, marginTop: 5 }}>기획·PM 에이전트가 Slack에 배치되었습니다</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <div style={{ colorScheme: 'dark', width: '100%', height: '100%', minHeight: 456, position: 'relative', userSelect: 'none', overflow: 'hidden', background: V2_BG, fontFamily: 'inherit' }}>
      <style>{`@keyframes v2blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      {/* 상단 스텝 라벨 + (위저드 진행 시) 에이전트 이름 */}
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5 }}>
        <AnimatePresence mode="wait">
          <motion.span key={STEP_LABELS[beat]}
            initial={{ opacity: 0, y: reduce ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : 4 }} transition={{ duration: 0.25 }}
            style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: V2_TEXT2, fontFamily: 'inherit' }}>
            {STEP_LABELS[beat]}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {showAgentName && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px 5px 7px', borderRadius: 999, background: V2_ACCENT }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 6, background: 'rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2_ON_ACCENT }}>
                <AstryxIcon icon={ClipboardList} size="xsm" color="inherit" strokeWidth={2} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: V2_ON_ACCENT, fontFamily: 'inherit' }}>{AGENT_NAME}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 중앙 콘텐츠 (좌우 패딩 0 → 캐러셀 전체 폭 사용) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0 88px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={beat}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={beatFade}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {renderBeat()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 하단 스텝 도트 5개 (스킬·모델·지식·추천·채널 = 비트 2~6) */}
      <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 5 }}>
        {[1, 2, 3, 4, 5].map(s => {
          const stepBeat = s + 1 // s1→비트2 ... s5→비트6
          const done = beat > stepBeat || beat === 7
          const current = beat === stepBeat
          const active = done || current
          return (
            <motion.div key={s}
              animate={{ backgroundColor: active ? V2_ACCENT : V2_SURFACE, scale: current && !done ? 1.15 : 1, color: active ? V2_ON_ACCENT : V2_TEXT2 }}
              transition={{ duration: 0.3 }}
              style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${V2_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {done
                ? <AstryxIcon icon={Check} size="xsm" color="inherit" strokeWidth={2.6} />
                : <span style={{ fontSize: 10, fontWeight: 700, color: 'inherit', fontFamily: 'inherit' }}>{s}</span>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// 시안 토글 — 1: 기존 콘솔 목업, 2: 키네틱 위저드. 기본 1(1시안)
// 비교용으로 주소에서도 고를 수 있다: /login?mockup=2
const MOCKUP_VARIANT: 1 | 2 = 1
function ProductMockup() {
  const fromUrl = new URLSearchParams(window.location.search).get('mockup')
  const variant = fromUrl === '2' ? 2 : fromUrl === '1' ? 1 : MOCKUP_VARIANT
  return variant === 2 ? <ProductMockupV2 /> : <ProductMockupV1 />
}

// ── 메인 로그인 페이지 ────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  // 소셜 로그인이 서버에 연결돼 있지 않을 때의 안내(시연 화면으로 그냥 통과시키지 않는다)
  const [socialNotice, setSocialNotice] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // 랜딩의 「가입하고 시작하기」는 /login?signup=1 로 들어와 가입 화면부터 연다
  const [showSignup, setShowSignup] = useState(
    () => new URLSearchParams(window.location.search).get('signup') === '1'
  )

  // ── 네이버·카카오 실제 연동 ── 백엔드에 키가 설정돼 있으면 공급자 로그인 화면으로 이동, 없으면 시연 화면
  const [providers, setProviders] = useState<Providers | null>(null)
  const oauthError = new URLSearchParams(window.location.search).get('oauth_error')
  type Providers = { google?: boolean; naver?: boolean; kakao?: boolean }
  const fetchProviders = (): Promise<Providers> =>
    fetch('/api/auth/providers').then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  useEffect(() => { fetchProviders().then(setProviders) }, [])
  // 소셜 로그인은 공급자 페이지에서만 로그인 정보를 입력한다(우리 화면에서 흉내 내지 않는다 — Google OAuth 정책·피싱 기준).
  // 서버에 키가 있으면 공급자로 보내고, 돌아오면 서버가 승인 목록과 대조한다. 키가 없으면 안내만 한다.
  const startSocial = async (p: 'google' | 'naver' | 'kakao') => {
    setSocialNotice('')
    const conf = providers ?? await fetchProviders()   // 서버가 늦게 깨어나도 판단하고 넘긴다
    if (conf?.[p]) { window.location.assign(`/api/auth/${p}/start`); return }
    setSocialNotice({ google: 'Google', naver: '네이버', kakao: '카카오' }[p])
  }

  const canLogin = email.trim().length > 0 && password.length > 0
  const handleContinue = async () => {
    if (!EMAIL_RE.test(email.trim())) { setLoginError('이메일 주소 형식을 확인해 주세요.'); return }
    if (password.length < 8) { setLoginError('비밀번호는 8자 이상 입력해 주세요.'); return }
    setLoginError('')
    setIsLoading(true)
    try {
      // 관리자가 승인한 계정인지 서버에서 확인한다(비밀번호는 서버에서만 대조)
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.ok) {
        signIn(data.profile)
        navigate('/overview')
        return
      }
      setLoginError(r.status === 401 ? NOT_APPROVED_MSG : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } catch {
      setLoginError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }
  // 면접관용 진입: 입력 없이 데모 계정으로 들어간다
  const enterDemo = () => {
    signIn({ provider: 'email', id: 'demo-soyi', name: '황소이 선임', email: DEMO_EMAIL })
    navigate('/overview')
  }

  return (
    <div className="m-auth" style={{ display: 'flex', minHeight: '100vh' }}>
      {showSignup && (
        <SignupScreen
          onCancel={() => setShowSignup(false)}
        />
      )}

      {/* ── 왼쪽: 폼 패널 ── */}
      <div className="m-auth__form" style={{
        width: '44%', minWidth: 440,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {/* 로고 — 좌상단 */}
        <div style={{ padding: '28px 36px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={28} radius={22} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>Byr</span>
        </div>

        {/* 폼 — Astryx login-card 구조, 카드 배경 없음 */}
        <Center axis="both" style={{ flex: 1, padding: 'var(--spacing-6)' }}>
          <VStack gap={4} hAlign="center" style={{ width: '100%', maxWidth: 400 }}>

            {/* 헤더 */}
            <VStack gap={1} hAlign="center">
              <Heading level={2}>Byr에 오신 것을 환영합니다</Heading>
              <Text type="body" color="secondary" size="sm">이메일로 로그인하거나 새 계정을 만드세요</Text>
            </VStack>


            {/* 소셜 로그인 — 공급자 버튼 가이드를 따른다
                네이버: 녹색(#03C75A) 완성형, 흰 N 로고 16px, 로고·레이블 간격 8px
                카카오: 컨테이너 #FEE500, 심볼 #000000, 레이블 #000000 85%, 모서리 12px, 레이블 「카카오 로그인」 */}
            {oauthError && (
              <div role="alert" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--color-background-muted)', fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                {OAUTH_ERRORS[oauthError] || '로그인하지 못했습니다. 다시 시도해 주세요.'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {([
                { key: 'google', label: 'Google 계정으로 로그인', icon: <GoogleIcon />, onClick: () => startSocial('google'),
                  bg: '#ffffff', fg: '#1f1f1f', border: '1px solid #747775' },
                { key: 'naver', label: '네이버 로그인', icon: <NaverN />, onClick: () => startSocial('naver'),
                  bg: '#03C75A', fg: '#ffffff', border: 'none' },
                { key: 'kakao', label: '', onClick: () => startSocial('kakao'),
                  icon: <img src="/brand/kakao-login-label-kr.svg" alt="카카오 로그인" style={{ height: 15, display: 'block' }} />,
                  bg: '#FEE500', fg: 'rgba(0,0,0,0.85)', border: 'none' },
              ] as { key: string; label: string; icon: React.ReactNode; onClick: () => void; bg: string; fg: string; border: string }[]).map(b => (
                <button
                  key={b.key}
                  onClick={b.onClick}
                  style={{
                    width: '100%', height: 48, borderRadius: 12, border: b.border, background: b.bg, color: b.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
                  }}
                >
                  {b.icon}
                  {b.label}
                </button>
              ))}
            </div>

            {socialNotice && (
              <div role="alert" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: 'inherit', padding: '10px 14px', borderRadius: 12, background: 'var(--color-background-muted)' }}>
                {socialNotice} 로그인은 아직 연결되지 않았어요. 승인된 계정으로 로그인하거나 아래의 데모 계정으로 둘러보세요.
              </div>
            )}

            {/* 구분선 */}
            <Divider label="또는" />

            {/* 이메일 입력 */}
            <input
              type="email"
              placeholder="name@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setLoginError('') }}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              style={{
                width: '100%', height: 48, padding: '0 18px', boxSizing: 'border-box',
                border: '1.5px solid var(--color-border-emphasized)', borderRadius: 999,
                background: 'var(--color-background-surface)',
                fontSize: 15, fontFamily: 'inherit', outline: 'none',
                color: 'var(--color-text-primary)',
              }}
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => { setPassword(e.target.value); setLoginError('') }}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              autoComplete="off"
              style={{
                width: '100%', height: 48, padding: '0 18px', boxSizing: 'border-box',
                border: '1.5px solid var(--color-border-emphasized)', borderRadius: 999,
                background: 'var(--color-background-surface)',
                fontSize: 15, fontFamily: 'inherit', outline: 'none',
                color: 'var(--color-text-primary)',
              }}
            />
            {loginError && (
              <div role="alert" style={{ fontSize: 13, color: 'var(--color-text-red, #dc2626)', fontFamily: 'inherit', padding: '0 6px' }}>{loginError}</div>
            )}

            {/* 로그인 + 데모 진입(면접관·방문자는 입력 없이 오른쪽 버튼으로) */}
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button
                onClick={handleContinue}
                disabled={!canLogin || isLoading}
                style={{
                  flex: 1, minWidth: 0, height: 52, borderRadius: 999, border: 'none',
                  background: canLogin ? 'var(--color-accent)' : 'var(--color-background-muted)',
                  color: canLogin ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                  fontSize: 15, fontWeight: 600,
                  cursor: canLogin ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', opacity: isLoading ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
              >
                {isLoading ? '로그인 중…' : '로그인'}
              </button>
              <button
                onClick={enterDemo}
                style={{
                  flex: 1, minWidth: 0, height: 52, borderRadius: 999, background: 'transparent',
                  border: 'none', boxShadow: 'inset 0 0 0 1.5px var(--color-text-primary)',
                  color: 'var(--color-text-primary)', fontSize: 'clamp(13px, 3.4vw, 15px)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '0 10px',
                }}
              >
                데모 계정으로 둘러보기
              </button>
            </div>

            {/* 회원가입 링크 + 말풍선 */}
            <VStack hAlign="center">
              <Text type="supporting" color="secondary">
                계정이 없으신가요?{' '}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  {/* 블랙 말풍선 — 오른쪽 */}
                  <span className="m-auth__tip" style={{
                    position: 'absolute',
                    left: 'calc(100% + 10px)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#111827',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.5,
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
                  }}>
                    가입 시 무료 크레딧 즉시 지급!
                    {/* 왼쪽 화살표 */}
                    <span style={{
                      position: 'absolute',
                      left: -5,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 0, height: 0,
                      borderTop: '5px solid transparent',
                      borderBottom: '5px solid transparent',
                      borderRight: '5px solid #111827',
                      display: 'block',
                    }} />
                  </span>
                  <span
                    onClick={e => { e.preventDefault(); setShowSignup(true) }}
                    style={{
                      fontWeight: 700,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      cursor: 'pointer',
                      color: 'var(--color-accent)',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                    }}
                  >
                    지금 시작하기
                  </span>
                </span>
              </Text>
            </VStack>


          </VStack>
        </Center>
      </div>

      {/* ── 오른쪽: 제품 목업 패널 ── */}
      <div className="m-auth__mock" style={{
        ...(MOCKUP_VARIANT === 2 ? { colorScheme: 'dark' as const } : {}),
        flex: 1,
        background: MOCKUP_VARIANT === 2 ? 'var(--color-background-body)' : '#1c1c1e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: MOCKUP_VARIANT === 2 ? 0 : '48px 40px',
        overflow: 'hidden',
      }}>
        <ProductMockup />
      </div>
    </div>
  )
}
