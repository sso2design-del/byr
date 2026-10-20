import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { VStack, HStack, Layout, LayoutHeader, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { TextInput } from '@astryxdesign/core/TextInput'

type Phase = 'plan' | 'running' | 'staged' | 'committed' | 'undone'
interface ReqInput { key: string; label: string; type: string; required: boolean; question_if_missing?: string }
interface Plan { task: string; steps: string[]; source_files: string[]; required_inputs?: ReqInput[]; job?: string; goal?: string }
interface Detail { cell: string; label: string; value: string }
interface RuleFinding { rule: string; desc: string; severity: string; action: string }
interface ExternalActionResult {
  ok?: boolean; target?: string; dry_run?: boolean; id?: string | null
  message?: string; error?: string; partial_success?: boolean; rolled_back?: boolean
  external_ids?: string[]; items?: { status: string; summary?: string }[]
}
interface Result {
  stage_id: string; summary?: string
  approval_required?: boolean; approval_reasons?: string[]
  blocked?: boolean; rule_findings?: RuleFinding[]
  artifact?: Record<string, unknown>
  golden_check?: { matched: number; anomalies: number; label: string }
  details?: Detail[]
  external_action_result?: ExternalActionResult
}

export default function ExecutionFlow() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('plan')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<ExternalActionResult | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, init)
    if (!res.ok) {
      let msg = '요청 처리 중 오류가 발생했습니다.'
      try {
        const body = await res.json() as { detail?: string | { message?: string } }
        if (body?.detail) msg = typeof body.detail === 'string' ? body.detail : (body.detail.message || msg)
      } catch {
        // ignore parse error
      }
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  }

  // 직무별 실행 입력 payload 구성(타입 변환)
  const buildPayload = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {}
    for (const f of plan?.required_inputs ?? []) {
      const raw = (inputs[f.key] ?? '').trim()
      if (f.type === 'array') p[f.key] = raw ? raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []
      else if (f.type === 'number') p[f.key] = raw === '' ? '' : Number(raw)
      else p[f.key] = raw
    }
    return p
  }

  useEffect(() => {
    if (!id) return
    setError(null)
    fetchJson<Plan>(`/api/agents/${id}/plan`)
      .then(setPlan)
      .catch((e: Error) => setError(e.message))
  }, [id])

  const handleApprove = async () => {
    try {
      setError(null)
      setPhase('running')
      await new Promise(r => setTimeout(r, 1200))
      const data = await fetchJson<Result>(`/api/agents/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      setResult(data)
      setPhase('staged')
    } catch (e) {
      setPhase('plan')
      setError(e instanceof Error ? e.message : '실행 중 오류가 발생했습니다.')
    }
  }

  // 1단계: 미리보기(dry-run) — 승인 게이트 통과 + 반영 예정 내용만 확인, 외부 반영 안 함
  const handlePreview = async () => {
    if (!result) return
    try {
      setError(null); setBusy(true)
      const data = await fetchJson<Result>(`/api/staging/${result.stage_id}/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })
      if (data.external_action_result) setPreview(data.external_action_result)
      else setPhase('committed')   // 외부 액션 없는 레코드는 미리보기 없이 확정
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기 중 오류가 발생했습니다.')
    } finally { setBusy(false) }
  }

  // 2단계: 최종 반영(live) — 실제 외부 시스템 반영. 미리보기 1회 후에만 가능.
  const handleLive = async () => {
    if (!result) return
    try {
      setError(null); setBusy(true)
      await fetchJson(`/api/staging/${result.stage_id}/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      })
      setPhase('committed')
    } catch (e) {
      setError(e instanceof Error ? e.message : '최종 반영 중 오류가 발생했습니다.')
    } finally { setBusy(false) }
  }

  const handleUndo = async () => {
    if (!result) return
    try {
      setError(null)
      await fetchJson(`/api/staging/${result.stage_id}/undo`, { method: 'POST' })
      setPhase('undone')
    } catch (e) {
      setError(e instanceof Error ? e.message : '되돌리기 중 오류가 발생했습니다.')
    }
  }

  if (!plan) return (
    <div style={{ padding: 40 }}>
      {error && (
        <div style={{ marginBottom: 12 }}>
          <Banner status="error" title="불러오기 실패" description={error} />
        </div>
      )}
      <Text type="body" color="secondary">불러오는 중...</Text>
    </div>
  )

  return (
    <VStack gap={5} style={{ padding: '32px 40px', maxWidth: 720 }}>
      {error && <Banner status="error" title="오류" description={error} />}
      <Button label="← 에이전트 목록" variant="ghost" size="sm" onClick={() => navigate('/agents')} />
      <StepIndicator phase={phase} />

      {/* ── 계획 확인 ── */}
      {phase === 'plan' && (
        <VStack gap={5}>
          <VStack gap={1}>
            <Heading level={2}>실행 계획 미리보기</Heading>
            <Text type="body" color="secondary">계획을 확인하고 승인하면 실행합니다. 파일을 직접 수정하지 않습니다.</Text>
          </VStack>

          <Banner
            status="info"
            title="신뢰 계층 — 계획 단계"
            description="에이전트가 무엇을 할지 먼저 보여줍니다. 승인 전까지 어떤 파일도 변경되지 않습니다."
          />

          <Card width="100%">
            <Layout
              header={
                <LayoutHeader hasDivider>
                  <Heading level={4}>{plan.task}</Heading>
                </LayoutHeader>
              }
              content={
                <LayoutContent>
                  <VStack gap={4}>
                    <VStack gap={2}>
                      <Text type="label" color="secondary">실행 단계</Text>
                      {plan.steps.map((step, i) => (
                        <HStack key={i} gap={3} vAlign="start">
                          <Badge variant="info" label={String(i + 1)} />
                          <Text type="body">{step}</Text>
                        </HStack>
                      ))}
                    </VStack>
                    {plan.source_files.length > 0 && (
                      <VStack gap={2}>
                        <Text type="label" color="secondary">대상 파일</Text>
                        <HStack gap={2} style={{ flexWrap: 'wrap' }}>
                          {plan.source_files.map(f => (
                            <Badge key={f} variant="neutral" label={f} />
                          ))}
                        </HStack>
                      </VStack>
                    )}
                    {/* 직무별 실행 입력 */}
                    {(plan.required_inputs?.length ?? 0) > 0 && (
                      <VStack gap={2}>
                        <Text type="label" color="secondary">실행 입력</Text>
                        {plan.required_inputs!.map(f => (
                          <TextInput
                            key={f.key}
                            label={`${f.label}${f.required ? ' *' : ''}${f.type === 'array' ? ' (쉼표로 구분)' : f.type === 'date' ? ' (YYYY-MM-DD)' : ''}`}
                            value={inputs[f.key] ?? ''}
                            onChange={(v: string) => setInputs(prev => ({ ...prev, [f.key]: v }))}
                            placeholder={f.question_if_missing || f.label}
                            width="100%"
                          />
                        ))}
                      </VStack>
                    )}
                  </VStack>
                </LayoutContent>
              }
              footer={
                <LayoutFooter hasDivider>
                  <HStack gap={3}>
                    <Button label="승인 · 실행" variant="primary" onClick={handleApprove} />
                    <Button label="취소" variant="secondary" onClick={() => navigate('/agents')} />
                  </HStack>
                </LayoutFooter>
              }
            />
          </Card>
        </VStack>
      )}

      {/* ── 실행 중 ── */}
      {phase === 'running' && (
        <VStack gap={4} hAlign="center" style={{ padding: '60px 0', textAlign: 'center' }}>
          <Banner
            status="info"
            title="실행 중..."
            description="결정론적 코드가 계산하고 있습니다. 잠시 기다려 주세요."
          />
          <div style={{
            height: 4, width: '100%', maxWidth: 400,
            background: 'var(--color-border-emphasized)',
            borderRadius: 'var(--radius-full)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', background: 'var(--color-accent)',
              animation: 'ax-progress 1.8s ease-in-out forwards',
            }} />
          </div>
          <style>{`@keyframes ax-progress { from { width: 0 } to { width: 100% } }`}</style>
        </VStack>
      )}

      {/* ── 결과 검토 ── */}
      {phase === 'staged' && result && (
        <VStack gap={5}>
          <VStack gap={1}>
            <Heading level={2}>결과 검토</Heading>
            <Text type="body" color="secondary">스테이징됐습니다. 확정 전까지 파일은 변경되지 않습니다.</Text>
          </VStack>

          {result.approval_required !== undefined ? (
            <Banner
              status={result.approval_required ? 'warning' : 'success'}
              title={result.approval_required ? '사용자 승인 필요' : '승인 불필요 — 확정 가능'}
              description={result.approval_required
                ? (result.approval_reasons || []).join(' · ')
                : '결정론적 검증 규칙을 통과했습니다. 확정 저장하세요.'}
            />
          ) : result.golden_check ? (
            <Banner status="success" title={result.golden_check.label} description="골든샘플(검증 기준값)과 비교 완료. 이상 없으면 확정 저장하세요." />
          ) : null}

          {result.blocked && (
            <Banner
              status="error"
              title="확정 불가 — 규칙 위반"
              description={(result.rule_findings || []).filter(f => f.action === 'block').map(f => f.desc).join(' · ')
                || '결정론적 규칙 위반으로 확정할 수 없습니다. 입력·근거를 수정한 뒤 다시 실행하세요.'}
            />
          )}

          {preview && (
            <Banner
              status={preview.ok ? 'info' : 'error'}
              title={preview.ok
                ? '미리보기 — 아직 외부 반영되지 않았습니다'
                : `미리보기 실패 — ${preview.error || '확인 필요'}`}
              description={preview.ok
                ? `${preview.target} 반영 예정: ${preview.message}`
                  + `${(result.rule_findings?.length ?? 0) > 0 ? ` · 확인 필요 ${result.rule_findings!.length}건` : ''}`
                  + ' · [최종 반영 (live)]을 눌러야 실제 반영됩니다.'
                : preview.message || '미리보기에 실패해 최종 반영할 수 없습니다.'}
            />
          )}

          <Card width="100%">
            <Layout
              header={
                <LayoutHeader hasDivider>
                  <Heading level={4}>실행 요약</Heading>
                </LayoutHeader>
              }
              content={
                <LayoutContent>
                  <VStack gap={3}>
                    {result.summary && <Text type="body">{result.summary}</Text>}
                    {(result.approval_reasons?.length ?? 0) > 0 && (
                      <VStack gap={1}>
                        <Text type="label" color="secondary">승인 사유</Text>
                        {result.approval_reasons!.map((r, i) => (
                          <Text key={i} type="supporting" color="secondary">• {r}</Text>
                        ))}
                      </VStack>
                    )}
                    {/* 재무 데모(골든샘플) 상세 — 있을 때만 */}
                    {result.details && (
                      <>
                        <Text type="label" color="secondary">근거 — 클릭하면 출처 셀 확인</Text>
                        {result.details.map((d, i) => (
                          <VStack key={i} gap={0}>
                            <Card width="100%" style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedCell(expandedCell === d.cell ? null : d.cell)}>
                              <HStack hAlign="between" vAlign="center">
                                <Text type="body">{d.label}</Text>
                                <Text type="label" color="accent">{d.value}</Text>
                              </HStack>
                            </Card>
                            {expandedCell === d.cell && (
                              <div style={{ padding: '8px 16px', background: 'var(--color-background-surface)', borderRadius: '0 0 var(--radius-container) var(--radius-container)', borderTop: '1px solid var(--color-border)' }}>
                                <Text type="supporting" color="secondary">출처: {d.cell}</Text>
                              </div>
                            )}
                          </VStack>
                        ))}
                      </>
                    )}
                    {/* 직무 산출물(artifact) — 구조화 결과 */}
                    {result.artifact && Object.keys(result.artifact).length > 0 && (
                      <VStack gap={1}>
                        <Text type="label" color="secondary">산출물</Text>
                        <pre style={{
                          margin: 0, padding: 14, borderRadius: 'var(--radius-inner)',
                          background: 'var(--color-background-muted)', border: '1px solid var(--color-border)',
                          fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-primary)',
                          overflowX: 'auto', maxHeight: 360, overflowY: 'auto',
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        }}>{JSON.stringify(result.artifact, null, 2)}</pre>
                      </VStack>
                    )}
                  </VStack>
                </LayoutContent>
              }
              footer={
                <LayoutFooter hasDivider>
                  <HStack gap={3}>
                    {!preview ? (
                      <Button label="미리보기 (dry-run)" variant="primary"
                        isDisabled={!!result.blocked || busy} onClick={handlePreview} />
                    ) : (
                      <Button label="최종 반영 (live)" variant="primary"
                        isDisabled={!!result.blocked || busy || !preview.ok} onClick={handleLive} />
                    )}
                    <Button label="되돌리기" variant="destructive" isDisabled={busy} onClick={handleUndo} />
                  </HStack>
                </LayoutFooter>
              }
            />
          </Card>
        </VStack>
      )}

      {/* ── 확정 완료 ── */}
      {phase === 'committed' && (
        <VStack gap={4} hAlign="center" style={{ padding: '60px 0', textAlign: 'center' }}>
          <Banner
            status="success"
            title="저장되었습니다"
            description="감사 원장(변경 기록 장부)에 기록됐습니다. 자동 신고는 절대 없습니다."
          />
          <Button label="에이전트 목록으로" variant="secondary" onClick={() => navigate('/agents')} />
        </VStack>
      )}

      {/* ── 되돌리기 완료 ── */}
      {phase === 'undone' && (
        <VStack gap={4} hAlign="center" style={{ padding: '60px 0', textAlign: 'center' }}>
          <Banner
            status="warning"
            title="되돌렸습니다"
            description="원본 파일은 변경되지 않았습니다."
          />
          <Button label="에이전트 목록으로" variant="secondary" onClick={() => navigate('/agents')} />
        </VStack>
      )}
    </VStack>
  )
}

function StepIndicator({ phase }: { phase: Phase }) {
  const steps = ['계획 확인', '실행 중', '결과 검토', '확정']
  const idx = { plan: 0, running: 1, staged: 2, committed: 3, undone: 3 }[phase]
  return (
    <HStack vAlign="center" gap={0} style={{ margin: '4px 0 8px' }}>
      {steps.map((s, i) => (
        <HStack key={s} vAlign="center" gap={0}>
          <VStack gap={1} hAlign="center">
            <div style={{
              width: 28, height: 28, borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
              background: i <= idx ? 'var(--color-accent)' : 'var(--color-border-emphasized)',
              color: i <= idx ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
            }}>{i + 1}</div>
            <Text type="supporting" color={i <= idx ? 'accent' : 'secondary'}>{s}</Text>
          </VStack>
          {i < steps.length - 1 && (
            <div style={{
              width: 52, height: 2, margin: '0 6px', marginBottom: 20,
              background: i < idx ? 'var(--color-accent)' : 'var(--color-border)',
            }} />
          )}
        </HStack>
      ))}
    </HStack>
  )
}
