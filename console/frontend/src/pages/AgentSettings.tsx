import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Switch } from '@astryxdesign/core/Switch'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Badge } from '@astryxdesign/core/Badge'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Banner } from '@astryxdesign/core/Banner'

interface Capability {
  web_search: boolean; data_analysis: boolean; report_gen: boolean
  file_access: boolean; global_llm: boolean
}
interface Agent {
  id: string; name: string; role_preset: string; tone: string
  boundary: string; capability: Capability; status: string; channel?: string
}

const ROLE_PRESETS = ['회계·재무', '경영지원', '인사·총무', '영업·마케팅', '개발·기술']
const TONES = ['정중', '간결·팩트', '친근']
const CAP_META: { key: keyof Capability; label: string; desc?: string }[] = [
  { key: 'web_search',    label: '웹 검색' },
  { key: 'data_analysis', label: '데이터 분석' },
  { key: 'report_gen',    label: '보고서 생성' },
  { key: 'file_access',   label: '파일 접근' },
  { key: 'global_llm',    label: '글로벌 LLM (옵트인)', desc: 'Admin이 글로벌 LLM 설정에서 API 키를 먼저 등록해야 합니다 (D-16)' },
]
const CHANNELS = ['Slack', 'Discord', 'Telegram']

const EMPTY: Agent = {
  id: '', name: '', role_preset: '회계·재무', tone: '전문적',
  boundary: '', capability: { web_search: false, data_analysis: true, report_gen: true, file_access: true, global_llm: false },
  status: 'draft',
}

export default function AgentSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const [form, setForm] = useState<Agent>(EMPTY)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isNew) fetch(`/api/agents/${id}`).then(r => r.json()).then(setForm)
  }, [id, isNew])

  const setField = (k: keyof Agent, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const setCap = (k: keyof Capability, v: boolean) =>
    setForm(f => ({ ...f, capability: { ...f.capability, [k]: v } }))

  const save = async () => {
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/agents' : `/api/agents/${id}`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaved(true)
    setTimeout(() => { setSaved(false); navigate('/agents') }, 1200)
  }

  const activate = async () => {
    await fetch(`/api/agents/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'active' }),
    })
    navigate('/agents')
  }

  return (
    <VStack gap={5} style={{ padding: '32px 40px', maxWidth: 680 }}>
      <Button label="← 에이전트 목록" variant="ghost" size="sm" onClick={() => navigate('/agents')} />

      <Heading level={2}>{isNew ? '새 에이전트 만들기' : '에이전트 설정'}</Heading>

      {saved && (
        <Banner status="success" title="저장됐습니다" description="잠시 후 목록으로 이동합니다." />
      )}

      {/* 정체성 구획 — SwitchSettingsPanel / FormLayout 패턴 */}
      <Card width="100%">
        <VStack gap={4}>
          <VStack gap={0}>
            <Heading level={4}>정체성 구획</Heading>
            <Text type="supporting" color="secondary">역할·말투·경계를 설정합니다.</Text>
          </VStack>

          <FormLayout>
            <TextInput
              label="에이전트 이름"
              value={form.name}
              onChange={v => setField('name', v)}
              placeholder="예: 부가세 대사 에이전트"
              width="100%"
            />
          </FormLayout>

          <VStack gap={2}>
            <Text type="label">역할 프리셋</Text>
            <HStack gap={2} style={{ flexWrap: 'wrap' }}>
              {ROLE_PRESETS.map(r => (
                <Button key={r} label={r}
                  variant={form.role_preset === r ? 'primary' : 'secondary'}
                  size="sm" onClick={() => setField('role_preset', r)} />
              ))}
            </HStack>
          </VStack>

          <VStack gap={2}>
            <Text type="label">말투</Text>
            <HStack gap={2} style={{ flexWrap: 'wrap' }}>
              {TONES.map(t => (
                <Button key={t} label={t}
                  variant={form.tone === t ? 'primary' : 'secondary'}
                  size="sm" onClick={() => setField('tone', t)} />
              ))}
            </HStack>
          </VStack>

          <FormLayout>
            <TextArea
              label="경계 카드"
              value={form.boundary}
              onChange={v => setField('boundary', v)}
              placeholder="예: 초안 작성까지만. 자동 신고·결제 절대 금지."
              rows={3}
              width="100%"
            />
          </FormLayout>
        </VStack>
      </Card>

      {/* 스킬 구획 — SwitchSettingsPanel 패턴 */}
      <Card width="100%">
        <VStack gap={4}>
          <VStack gap={0}>
            <Heading level={4}>스킬 구획</Heading>
            <Text type="supporting" color="secondary">사용할 스킬을 켜고 끕니다.</Text>
          </VStack>
          {CAP_META.map(({ key, label, desc }) => (
            <Switch key={key} label={label} description={desc}
              value={form.capability[key]} onChange={v => setCap(key, v)}
              labelPosition="start" labelSpacing="spread" width="100%" />
          ))}
        </VStack>
      </Card>

      {/* 채널 배치 */}
      <Card width="100%">
        <VStack gap={3}>
          <VStack gap={0}>
            <Heading level={4}>업무 채널 배치</Heading>
            <Text type="supporting" color="secondary">메신저 채널을 연결합니다.</Text>
          </VStack>
          <HStack gap={2}>
            {CHANNELS.map(ch => (
              <Button key={ch} label={ch}
                variant={form.channel === ch ? 'primary' : 'secondary'}
                size="sm"
                endContent={form.channel === ch ? <Badge variant="info" label="연결됨" /> : undefined}
                onClick={() => setField('channel', form.channel === ch ? undefined : ch)} />
            ))}
          </HStack>
        </VStack>
      </Card>

      <HStack gap={3}>
        <Button label="임시 저장" variant="secondary" onClick={save} />
        {!isNew && form.status === 'draft' && (
          <Button label="활성화" variant="primary" onClick={activate} />
        )}
      </HStack>
    </VStack>
  )
}
