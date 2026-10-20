export interface SubOption { key: string; label: string; description?: string; defaultOn: boolean }

// 범용 폴백 (직무 미지정·직접 구성)
export const CAP_SUBOPTIONS: Record<string, SubOption[]> = {
  file: [
    { key: 'view',       label: '파일 조회',                                    defaultOn: true  },
    { key: 'create',     label: '파일 생성',                                    defaultOn: true  },
    { key: 'move',       label: '파일 이동·복사',                               defaultOn: true  },
    { key: 'share',      label: '파일 공유',                                    defaultOn: false },
    { key: 'delete',     label: '파일 삭제', description: '주의: 되돌릴 수 없음', defaultOn: false },
    { key: 'path_guard', label: '허용 경로 외 차단',                             defaultOn: true  },
  ],
  analysis: [
    { key: 'formula',   label: '수식 계산',   defaultOn: true  },
    { key: 'aggregate', label: '집계·통계',   defaultOn: true  },
    { key: 'chart',     label: '차트 생성',   defaultOn: false },
    { key: 'anomaly',   label: '이상값 감지', defaultOn: true  },
  ],
  report: [
    { key: 'new_file',  label: '새 파일로 저장',                                defaultOn: true  },
    { key: 'overwrite', label: '기존 파일 덮어쓰기', description: '주의',        defaultOn: false },
    { key: 'pdf',       label: 'PDF 내보내기',                                  defaultOn: true  },
    { key: 'email',     label: '이메일 발송',                                   defaultOn: false },
  ],
  web: [
    { key: 'news',     label: '뉴스 검색',          defaultOn: true  },
    { key: 'official', label: '공식 문서 검색',      defaultOn: true  },
    { key: 'sns',      label: 'SNS·커뮤니티 포함',  defaultOn: false },
    { key: 'cache',    label: '검색 결과 캐시 저장', defaultOn: false },
  ],
  global_llm: [
    { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
    { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
    { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
    { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
  ],
  doc_summary: [
    { key: 'length_short',  label: '간략 요약 (200자 이내)', defaultOn: true  },
    { key: 'length_medium', label: '표준 요약 (500자 이내)', defaultOn: false },
    { key: 'key_extract',   label: '핵심 항목 추출',         defaultOn: true  },
    { key: 'save_file',     label: '요약본 파일 저장',        defaultOn: true  },
    { key: 'email',         label: '이메일 발송',             defaultOn: false },
  ],
  meeting: [
    { key: 'minutes_write',  label: '회의록 자동 작성',  defaultOn: true  },
    { key: 'action_extract', label: '액션 아이템 추출',  defaultOn: true  },
    { key: 'calendar_sync',  label: '일정 자동 등록',    defaultOn: false },
    { key: 'share_send',     label: '회의 요약 발송',    defaultOn: false },
  ],
  presentation: [
    { key: 'slide_draft',  label: '슬라이드 초안 생성', defaultOn: true  },
    { key: 'structure',    label: '슬라이드 구성 제안', defaultOn: true  },
    { key: 'chart_insert', label: '이미지·차트 삽입',  defaultOn: false },
    { key: 'translate',    label: '다국어 번역 적용',   defaultOn: false },
  ],
  requirements: [
    { key: 'classify',   label: '요구사항 분류',  defaultOn: true  },
    { key: 'prioritize', label: '우선순위 제안',  defaultOn: true  },
    { key: 'spec_gen',   label: '명세 문서 생성', defaultOn: true  },
    { key: 'history',    label: '변경이력 추적',  defaultOn: false },
  ],
  research: [
    { key: 'web_search',  label: '웹 검색',               defaultOn: true  },
    { key: 'doc_search',  label: '내부 문서 검색',         defaultOn: true  },
    { key: 'report_gen',  label: '리서치 보고서 생성',     defaultOn: true  },
    { key: 'citation',    label: '출처 표기',              defaultOn: true  },
  ],
  schedule: [
    { key: 'create_event', label: '일정 등록',   defaultOn: true  },
    { key: 'reminder',     label: '일정 알림',   defaultOn: true  },
    { key: 'conflict',     label: '충돌 감지',   defaultOn: true  },
    { key: 'invite',       label: '참석자 초대', defaultOn: false },
  ],
  spec_draft: [
    { key: 'feature_spec', label: '기능 명세 초안 작성', defaultOn: true  },
    { key: 'usecase',      label: '유스케이스 생성',     defaultOn: true  },
    { key: 'review_req',   label: '리뷰 요청',           defaultOn: false },
    { key: 'version',      label: '버전 관리',           defaultOn: false },
  ],
}

// agent.job → 범주 매핑
export const JOB_CATEGORY: Record<string, string> = {
  vat: 'finance', vat_reconcile: 'finance',
  close: 'finance', monthly_close: 'finance',
  expense: 'finance', budget: 'finance',
  insurance_fp: 'insurance_fp',
  securities_research: 'securities',
  compliance_aml: 'aml',
  hr: 'hr', hr_hire: 'hr',
  pm_brief: 'pm', pm_spec: 'pm', pm_meeting: 'pm', pm_research: 'pm',
  dev_incident: 'dev',
}

// 직무별 세부 옵션 (금융권 실무자 기준 · 리서치 교차검증 2026-06-27 근거)
export const ROLE_CAP_SUBOPTIONS: Record<string, Record<string, SubOption[]>> = {

  // ── 재무·회계 (부가세 대사·월마감·전표·경비) ─────────────────
  finance: {
    file: [
      { key: 'ledger_read',   label: '매입·매출 원장 읽기',                                  defaultOn: true  },
      { key: 'invoice_read',  label: '세금계산서 파일 읽기',                                 defaultOn: true  },
      { key: 'new_file',      label: '신규 파일로만 저장',                                   defaultOn: true  },
      { key: 'overwrite',     label: '기존 파일 덮어쓰기', description: '주의: 되돌릴 수 없음', defaultOn: false },
      { key: 'path_guard',    label: '허용 경로 외 차단',                                    defaultOn: true  },
    ],
    analysis: [
      { key: 'vat_reconcile',  label: '매입·매출 대사 — 불일치 항목 탐지',        defaultOn: true  },
      { key: 'vat_calc',       label: '부가세 계산 — 10% 정밀 재현 코드',         defaultOn: true  },
      { key: 'monthly_pl',     label: '월별 손익 집계',                           defaultOn: true  },
      { key: 'baseline_check', label: '전분기 기준값 재현 확인',                   defaultOn: true  },
      { key: 'anomaly',        label: '이상값·불일치 항목 플래깅',                defaultOn: true  },
    ],
    report: [
      { key: 'new_file',  label: '대사 결과 신규 파일 저장',                       defaultOn: true  },
      { key: 'overwrite', label: '기존 파일 덮어쓰기', description: '주의',        defaultOn: false },
      { key: 'pdf',       label: 'PDF 내보내기',                                  defaultOn: true  },
      { key: 'email',     label: '이메일 발송',                                   defaultOn: false },
    ],
    web: [
      { key: 'hometax',  label: '홈택스 공시·세금계산서 조회', defaultOn: true  },
      { key: 'tax_law',  label: '세법·시행령 검색',           defaultOn: true  },
      { key: 'exchange', label: '환율 정보 조회',             defaultOn: false },
      { key: 'news',     label: '뉴스 검색',                 defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },

  // ── 보험 FP (제안서 자동화·보장 갭 분석·약관 Q&A) ────────────
  insurance_fp: {
    file: [
      { key: 'contract_read',  label: '고객 기존 계약 정보 읽기',                             defaultOn: true  },
      { key: 'product_manual', label: '상품 약관·산출방법서 읽기',                            defaultOn: true  },
      { key: 'new_file',       label: '제안서 신규 저장',                                     defaultOn: true  },
      { key: 'overwrite',      label: '기존 파일 덮어쓰기', description: '주의: 되돌릴 수 없음', defaultOn: false },
      { key: 'path_guard',     label: '허용 경로 외 차단',                                    defaultOn: true  },
    ],
    analysis: [
      { key: 'coverage_gap',   label: '보장 공백(갭) 분석 — 기존 계약 vs 표준 보장',              defaultOn: true  },
      { key: 'product_match',  label: '고객 프로필 기반 상품 추천 — 연령·가족구성 기준',          defaultOn: true  },
      { key: 'premium_calc',   label: '보험료 산출·특약 조합별 플랜 비교',                       defaultOn: true  },
      { key: 'compliance_chk', label: '불완전판매 체크리스트 자동 적용 — 금소법 기준',            defaultOn: true  },
      { key: 'fin_summary',    label: '고객 재무 현황 요약', description: '민감정보 포함',        defaultOn: false },
    ],
    report: [
      { key: 'proposal',       label: '맞춤 제안서 생성',          defaultOn: true  },
      { key: 'coverage_table', label: '보장 비교표 생성',          defaultOn: true  },
      { key: 'speech_script',  label: '상담 화법 스크립트 생성',   defaultOn: false },
      { key: 'pdf',            label: 'PDF 내보내기',             defaultOn: true  },
    ],
    web: [
      { key: 'fss_product', label: '금감원 상품 공시 조회',         defaultOn: true  },
      { key: 'tos_manual',  label: '약관·산출방법서 내부 검색',     defaultOn: true  },
      { key: 'regulation',  label: '금소법·보험업법 규정 검색',     defaultOn: true  },
      { key: 'news',        label: '뉴스 검색',                    defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },

  // ── 증권 리서치 (투자리포트 초안·DART 공시·컨센서스 분석) ─────
  securities: {
    file: [
      { key: 'internal_db',  label: '내부 리서치 DB·컨센서스 읽기',                            defaultOn: true  },
      { key: 'visit_memo',   label: '기업 탐방 메모 읽기', description: '미공개정보 포함 가능', defaultOn: true  },
      { key: 'new_file',     label: '리포트 초안 신규 저장',                                   defaultOn: true  },
      { key: 'overwrite',    label: '기존 파일 덮어쓰기', description: '주의',                  defaultOn: false },
      { key: 'path_guard',   label: '허용 경로 외 차단',                                       defaultOn: true  },
    ],
    analysis: [
      { key: 'valuation',  label: '재무제표 분석 — EPS·PER·PBR 밸류에이션',          defaultOn: true  },
      { key: 'disclosure', label: '공시·뉴스 자동 수집·정리 — DART 기반',            defaultOn: true  },
      { key: 'consensus',  label: '실적 컨센서스 대비 분석 — 시장 기대치 비교',       defaultOn: true  },
      { key: 'chart',      label: '차트·그래프 생성 — 투자 포인트 시각화',            defaultOn: true  },
      { key: 'anomaly',    label: '이상 신호 탐지 — 실적 서프라이즈·거래량 이상',     defaultOn: true  },
    ],
    report: [
      { key: 'section_draft', label: '리포트 섹션별 초안 생성',           defaultOn: true  },
      { key: 'citation',      label: '인용·각주 자동 삽입 — 공시 출처',   defaultOn: true  },
      { key: 'pdf',           label: 'PDF 내보내기',                     defaultOn: true  },
      { key: 'email',         label: '내부 배포 이메일 발송',             defaultOn: false },
    ],
    web: [
      { key: 'dart',  label: 'DART 공시 검색',                                          defaultOn: true  },
      { key: 'news',  label: '뉴스 검색',                                                defaultOn: true  },
      { key: 'sns',   label: 'SNS·투자커뮤니티', description: '주의: 미공개정보 위험',   defaultOn: false },
      { key: 'cache', label: '검색 결과 캐시 저장',                                      defaultOn: true  },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },

  // ── 준법·내부감사 AML (STR 초안·이상거래·관계망 분석) ─────────
  aml: {
    file: [
      { key: 'transaction', label: '거래 이력 파일 읽기',                                           defaultOn: true  },
      { key: 'kyc',         label: 'KYC·고객확인 파일 읽기',                                        defaultOn: true  },
      { key: 'new_file',    label: '보고서 신규 저장',                                              defaultOn: true  },
      { key: 'overwrite',   label: '기존 파일 덮어쓰기', description: '주의: 감사 원본 훼손 위험',   defaultOn: false },
      { key: 'path_guard',  label: '허용 경로 외 차단',                                             defaultOn: true  },
    ],
    analysis: [
      { key: 'pattern',   label: '이상 거래 패턴 탐지 — 임계값 초과 자동 경보',       defaultOn: true  },
      { key: 'aggregate', label: '고객 거래 이력 집계 — 기간별·금액별',               defaultOn: true  },
      { key: 'network',   label: '연관 계좌 관계망 분석',                             defaultOn: true  },
      { key: 'fp_filter', label: '오탐 필터링 — 기존 룰 기반 경보 재분류',            defaultOn: true  },
      { key: 'ctr_str',   label: 'CTR·STR 보고 임계값 적용',                         defaultOn: true  },
    ],
    report: [
      { key: 'str_draft',    label: 'STR(혐의거래보고서) 초안 생성', defaultOn: true  },
      { key: 'invest_draft', label: '조사 요약 보고서 초안',          defaultOn: true  },
      { key: 'pdf',          label: 'PDF 내보내기',                  defaultOn: true  },
      { key: 'email',        label: '이메일 발송',                   defaultOn: false },
    ],
    web: [
      { key: 'fiu',  label: 'FIU·금감원 가이드라인 검색',  defaultOn: false },
      { key: 'news', label: '뉴스 검색',                  defaultOn: false },
      { key: 'sns',  label: 'SNS·커뮤니티 포함',          defaultOn: false },
      { key: 'cache',label: '검색 결과 캐시 저장',         defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', description: '보안 정책 — 거래 데이터 외부 전송 금지', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            description: '주의: 거래 데이터 외부 전송',           defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          description: '주의: 거래 데이터 외부 전송',           defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             description: '주의: 거래 데이터 외부 전송',           defaultOn: false },
    ],
  },

  // ── 인사·총무 (근태·급여·채용) ───────────────────────────────
  hr: {
    file: [
      { key: 'attendance', label: '근태 데이터 읽기',                              defaultOn: true  },
      { key: 'salary',     label: '급여 명세 읽기', description: '민감정보 포함',  defaultOn: true  },
      { key: 'new_file',   label: '신규 파일로만 저장',                            defaultOn: true  },
      { key: 'overwrite',  label: '기존 파일 덮어쓰기', description: '주의',       defaultOn: false },
      { key: 'path_guard', label: '허용 경로 외 차단',                             defaultOn: true  },
    ],
    analysis: [
      { key: 'attendance_agg', label: '근태 현황 집계 — 출결·초과근무·연차 잔여', defaultOn: true  },
      { key: 'salary_check',   label: '급여 항목 분류·검증',                     defaultOn: true  },
      { key: 'headcount',      label: '조직 인원 현황 분석',                     defaultOn: true  },
      { key: 'turnover',       label: '입퇴사·이직률 분석',                      defaultOn: false },
    ],
    report: [
      { key: 'new_file',  label: '인사 현황 보고서 신규 저장',  defaultOn: true  },
      { key: 'overwrite', label: '기존 파일 덮어쓰기', description: '주의', defaultOn: false },
      { key: 'pdf',       label: 'PDF 내보내기',              defaultOn: true  },
      { key: 'email',     label: '이메일 발송',               defaultOn: false },
    ],
    web: [
      { key: 'labor_law', label: '노동법·인사 규정 검색', defaultOn: true  },
      { key: 'news',      label: '뉴스 검색',            defaultOn: false },
      { key: 'sns',       label: 'SNS·커뮤니티 포함',    defaultOn: false },
      { key: 'cache',     label: '캐시 저장',            defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },

  // ── 기획/PM (회의록·기획서·경쟁사 리서치) ────────────────────
  pm: {
    file: [
      { key: 'doc_read',   label: '기획 문서·회의록 읽기',  defaultOn: true  },
      { key: 'new_file',   label: '기획서·초안 신규 저장',  defaultOn: true  },
      { key: 'overwrite',  label: '기존 파일 덮어쓰기', description: '주의', defaultOn: false },
      { key: 'path_guard', label: '허용 경로 외 차단',     defaultOn: true  },
    ],
    analysis: [
      { key: 'action_items', label: '회의 결정사항·액션 아이템 추출',  defaultOn: true  },
      { key: 'competitor',   label: '경쟁사 정보 수집·정리',           defaultOn: true  },
      { key: 'requirements', label: '요구사항 분류·우선순위 분석',     defaultOn: true  },
      { key: 'schedule',     label: '일정·마일스톤 파악',              defaultOn: false },
    ],
    report: [
      { key: 'new_file',  label: '기획서 초안 신규 저장',               defaultOn: true  },
      { key: 'overwrite', label: '기존 파일 덮어쓰기', description: '주의', defaultOn: false },
      { key: 'pdf',       label: 'PDF 내보내기',                       defaultOn: false },
      { key: 'email',     label: '이메일 발송',                        defaultOn: false },
    ],
    web: [
      { key: 'news',     label: '뉴스 검색',          defaultOn: true  },
      { key: 'official', label: '공식 문서 검색',      defaultOn: true  },
      { key: 'sns',      label: 'SNS·커뮤니티 포함',  defaultOn: false },
      { key: 'cache',    label: '캐시 저장',          defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },

  // ── 개발·운영 (인시던트 대응·배포 모니터링·코드 리뷰) ──────────
  dev: {
    file: [
      { key: 'log_read',    label: '로그 파일 읽기',                                  defaultOn: true  },
      { key: 'config_read', label: '설정 파일 읽기',                                  defaultOn: true  },
      { key: 'new_file',    label: '신규 파일로만 저장',                               defaultOn: true  },
      { key: 'overwrite',   label: '기존 파일 덮어쓰기', description: '주의',          defaultOn: false },
      { key: 'path_guard',  label: '허용 경로 외 차단', description: '기본 ON 필수',   defaultOn: true  },
    ],
    analysis: [
      { key: 'error_pattern',  label: '에러 패턴 탐지 — 로그 기반 임계값 경보',        defaultOn: true  },
      { key: 'deploy_status',  label: '배포 현황 집계 — PR·릴리스 상태 추적',          defaultOn: true  },
      { key: 'traffic_anomaly',label: '이상 트래픽 감지',                              defaultOn: true  },
      { key: 'performance',    label: '응답 시간·자원 사용량 분석',                    defaultOn: false },
    ],
    report: [
      { key: 'incident',  label: '인시던트 요약 저장',                               defaultOn: true  },
      { key: 'pr_summary',label: 'PR 요약 저장',                                     defaultOn: true  },
      { key: 'email',     label: '이메일 발송',                                      defaultOn: false },
      { key: 'pdf',       label: 'PDF 내보내기',                                     defaultOn: false },
    ],
    web: [
      { key: 'official',  label: 'GitHub·공식 문서 검색',  defaultOn: true  },
      { key: 'stackoverflow', label: 'Stack Overflow 검색', defaultOn: true  },
      { key: 'news',      label: '뉴스 검색',              defaultOn: false },
      { key: 'cache',     label: '검색 결과 캐시 저장',    defaultOn: false },
    ],
    global_llm: [
      { key: 'local_first', label: '자체 LLM 우선', defaultOn: true  },
      { key: 'gpt4o',       label: 'GPT-4o (OpenAI)',            defaultOn: false },
      { key: 'claude',      label: 'Claude (Anthropic)',          defaultOn: false },
      { key: 'gemini',      label: 'Gemini (Google)',             defaultOn: false },
    ],
  },
}

export function getSubOpts(skillKey: string, agentJob?: string | null): SubOption[] {
  const cat = JOB_CATEGORY[agentJob ?? ''] ?? ''
  const role = cat ? ROLE_CAP_SUBOPTIONS[cat]?.[skillKey] : undefined
  return role ?? CAP_SUBOPTIONS[skillKey] ?? []
}
