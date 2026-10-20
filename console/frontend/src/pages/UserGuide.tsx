import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Divider } from '@astryxdesign/core/Divider'
import { CodeBlock } from '@astryxdesign/core/CodeBlock'
import { Card } from '@astryxdesign/core/Card'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Sparkles, Copy, Bot, Store, Settings, Shield, Zap, Database, ChevronRight } from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'

// ── 목차 항목 ─────────────────────────────────────────────────

interface OutlineItem { id: string; label: string; level: 2 | 3 }

const OUTLINE: OutlineItem[] = [
  { id: 'overview',    label: 'Byr란?',           level: 2 },
  { id: 'studio',      label: '내 에이전트',         level: 2 },
  { id: 'create',      label: '에이전트 만들기',          level: 2 },
  { id: 'skills',      label: '스킬 설정',               level: 2 },
  { id: 'mcp',         label: 'MCP 커넥터',              level: 2 },
  { id: 'marketplace', label: '마켓플레이스',             level: 2 },
  { id: 'security',    label: '보안 및 권한',             level: 2 },
]

// ── 목차 사이드바 ──────────────────────────────────────────────

function OutlineNav({ items, activeId, onSelect }: {
  items: OutlineItem[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <nav className="m-guide__toc" style={{ position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'inherit' }}>
        이 페이지에서
      </div>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '5px 0 5px 12px', marginBottom: 2,
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13,
            color: activeId === item.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: activeId === item.id ? 600 : 400,
            borderLeft: `2px solid ${activeId === item.id ? 'var(--color-accent)' : 'transparent'}`,
            transition: 'color 0.12s, border-color 0.12s',
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

// ── 섹션 헤딩 ─────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24 }}>
      <VStack gap={4}>
        <Heading level={2}>{title}</Heading>
        {children}
      </VStack>
    </section>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export default function UserGuide() {
  const [activeId, setActiveId] = useState('overview')
  const [copied, setCopied] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  const scrollToSection = useCallback((id: string) => {
    setActiveId(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    OUTLINE.forEach(item => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(
      'Byr 서비스 가이드를 기반으로 에이전트를 설정해줘. 1) 에이전트 이름과 역할을 정해줘. 2) 적합한 스킬을 추천해줘. 3) 필요한 MCP 커넥터를 알려줘.'
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="m-guide" style={{ display: 'flex', gap: 48, padding: '40px 40px 80px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── 메인 콘텐츠 ── */}
      <div ref={mainRef} style={{ flex: 1, minWidth: 0 }}>
        <VStack gap={8}>

          {/* 헤더 */}
          <VStack gap={2}>
            <Text type="display-1" style={{ fontWeight: 800 }}>서비스 가이드</Text>
            <Text type="supporting" color="secondary">Byr Agentic AI 플랫폼 사용 안내</Text>
          </VStack>

          {/* AI 어시스턴트 프롬프트 카드 */}
          <Card>
            <VStack gap={3}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <AstryxIcon icon={Sparkles} size="sm" color="secondary" strokeWidth={1.8} />
                  <Text type="body" style={{ fontWeight: 600 }}>AI 어시스턴트에게 도움 받기</Text>
                </HStack>
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 'var(--radius-inner)',
                    border: '1px solid var(--color-border)', background: 'var(--color-background-muted)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <AstryxIcon icon={Copy} size="sm" strokeWidth={2} />
                  {copied ? '복사됨!' : '프롬프트 복사'}
                </button>
              </HStack>
              <Text type="body" color="secondary">
                Byr 서비스 가이드를 기반으로 에이전트를 설정해줘. 1) 에이전트 이름과 역할을 정해줘. 2) 적합한 스킬을 추천해줘. 3) 필요한 MCP 커넥터를 알려줘.
              </Text>
            </VStack>
          </Card>

          {/* ── 섹션 1: Byr란? ── */}
          <Section id="overview" title="Byr란?">
            <Text type="body">
              Byr는 L3 Agentic AI 플랫폼입니다. 업무별 AI 에이전트를 생성하고, 스킬과 외부 시스템(MCP)을 연결하여 반복 업무를 자동화합니다. 재무 대사, 월마감 보고서, CS 응대, 개발 자동화 등 다양한 업무에 적용할 수 있습니다.
            </Text>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            }}>
              {[
                { icon: Bot, title: '내 에이전트', desc: '업무 에이전트를 생성하고 스킬·MCP를 설정합니다.' },
                { icon: Store, title: '마켓플레이스', desc: '검증된 에이전트 템플릿과 MCP 커넥터를 탐색합니다.' },
                { icon: Shield, title: '조직 보안', desc: '모델은 사내에서만 실행되며 데이터가 외부로 나가지 않습니다.' },
              ].map(item => (
                <div key={item.title} style={{
                  padding: 16, borderRadius: 'var(--radius-element)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-background-muted)',
                }}>
                  <item.icon size={20} strokeWidth={1.8} color="var(--color-icon-primary)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, fontFamily: 'inherit', color: 'var(--color-text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, fontFamily: 'inherit' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Divider />

          {/* ── 섹션 2: 내 에이전트 ── */}
          <Section id="studio" title="내 에이전트">
            <Text type="body">
              내 에이전트은 조직 내 AI 에이전트를 생성·관리하는 공간입니다. 좌측 내비게이션에서 <strong>내 에이전트</strong>을 선택하면 현재 생성된 에이전트 목록을 확인할 수 있습니다.
            </Text>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>에이전트 상태</Text>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {[
                  { status: '활성', color: 'var(--color-status-active)', desc: '배포(Deployment)가 완료되어 실제로 업무를 수행 중인 에이전트입니다.' },
                  { status: '초안', color: '#d97706', desc: '설정이 완료되지 않았거나 아직 배포되지 않은 에이전트입니다.' },
                  { status: '오류', color: 'var(--color-error)', desc: 'MCP 연결 오류 또는 모델 오류로 인해 동작하지 않는 상태입니다.' },
                ].map((item, i) => (
                  <div key={item.status} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
                      background: item.color + '18', color: item.color, fontFamily: 'inherit',
                    }}>{item.status}</span>
                    <Text type="supporting" color="secondary">{item.desc}</Text>
                  </div>
                ))}
              </div>
            </VStack>
          </Section>

          <Divider />

          {/* ── 섹션 3: 에이전트 만들기 ── */}
          <Section id="create" title="에이전트 만들기">
            <Text type="body">
              내 에이전트 상단의 <strong>+ 에이전트 만들기</strong> 버튼을 클릭하거나, 마켓플레이스에서 템플릿을 선택하여 에이전트를 생성합니다.
            </Text>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>빈 에이전트 생성 (3단계)</Text>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {[
                  { step: '1', title: '기본 정보', desc: '에이전트 이름과 말투(정중 / 간결·팩트 / 친근, 복수 선택)를 설정합니다.' },
                  { step: '2', title: '스킬 선택', desc: '에이전트가 수행할 스킬을 카테고리별로 선택합니다.' },
                  { step: '3', title: '업무 채널 배치', desc: '에이전트가 응답할 Slack·Dooray 등 메신저 채널을 배치합니다.' },
                ].map((item, i) => (
                  <div key={item.step} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: '#1a1a1a', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
                    }}>{item.step}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: 'var(--color-text-primary)', marginBottom: 3 }}>{item.title}</div>
                      <Text type="supporting" color="secondary">{item.desc}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </VStack>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>템플릿으로 빠르게 시작하기 (2단계)</Text>
              <Text type="body" color="secondary">
                마켓플레이스에서 템플릿을 선택하면 이름과 스킬이 미리 채워집니다. <strong>기본 확인</strong> 단계에서 이름·스킬을 검토한 후, <strong>MCP 연결</strong> 단계만 진행하면 됩니다.
              </Text>
            </VStack>
          </Section>

          <Divider />

          {/* ── 섹션 4: 스킬 설정 ── */}
          <Section id="skills" title="스킬 설정">
            <Text type="body">
              스킬은 에이전트가 수행할 수 있는 개별 기능 단위입니다. 에이전트 상세 페이지에서 언제든 스킬을 추가·제거할 수 있습니다.
            </Text>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>카테고리별 주요 스킬</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { cat: '재무·회계', skills: '부가세 대사, 전표 처리, 세금계산서 조회, 월마감 보고서' },
                  { cat: '기획/PM', skills: '문서 요약, 회의록 정리, 경쟁사 리서치, 기획서 초안' },
                  { cat: '개발·운영', skills: '로그 분석, 이상 알림, 배포 현황, PR 리뷰 요약' },
                  { cat: '영업·CS', skills: 'CS 문의 분류, 답변 초안, 영업 현황 리포트' },
                  { cat: '인사·총무', skills: '근태 요약, 채용 공고 초안, 급여 명세 요약' },
                  { cat: '마케팅', skills: '콘텐츠 초안, SNS 게시물, 마케팅 리포트, 키워드 분석' },
                ].map(item => (
                  <div key={item.cat} style={{
                    padding: '12px 14px', borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background-muted)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 5, fontFamily: 'inherit' }}>{item.cat}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, fontFamily: 'inherit' }}>{item.skills}</div>
                  </div>
                ))}
              </div>
            </VStack>
          </Section>

          <Divider />

          {/* ── 섹션 5: MCP 커넥터 ── */}
          <Section id="mcp" title="MCP 커넥터">
            <Text type="body">
              MCP(Model Context Protocol)는 에이전트가 외부 시스템과 연동할 수 있게 해주는 표준 프로토콜입니다. 연결된 MCP를 통해 에이전트는 ERP에서 데이터를 읽거나, Slack으로 알림을 보내는 등 실제 업무 시스템과 상호작용할 수 있습니다.
            </Text>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>연결 가능한 주요 시스템</Text>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {[
                  { name: '국세청 홈택스', cat: '금융', desc: '전자세금계산서 발행·조회 데이터를 에이전트에 연결합니다.' },
                  { name: 'GitHub', cat: '개발', desc: 'PR, 커밋, 코드 변경 추적 등 개발 자동화에 활용합니다.' },
                  { name: 'Slack', cat: '메신저', desc: '에이전트 결과물과 알림을 지정 채널로 자동 발송합니다.' },
                  { name: 'Google Workspace', cat: '생산성', desc: 'Drive, Docs, Sheets와 에이전트를 연동합니다.' },
                  { name: 'Jira', cat: '개발', desc: '이슈 생성·업데이트·스프린트 리포트를 자동화합니다.' },
                ].map((item, i) => (
                  <div key={item.name} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{item.name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', fontFamily: 'inherit',
                        }}>{item.cat}</span>
                      </div>
                      <Text type="supporting" color="secondary">{item.desc}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </VStack>
            <Card>
              <HStack gap={2} vAlign="start">
                <AstryxIcon icon={Database} size="sm" color="secondary" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                <Text type="body" color="secondary">
                  MCP 연결은 조직 관리자(Admin)만 추가·해제할 수 있습니다. 연결된 MCP는 조직에서 선택 가능합니다. 새로운 MCP 연결이 필요하면 관리자에게 요청하세요.
                </Text>
              </HStack>
            </Card>
          </Section>

          <Divider />

          {/* ── 섹션 6: 마켓플레이스 ── */}
          <Section id="marketplace" title="마켓플레이스">
            <Text type="body">
              마켓플레이스에서는 사전 제작된 에이전트 템플릿과 MCP 커넥터를 탐색하고 바로 적용할 수 있습니다.
            </Text>
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>에이전트 템플릿 활용</Text>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {[
                  '계약서 검토, 이력서 스크리닝 등 전문화된 에이전트 템플릿을 제공합니다.',
                  '목록에서 바로 <사용하기>를 클릭하면 HireModal이 열리고 2단계 또는 3단계 설정을 진행합니다.',
                  '템플릿을 클릭하면 상세 설명, 샘플 프롬프트, 스킬, 커넥터 정보를 확인할 수 있습니다.',
                ].map((text, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.55, fontFamily: 'inherit',
                  }}>
                    <AstryxIcon icon={ChevronRight} size="sm" color="secondary" strokeWidth={2} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span dangerouslySetInnerHTML={{ __html: text }} />
                  </div>
                ))}
              </div>
            </VStack>
          </Section>

          <Divider />

          {/* ── 섹션 7: 보안 및 권한 ── */}
          <Section id="security" title="보안 및 권한">
            <Text type="body">
              Byr는 기업 데이터 보안을 최우선으로 설계되었습니다. 모든 AI 모델은 사내 인프라에서 실행되며 사내 문서와 데이터가 외부 모델로 전송되지 않습니다.
            </Text>
            <CodeBlock
              code={`// 에이전트 권한 모델 (개요)
{
  "model":        "로컬 모델 · 정액 무제한",   // 사내 실행
  "file_paths":   ["/재무/원장/매출"],           // 허용 폴더만 접근
  "mcp_tools": {
    "gdrive":     "auto",                        // 자동 승인
    "hometax":    "approve",                     // 매번 승인 필요
    "erp":        "disabled"                     // 사용 안 함
  }
}`}
              language="json"
              width="100%"
            />
            <VStack gap={2}>
              <Text type="body" style={{ fontWeight: 600 }}>역할별 권한</Text>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {[
                  { role: '관리자 (Admin)', perms: 'MCP 연결 추가·해제, 조직 전체 에이전트 관리, 모델 설정 변경' },
                  { role: '일반 사용자', perms: '에이전트 생성·편집·삭제, 스킬 설정, 허용된 MCP 연결 사용' },
                  { role: '뷰어 (Viewer)', perms: '에이전트 목록 조회, 실행 로그 확인 (편집 불가)' },
                ].map((item, i) => (
                  <div key={item.role} style={{
                    padding: '12px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 3, fontFamily: 'inherit' }}>{item.role}</div>
                    <Text type="supporting" color="secondary">{item.perms}</Text>
                  </div>
                ))}
              </div>
            </VStack>
          </Section>

        </VStack>
      </div>

      {/* ── 우측 목차 ── */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <OutlineNav items={OUTLINE} activeId={activeId} onSelect={scrollToSection} />
      </div>
    </div>
  )
}
