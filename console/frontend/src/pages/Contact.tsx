/* ── 도입 상담 ──────────────────────────────────────────────────
 * 랜딩(byr-homepage)의 「도입 상담 받기」가 여기로 온다.
 * 골격 = Astryx 템플릿 `form-two-column`
 *   (npx @astryxdesign/cli template form-two-column):
 *   상단 2열 — 왼쪽 문구+이미지, 오른쪽 카드 폼 / 하단 3열 안내 스트립.
 * 연락처 이메일은 아직 정해진 값이 없어 지어내지 않고, 하단 스트립은
 * 이미 있는 페이지(가이드·요금·고객센터)로 보낸다.
 * ---------------------------------------------------------------- */

import { useState, type CSSProperties } from 'react'
import { VStack, HStack } from '@astryxdesign/core/Stack'
import { Center } from '@astryxdesign/core/Center'
import { Section } from '@astryxdesign/core/Section'
import { Grid } from '@astryxdesign/core/Grid'
import { Button } from '@astryxdesign/core/Button'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Token } from '@astryxdesign/core/Token'
import { Link } from '@astryxdesign/core/Link'
import { Divider } from '@astryxdesign/core/Divider'
import { Card } from '@astryxdesign/core/Card'
import { Banner } from '@astryxdesign/core/Banner'
import { Selector } from '@astryxdesign/core/Selector'
import { BrandMark } from '../components/BrandMark'
import { UnsplashImage } from '../components/UnsplashImage'

/* 배포 시 Vercel 환경변수로 주입한다(VITE_LANDING_URL). 없으면 로컬 서버 */
const LANDING = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:8960'

const REASONS = [
  '도입 검토',
  '요금·견적',
  '보안 검토',
  '설치형(프라이빗) 문의',
  '기존 도구 연동',
  '기타',
]

const TEAM_SIZES = ['1~9명', '10~49명', '50~199명', '200~999명', '1,000명 이상']

const NEXT_LINKS = [
  { label: '먼저 둘러보기', text: '서비스 가이드', href: '/guide' },
  { label: '요금이 궁금하면', text: '요금 안내', href: `${LANDING}/#pricing` },
  { label: '사용 중 문제가 있으면', text: '고객센터', href: `${LANDING}/support/` },
]

/** 사진을 못 받았을 때 쓰는 대체 면(모노톤) */
const FALLBACK = 'linear-gradient(140deg, #1B1B1D 0%, #4A4A50 100%)'

const pageStyle: CSSProperties = { minHeight: '100%' }
const brandBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  color: 'inherit',
}

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const missing = {
    name: !name.trim(),
    email: !email.trim(),
    details: !details.trim(),
  }
  const done = submitted && !missing.name && !missing.email && !missing.details
  const errors = submitted
    ? {
        name: missing.name ? '입력해 주세요' : undefined,
        email: missing.email ? '입력해 주세요' : undefined,
        details: missing.details ? '입력해 주세요' : undefined,
      }
    : {}

  return (
    <Center style={pageStyle}>
      <Section maxWidth={1100} width="100%" padding={10} variant="transparent">
        <VStack gap={10}>
          <a href={`${LANDING}/`} style={brandBar}>
            <BrandMark size={24} />
            <Text type="supporting" color="secondary">Byr 홈</Text>
          </a>

          {/* 2열 — 520px 아래에서 1열로 */}
          <Grid columns={{ minWidth: 320 }} align="center" gap={10}>
            <VStack gap={6}>
              <VStack gap={3}>
                <Text type="display-1" as="h1">
                  도입 상담
                </Text>
                <Text type="body" color="secondary">
                  어떤 업무를 맡기고 싶은지 적어 주시면, 팀 규모와 연동 환경에 맞는 구성을
                  정리해 회신드립니다. 설치형(프라이빗) 검토도 여기로 남겨 주세요.
                </Text>
              </VStack>
              <UnsplashImage
                query="team meeting discussion office"
                width={1000}
                ratio="4 / 3"
                fallback={FALLBACK}
                alt="도입 상담"
                radius={12}
              />
            </VStack>

            <Card padding={8}>
              <VStack gap={4}>
                {done ? (
                  <Banner
                    status="success"
                    title="상담 요청이 접수되었습니다"
                    description="입력하신 이메일로 회신드립니다."
                  />
                ) : null}
                <Text type="label">연락처</Text>
                <TextInput
                  label="이름"
                  isLabelHidden
                  placeholder="이름*"
                  value={name}
                  onChange={setName}
                  status={errors.name ? { type: 'error', message: errors.name } : undefined}
                />
                <Grid columns={{ minWidth: 180 }} gap={3}>
                  <TextInput
                    label="이메일"
                    isLabelHidden
                    placeholder="회사 이메일*"
                    value={email}
                    onChange={setEmail}
                    status={errors.email ? { type: 'error', message: errors.email } : undefined}
                  />
                  <TextInput
                    label="회사명"
                    isLabelHidden
                    placeholder="회사명"
                    value={company}
                    onChange={setCompany}
                  />
                </Grid>
                <Grid columns={{ minWidth: 180 }} gap={3}>
                  <TextInput
                    label="직무"
                    isLabelHidden
                    placeholder="직무"
                    value={jobTitle}
                    onChange={setJobTitle}
                  />
                  <TextInput
                    label="연락처"
                    isLabelHidden
                    placeholder="연락처"
                    value={phone}
                    onChange={setPhone}
                  />
                </Grid>

                <VStack gap={2}>
                  <Text type="label">어떤 내용으로 연락 주셨나요?</Text>
                  <HStack gap={2} wrap="wrap">
                    {REASONS.map(r => (
                      <Token
                        key={r}
                        label={r}
                        color={reason === r ? 'blue' : 'default'}
                        onClick={() => setReason(prev => (prev === r ? '' : r))}
                      />
                    ))}
                  </HStack>
                </VStack>

                <Selector
                  label="팀 규모"
                  options={TEAM_SIZES}
                  value={teamSize}
                  onChange={setTeamSize}
                  placeholder="팀 규모를 골라 주세요..."
                />
                {/* 여러 줄 입력란만 8px — 알약 모양이면 모서리 쪽 글자가 잘린다. main.tsx 의 .contact-request 규칙 */}
                <div className="contact-request">
                  <TextArea
                    label="맡기고 싶은 업무"
                    isLabelHidden
                    placeholder="맡기고 싶은 업무와 쓰고 있는 도구를 적어 주세요*"
                    value={details}
                    onChange={setDetails}
                    status={errors.details ? { type: 'error', message: errors.details } : undefined}
                  />
                </div>
                {/* hAlign="stretch" = 버튼 전체 폭(Button 에 full-width prop 없음) */}
                <VStack hAlign="stretch">
                  <Button label="상담 요청 보내기" variant="primary" onClick={() => setSubmitted(true)} />
                </VStack>
              </VStack>
            </Card>
          </Grid>

          {/* 하단 안내 스트립 */}
          <VStack gap={6}>
            <Divider />
            <Grid columns={{ minWidth: 200 }} gap={6}>
              {NEXT_LINKS.map(col => (
                <VStack key={col.text} gap={1} hAlign="center">
                  <Text type="supporting" color="secondary">
                    {col.label}
                  </Text>
                  <Link href={col.href} type="body" size="sm">
                    {col.text}
                  </Link>
                </VStack>
              ))}
            </Grid>
          </VStack>
        </VStack>
      </Section>
    </Center>
  )
}
