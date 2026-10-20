import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { VStack, HStack, Layout, LayoutHeader, LayoutContent } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Card } from '@astryxdesign/core/Card'
import { Banner } from '@astryxdesign/core/Banner'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { CreditCard, Smartphone, Check, X } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'
import type { IconType } from '@astryxdesign/core/Icon'

// ── 공통 버튼 ─────────────────────────────────────────────────

function PrimaryBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '10px 22px', borderRadius: 'var(--radius-full)',
      background: 'var(--color-accent)', border: 'none',
      color: 'var(--color-on-accent)',
      fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

function OutlineBtn({ label, onClick, size = 'md' }: { label: string; onClick?: () => void; size?: 'sm' | 'md' }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '6px 14px' : '10px 22px',
      borderRadius: 'var(--radius-full)',
      border: '1px solid var(--color-border-emphasized)',
      background: 'var(--color-background-surface)',
      color: 'var(--color-text-primary)',
      fontSize: size === 'sm' ? 13 : 14, fontWeight: 500,
      fontFamily: 'inherit', cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

function DangerBtn({ label, onClick, size = 'md' }: { label: string; onClick?: () => void; size?: 'sm' | 'md' }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '6px 14px' : '10px 22px',
      borderRadius: 'var(--radius-full)',
      border: '1px solid #fca5a5',
      background: 'var(--color-background-surface)',
      color: 'var(--color-error)',
      fontSize: size === 'sm' ? 13 : 14, fontWeight: 500,
      fontFamily: 'inherit', cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

// ── 서브듀드 배지 ─────────────────────────────────────────────

function StatusBadge({ label, variant = 'neutral' }: { label: string; variant?: 'neutral' | 'success' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 'var(--radius-full)',
      fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
      background: 'var(--color-background-muted)',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-border)',
    }}>
      {variant === 'success' && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-status-active)', flexShrink: 0 }} />
      )}
      {label}
    </span>
  )
}

// ── 폼 인풋 ──────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border-emphasized)',
  background: 'var(--color-background-surface)',
  color: 'var(--color-text-primary)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}

function PillInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={INPUT} />
  )
}

// ── 플랜 데이터 ───────────────────────────────────────────────

interface PlanFeature { text: string; muted?: boolean }
interface PlanDef {
  key: string
  name: string
  badge?: string
  monthlyPrice: string | null
  annualPrice: string | null
  originalMonthlyWhenAnnual?: string
  priceSub: string
  cta: string
  ctaStyle: 'primary' | 'outline' | 'current'
  features: PlanFeature[]
}

// 플랜 라인업 — 과금 축=정액(flat), 티어 차등=설정·거버넌스 깊이. 4티어 모두 유료.
// 가격은 제안(미확정, D-15). 에이전트 생성·실행 무제한·전 스킬 개방은 전 티어 공통.
const PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: '스타터',
    monthlyPrice: '₩39,000',
    annualPrice: '₩31,000',
    originalMonthlyWhenAnnual: '₩39,000',
    priceSub: '월 정액 · 개인~소규모(1~10)',
    cta: '스타터로 변경',
    ctaStyle: 'outline',
    features: [
      { text: '에이전트 무제한 생성' },
      { text: '정액 무제한 실행 (토큰 걱정 없음)' },
      { text: '전 스킬 개방' },
      { text: '내장 LLM' },
      { text: '기본 커넥터 (Google Drive)' },
      { text: '메신저 채널 (Slack·Discord·Telegram) + 대화 로그' },
      { text: '작업 기록부 (감사 로그)' },
      { text: '멤버 최대 10명' },
      { text: '이메일 지원' },
      { text: '모델 선택 · 검증 (프로부터)', muted: true },
    ],
  },
  {
    key: 'pro',
    name: '프로',
    badge: '현재 플랜',
    monthlyPrice: '₩89,000',
    annualPrice: '₩71,000',
    originalMonthlyWhenAnnual: '₩89,000',
    priceSub: '월 정액',
    cta: '현재 플랜',
    ctaStyle: 'current',
    features: [
      { text: '스타터 모든 기능 포함' },
      { text: '모델 선택 (내장/외부 LLM · 글로벌 2단계 옵트인)' },
      { text: '전체 MCP 커넥터 연결' },
      { text: '검증 기준값 · 자가검증 · 이상 감지' },
      { text: '쓰기 전 미리보기 · 사용자 승인 게이트' },
      { text: '스케줄 자동 실행' },
      { text: '멤버 최대 50명' },
      { text: '우선 지원' },
    ],
  },
  {
    key: 'business',
    name: '비즈니스',
    monthlyPrice: '₩150,000',
    annualPrice: '₩120,000',
    originalMonthlyWhenAnnual: '₩150,000',
    priceSub: '월 정액',
    cta: '비즈니스로 변경',
    ctaStyle: 'outline',
    features: [
      { text: '프로 모든 기능 포함' },
      { text: '조직 단위 거버넌스' },
      { text: '역할별 권한 매트릭스' },
      { text: '팀 협업 (공유·공동 편집)' },
      { text: '멤버 대규모' },
      { text: '전담 온보딩' },
      { text: 'SSO · 설치형 (엔터부터)', muted: true },
    ],
  },
  {
    key: 'enterprise',
    name: '엔터프라이즈',
    monthlyPrice: null,
    annualPrice: null,
    priceSub: '영업팀 문의',
    cta: '문의하기',
    ctaStyle: 'primary',
    features: [
      { text: '비즈니스 모든 기능 포함' },
      { text: '설치형(On-premise) · 프라이빗 클라우드' },
      { text: 'SSO (SAML 2.0) · SCIM' },
      { text: '테넌트 격리 (전용 스토리지·KMS·작업 기록부)' },
      { text: '전담 고객 성공 매니저 · SLA 보장' },
      { text: 'MCP 커스텀 연동' },
      { text: '사용량 기반 견적 · 규제 산업 적합 (금융·의료)' },
    ],
  },
]

// ── 플랜 변경 모달 ────────────────────────────────────────────

function PlanModal({ onClose }: { onClose: () => void }) {
  const [annual, setAnnual] = useState(false)

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-background-surface)',
          borderRadius: 'var(--radius-container)',
          width: '100%', maxWidth: 1080,
          maxHeight: '90vh', overflowY: 'auto',
          padding: '40px 40px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 18,
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-background-muted)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          <AstryxIcon icon={X} size="sm" color="secondary" strokeWidth={2} />
        </button>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 6 }}>
            플랜을 선택해 주세요
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
            조직 규모와 필요에 맞는 플랜을 선택하세요.
          </div>
        </div>

        {/* 월간 / 연간 토글 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-background-muted)',
            fontSize: 14, fontFamily: 'inherit',
          }}>
            <span style={{ color: !annual ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: !annual ? 600 : 400 }}>
              월간 결제
            </span>
            {/* 토글 스위치 */}
            <button
              onClick={() => setAnnual(v => !v)}
              style={{
                width: 40, height: 22, borderRadius: 'var(--radius-full)',
                background: annual ? 'var(--color-status-active)' : 'var(--color-border-emphasized)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: annual ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }} />
            </button>
            <span style={{ color: annual ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: annual ? 600 : 400 }}>
              연간 결제
            </span>
            {annual && (
              <span style={{
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: '#dcfce7', color: 'var(--color-status-active)',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              }}>
                20% 절약
              </span>
            )}
          </div>
        </div>

        {/* 플랜 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.ctaStyle === 'current'
            const price = annual ? plan.annualPrice : plan.monthlyPrice

            return (
              <div
                key={plan.key}
                style={{
                  borderRadius: 16, padding: 24,
                  border: isCurrent
                    ? '2px solid var(--color-accent)'
                    : '1.5px solid var(--color-border)',
                  background: 'var(--color-background-surface)',
                  display: 'flex', flexDirection: 'column', gap: 0,
                  position: 'relative',
                }}
              >
                {/* 배지 */}
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    padding: '3px 12px', borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent)', color: 'var(--color-on-accent)',
                    fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}

                {/* 플랜명 */}
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 10 }}>
                  {plan.name}
                </div>

                {/* 가격 */}
                <div style={{ marginBottom: 4 }}>
                  {price !== null ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1 }}>
                        {price}
                      </span>
                      {annual && plan.originalMonthlyWhenAnnual && (
                        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'line-through', fontFamily: 'inherit' }}>
                          {plan.originalMonthlyWhenAnnual}
                        </span>
                      )}
                      {price !== '₩0' && (
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>/월</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'inherit', lineHeight: 1 }}>
                      맞춤 견적
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 20 }}>
                  {plan.priceSub}
                </div>

                {/* CTA 버튼 */}
                <button
                  disabled={isCurrent}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 'var(--radius-full)', marginBottom: 20,
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'opacity 0.15s',
                    ...(isCurrent
                      ? { background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }
                      : plan.ctaStyle === 'primary'
                        ? { background: '#111', border: 'none', color: '#fff' }
                        : { background: 'var(--color-background-surface)', border: '1.5px solid var(--color-border-emphasized)', color: 'var(--color-text-primary)' }
                    ),
                  }}
                >
                  {plan.cta}
                </button>

                {/* 기능 목록 */}
                <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 16 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <span style={{ color: f.muted ? 'var(--color-border-emphasized)' : 'var(--color-status-active)', flexShrink: 0, marginTop: 2, display: 'flex' }}>
                        <AstryxIcon icon={Check} size="sm" color="inherit" strokeWidth={2.5} />
                      </span>
                      <span style={{
                        fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
                        color: f.muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                        textDecoration: f.muted ? 'line-through' : 'none',
                      }}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* 하단 보안 문구 */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
          모든 플랜은 안전한 클라우드 인프라로 운영됩니다. 데이터는 AES-256으로 암호화되며 전송 구간은 TLS 1.3을 적용합니다.
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── PG 결제 모달 ──────────────────────────────────────────────

type PayType = 'card' | 'phone'
const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰']

function PgModal({ payType, onClose }: { payType: PayType; onClose: () => void }) {
  const [cardNum, setCardNum] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [phone, setPhone] = useState('')
  const [carrier, setCarrier] = useState('SKT')
  const [done, setDone] = useState(false)

  const pgInput: React.CSSProperties = {
    width: '100%', padding: '11px 18px', borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--color-border-emphasized)',
    background: 'var(--color-background-surface)', color: 'var(--color-text-primary)',
    fontSize: 15, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
          overflow: 'hidden', fontFamily: 'inherit',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* PG 헤더 */}
        <div style={{ background: '#0f172a', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              Secure Payment
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
              {payType === 'card' ? '카드 결제' : '휴대폰 결제'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>결제 금액</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>₩135,000</div>
          </div>
        </div>

        {/* 결제 금액 설명 */}
        <div style={{ padding: '14px 24px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Byr 프로 플랜</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>2026년 8월 정기 결제</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
              <path d="M6 0L11.196 3V9L6 12L0.804 9V3L6 0Z" fill="#22c55e" opacity="0.2"/>
              <path d="M6 1.732L9.928 4V9L6 11.268L2.072 9V4L6 1.732Z" stroke='var(--color-status-active)' strokeWidth="1.5"/>
              <path d="M4 7L5.5 8.5L8 5.5" stroke='var(--color-status-active)' strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--color-status-active)', fontWeight: 600 }}>SSL 보안</span>
          </div>
        </div>

        {/* 폼 */}
        <div style={{ padding: '24px' }}>
          {!done ? (
            <>
              {payType === 'card' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>카드 번호</label>
                    <input value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="0000  0000  0000  0000" style={pgInput} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>카드 소유자명</label>
                    <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="홍길동" style={pgInput} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>유효기간</label>
                      <input value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM / YY" style={pgInput} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>CVC</label>
                      <input value={cvc} onChange={e => setCvc(e.target.value)} placeholder="•••" type="password" style={pgInput} />
                    </div>
                  </div>
                </div>
              )}

              {payType === 'phone' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>통신사</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {CARRIERS.map(c => (
                        <button key={c} onClick={() => setCarrier(c)} style={{
                          flex: 1, padding: '9px 0', borderRadius: 'var(--radius-inner)',
                          border: `1.5px solid ${carrier === c ? '#0f172a' : '#d1d5db'}`,
                          background: carrier === c ? '#0f172a' : '#fff',
                          color: carrier === c ? '#fff' : '#374151',
                          fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>휴대폰 번호</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" type="tel" style={pgInput} />
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-inner)', background: '#fefce8', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                      입력하신 번호로 인증 문자가 발송됩니다. 수신된 인증번호를 다음 화면에서 입력해 주세요.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button
                  onClick={() => setDone(true)}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 10,
                    background: '#0f172a', border: 'none', color: '#fff',
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  결제하기
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: '13px 20px', borderRadius: 10,
                    border: '1px solid #d1d5db', background: '#fff', color: '#374151',
                    fontSize: 15, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
              </div>
            </>
          ) : (
            /* 완료 상태 */
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke='var(--color-status-active)' strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>결제 수단 등록 완료</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
                새 결제 수단이 등록되었습니다.<br />다음 결제일부터 적용됩니다.
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: '#0f172a', border: 'none', color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                확인
              </button>
            </div>
          )}
        </div>

        {/* PG 하단 */}
        <div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="5" width="10" height="6" rx="1" stroke="var(--color-text-disabled)" strokeWidth="1.2"/>
            <path d="M4 5V3.5C4 2.12 4.89 1 6 1C7.11 1 8 2.12 8 3.5V5" stroke="var(--color-text-disabled)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>보안 결제 시스템 · PCI DSS 인증</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── 결제 수단 변경 모달 ───────────────────────────────────────

function PaymentChangeModal({ onClose }: { onClose: () => void }) {
  const [payType, setPayType] = useState<PayType>('card')
  const [pgOpen, setPgOpen] = useState(false)

  const typeBtn = (type: PayType, Icon: React.ElementType, label: string, desc: string) => (
    <button
      onClick={() => setPayType(type)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '16px 12px', borderRadius: 'var(--radius-element)',
        border: `2px solid ${payType === type ? 'var(--color-accent)' : 'var(--color-border-emphasized)'}`,
        background: payType === type ? 'var(--color-background-muted)' : 'var(--color-background-surface)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <Icon size={22} strokeWidth={1.8} color={payType === type ? 'var(--color-accent)' : 'var(--color-icon-secondary)'} />
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.4 }}>{desc}</span>
    </button>
  )

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-background-surface)', borderRadius: 'var(--radius-container)',
          width: 480, maxWidth: '100%',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '24px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>결제 수단 변경</div>
          <button onClick={onClose} style={{ background: 'var(--color-background-muted)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AstryxIcon icon={X} size="xsm" color="secondary" strokeWidth={2} />
          </button>
        </div>

        {/* 바디 */}
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginBottom: 14 }}>
            결제 방식을 선택해 주세요
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {typeBtn('card', CreditCard, '카드 결제', '신용카드·체크카드')}
            {typeBtn('phone', Smartphone, '휴대폰 결제', '소액결제 (월 30만원 한도)')}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: '1.5px solid #e5e5e5', background: 'white', fontSize: 14, fontWeight: 500, color: '#525252', cursor: 'pointer', fontFamily: 'inherit' }}>
            취소
          </button>
          <button onClick={() => setPgOpen(true)} style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', background: '#1a1a1a', fontSize: 14, fontWeight: 600, color: 'var(--color-on-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
            결제 진행
          </button>
        </div>
      </div>
      {pgOpen && <PgModal payType={payType} onClose={() => { setPgOpen(false); onClose() }} />}
    </div>,
    document.body
  )
}

// ── 타입 ─────────────────────────────────────────────────────

type BillingTab = 'invoice' | 'scheduled' | 'method'

const INVOICES = [
  { id: 'INV-2026-06', date: '2026-06-01', amount: '₩135,000', status: '결제 완료', plan: '프로 플랜' },
  { id: 'INV-2026-05', date: '2026-05-01', amount: '₩135,000', status: '결제 완료', plan: '프로 플랜' },
  { id: 'INV-2026-04', date: '2026-04-01', amount: '₩135,000', status: '결제 완료', plan: '프로 플랜' },
]

// ── 메인 ─────────────────────────────────────────────────────

export default function Billing() {
  const [tab, setTab] = useState<BillingTab>('invoice')
  const [changeOpen, setChangeOpen] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)

  return (
    <>
    <VStack gap={6} style={{ padding: '32px 40px', maxWidth: 800 }}>
      <VStack gap={1}>
        <Heading level={2}>플랜 · 결제 관리</Heading>
        <Text type="body" color="secondary">
          정액제 구독 관리, 인보이스 조회, 결제 수단을 여기서 관리합니다.
        </Text>
      </VStack>

      {/* 현재 플랜 — 블랙 카드 */}
      <div style={{ borderRadius: 16, background: '#000', padding: 24, width: '100%', boxSizing: 'border-box' }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, paddingBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', fontFamily: 'inherit' }}>현재 플랜</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
              background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(22,163,74,0.35)',
              fontSize: 12, fontWeight: 600, color: '#4ade80', fontFamily: 'inherit',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
              구독 중
            </div>
            {/* 플랜 변경 버튼 */}
            <button
              onClick={() => setPlanModalOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '5px 14px', borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              플랜 변경
            </button>
          </div>
        </div>

        {/* 정액제 설명 */}
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', fontFamily: 'inherit', marginBottom: 3 }}>
            정액제 무제한 (Flat-rate unlimited)
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', lineHeight: 1.6 }}>
            월 고정 요금으로 에이전트 실행 횟수·토큰 사용량에 관계없이 추가 청구가 없습니다.
          </div>
        </div>

        {/* 지표 */}
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          {[
            { label: '플랜',       value: '프로 플랜' },
            { label: '월 요금',    value: '₩135,000' },
            { label: '다음 결제일', value: '2026-08-01' },
            { label: '회사·조직',  value: 'Company Inc.' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', fontFamily: 'inherit' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TabList value={tab} onChange={v => setTab(v as BillingTab)} aria-label="빌링 탭" hasDivider>
        <Tab value="invoice" label="인보이스" />
        <Tab value="scheduled" label="결제 예정" />
        <Tab value="method" label="결제 수단" />
      </TabList>

      {/* 인보이스 */}
      {tab === 'invoice' && (
        <VStack gap={3}>
          {INVOICES.map(inv => (
            <Card key={inv.id} width="100%">
              <div className="m-wrap">
              <HStack hAlign="between" vAlign="center">
                <VStack gap={0}>
                  <Text type="large">{inv.id}</Text>
                  <Text type="supporting" color="secondary">{inv.date} · {inv.plan}</Text>
                </VStack>
                <HStack gap={3} vAlign="center">
                  <Text type="body">{inv.amount}</Text>
                  <StatusBadge label={inv.status} variant="success" />
                  <OutlineBtn label="PDF 다운로드" size="sm" />
                </HStack>
              </HStack>
              </div>
            </Card>
          ))}
        </VStack>
      )}

      {/* 결제 예정 */}
      {tab === 'scheduled' && (
        <Card width="100%">
          <VStack gap={3}>
            <Banner
              status="info"
              title="다음 결제 예정: 2026-08-01"
              description="결제 3일 전 등록된 이메일로 안내 메일을 발송합니다."
            />
            <HStack hAlign="between" vAlign="center">
              <VStack gap={0}>
                <Text type="label" color="secondary">청구 항목</Text>
                <Text type="body">프로 플랜 (2026년 8월)</Text>
              </VStack>
              <Text type="large">₩135,000</Text>
            </HStack>
            <HStack hAlign="between" vAlign="center">
              <Text type="body" color="secondary">결제 수단</Text>
              <Text type="body">신한카드 ****-1234</Text>
            </HStack>
            <div style={{ alignSelf: 'flex-start' }}>
              <DangerBtn label="구독 취소" />
            </div>
          </VStack>
        </Card>
      )}

      {/* 결제 수단 */}
      {tab === 'method' && (
        <VStack gap={3}>
          <Card width="100%">
            <HStack hAlign="between" vAlign="center">
              <HStack gap={3} vAlign="center">
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'var(--color-background-muted)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AstryxIcon icon={CreditCard} size="md" color="secondary" strokeWidth={1.8} />
                </div>
                <VStack gap={0}>
                  <Text type="large">신한카드 ****-1234</Text>
                  <Text type="supporting" color="secondary">카드 · 만료 2028-09 · 기본 결제 수단</Text>
                </VStack>
              </HStack>
              <HStack gap={2} vAlign="center">
                <StatusBadge label="기본" variant="neutral" />
                <OutlineBtn label="삭제" size="sm" />
              </HStack>
            </HStack>
          </Card>

          <div>
            <OutlineBtn label="결제 수단 변경" onClick={() => setChangeOpen(true)} />
          </div>
          {changeOpen && <PaymentChangeModal onClose={() => setChangeOpen(false)} />}

          <Banner
            status="info"
            title="지원 결제 수단"
            description="신용카드·체크카드 및 휴대폰 소액결제 2가지를 지원합니다. 계좌이체·가상계좌는 미지원입니다."
          />
        </VStack>
      )}
    </VStack>

    {/* 플랜 변경 모달 */}
    {planModalOpen && <PlanModal onClose={() => setPlanModalOpen(false)} />}
    </>
  )
}
