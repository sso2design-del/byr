import type { IconType } from '@astryxdesign/core/Icon'
import {
  Folder, BarChart2, FileText, Presentation, Megaphone,
  Receipt, BarChart3, FileSearch, FileCheck, CalendarCheck, Calculator,
  BookOpen, Target, ClipboardList, Edit2, ListChecks, CalendarDays,
  Code2, Terminal, Bell, Rocket, GitMerge, FileCode,
  Inbox, MessageSquare, PieChart, Briefcase,
  UserCheck, UserPlus, Users, Wallet, CreditCard,
  PenTool, Share, AreaChart, Tag,
  Search, Mail, Languages, Scan,
  ShieldCheck, ScrollText, TrendingUp, AlertTriangle, ShieldAlert, Fingerprint, Landmark, UserSearch,
} from 'lucide-react'

export interface SkillDef {
  key: string
  icon: IconType
  label: string
  category: string
  detail: string
}

export const SKILL_CATALOG: SkillDef[] = [
  // ── 경영지원 ──────────────────────────────────────────────────
  { key: 'file',           icon: Folder,        label: '파일 관리',         category: '경영지원',  detail: '파일 생성·이동·조회·공유' },
  { key: 'analysis',       icon: BarChart2,     label: '데이터 분석',       category: '경영지원',  detail: '표·수식 기반 데이터 처리' },
  { key: 'report',         icon: FileText,      label: '보고서 생성',       category: '경영지원',  detail: '새 버전 파일만 (덮어쓰기 없음)' },
  { key: 'presentation',   icon: Presentation,  label: '회의 자료 정리',    category: '경영지원',  detail: '발표·보고 자료 초안 생성' },
  { key: 'announcement',   icon: Megaphone,     label: '공지 초안 작성',    category: '경영지원',  detail: '팀·전사 공지 문안 생성' },
  // ── 재무·회계 ──────────────────────────────────────────────────
  { key: 'voucher',        icon: Receipt,       label: '전표 처리',         category: '재무·회계', detail: '전표 생성·검색·승인 요청' },
  { key: 'budget',         icon: BarChart3,     label: '예산 집계',         category: '재무·회계', detail: '부서별 예산 소진율 집계' },
  { key: 'invoice',        icon: FileSearch,    label: '세금계산서 조회',   category: '재무·회계', detail: '홈택스 발행·수신 내역 조회' },
  { key: 'vat',            icon: FileCheck,     label: '부가세 대사',       category: '재무·회계', detail: '매입·매출 원장 자동 대사' },
  { key: 'close',          icon: CalendarCheck, label: '월마감 보고서',     category: '재무·회계', detail: '부서별 매출 집계·전월 대비' },
  { key: 'expense',        icon: Calculator,    label: '경비 정산',         category: '재무·회계', detail: '지출 증빙 요약·분류·결재 초안' },
  // ── 기획/PM ───────────────────────────────────────────────────
  { key: 'doc_summary',    icon: BookOpen,      label: '문서 요약',         category: '기획/PM',   detail: '긴 문서를 핵심만 요약' },
  { key: 'research',       icon: Target,        label: '경쟁사 리서치',     category: '기획/PM',   detail: '뉴스·공시 자동 수집 및 요약' },
  { key: 'meeting',        icon: ClipboardList, label: '회의록 정리',       category: '기획/PM',   detail: '결정사항·액션 아이템 추출' },
  { key: 'spec_draft',     icon: Edit2,         label: '기획서 초안',       category: '기획/PM',   detail: '요구사항 정리·명세서 초안' },
  { key: 'requirements',   icon: ListChecks,    label: '요구사항 분석',     category: '기획/PM',   detail: '기능 요구사항 분류·우선순위' },
  { key: 'schedule',       icon: CalendarDays,  label: '일정 관리',         category: '기획/PM',   detail: '마일스톤·태스크 일정 정리' },
  // ── 개발·운영 ──────────────────────────────────────────────────
  { key: 'code_exec',      icon: Code2,         label: '코드 실행',         category: '개발·운영', detail: '샌드박스 안에서 코드 직접 실행' },
  { key: 'log',            icon: Terminal,      label: '로그 분석',         category: '개발·운영', detail: '에러·이상 패턴 탐지' },
  { key: 'alert',          icon: Bell,          label: '이상 알림',         category: '개발·운영', detail: '임계값 초과 시 온콜 알림' },
  { key: 'deploy',         icon: Rocket,        label: '배포 현황 알림',    category: '개발·운영', detail: '배포 완료·롤백 이벤트 요약' },
  { key: 'pr_review',      icon: GitMerge,      label: 'PR 리뷰 요약',     category: '개발·운영', detail: 'PR 변경사항 요약·팀 공유' },
  { key: 'api_doc',        icon: FileCode,      label: 'API 문서 생성',    category: '개발·운영', detail: '코드·주석 분석 → 명세 초안' },
  // ── 영업·CS ───────────────────────────────────────────────────
  { key: 'cs_triage',      icon: Inbox,         label: 'CS 문의 분류',      category: '영업·CS',   detail: '고객 문의 자동 분류·담당자 배정' },
  { key: 'cs_reply',       icon: MessageSquare, label: '답변 초안 작성',    category: '영업·CS',   detail: 'FAQ 기반 응대 초안 자동 생성' },
  { key: 'sales_report',   icon: PieChart,      label: '영업 현황 리포트',  category: '영업·CS',   detail: '파이프라인·전환율 집계 리포트' },
  { key: 'proposal',       icon: Briefcase,     label: '제안서 초안',       category: '영업·CS',   detail: '고객사 맞춤 영업 제안서 작성' },
  { key: 'contract',       icon: FileCheck,     label: '계약서 검토',       category: '영업·CS',   detail: '조항 누락·위험 항목 확인' },
  // ── 인사·총무 ──────────────────────────────────────────────────
  { key: 'attendance',     icon: UserCheck,     label: '근태 요약',         category: '인사·총무', detail: '출결·초과근무·연차 현황 집계' },
  { key: 'recruiting',     icon: UserPlus,      label: '채용 공고 초안',    category: '인사·총무', detail: '직무 요건 → 채용 공고문 초안' },
  { key: 'resume_screen',  icon: UserSearch,    label: '이력서 스크리닝',   category: '인사·총무', detail: '직무 요건 대비 이력서 분류·평가' },
  { key: 'onboarding',     icon: Users,         label: '온보딩 자료 작성',  category: '인사·총무', detail: '신규 입사자 안내 자료 생성' },
  { key: 'salary',         icon: Wallet,        label: '급여 명세 요약',    category: '인사·총무', detail: '급여 항목 요약 (민감 정보 처리)' },
  { key: 'biztrip',        icon: CreditCard,    label: '출장·경비 정산',    category: '인사·총무', detail: '출장 비용 증빙 취합·결재 초안' },

  // 보험 FP
  { key: 'coverage_analysis', icon: ShieldCheck,   label: '보장 분석',        category: '보험 FP', detail: '보유계약 부족·중복 보장 진단' },
  { key: 'policy_lookup',     icon: ScrollText,    label: '약관 조회',        category: '보험 FP', detail: '약관·특약 근거 검색' },
  { key: 'suitability_check', icon: ListChecks,    label: '완전판매 점검',    category: '보험 FP', detail: '설명의무·서류·녹취 체크' },
  { key: 'renewal_mgmt',      icon: CalendarDays,  label: '계약 갱신 관리',   category: '보험 FP', detail: '갱신 도래·해지 방어 대상' },
  // 증권 리서치
  { key: 'dart_filing',       icon: FileSearch,    label: 'DART 공시 조회',   category: '증권 리서치', detail: '전자공시 수집·요약' },
  { key: 'earnings_analysis', icon: TrendingUp,    label: '실적 분석',        category: '증권 리서치', detail: '실적·컨센서스 비교' },
  { key: 'valuation',         icon: BarChart3,     label: '밸류에이션',       category: '증권 리서치', detail: '멀티플·목표주가 산정' },
  { key: 'sector_research',   icon: AreaChart,     label: '산업 리서치',      category: '증권 리서치', detail: '산업 동향·경쟁 구도' },
  // 준법·감사
  { key: 'txn_monitor',       icon: AlertTriangle, label: '이상거래 탐지',    category: '준법·감사', detail: '거래 패턴 이상 탐지' },
  { key: 'str_report',        icon: ShieldAlert,   label: 'STR 작성',         category: '준법·감사', detail: '의심거래보고서(STR) 초안' },
  { key: 'kyc_check',         icon: Fingerprint,   label: 'KYC 고객확인',     category: '준법·감사', detail: '고객확인·리스크 등급' },
  { key: 'internal_control',  icon: ClipboardList, label: '내부통제 점검',    category: '준법·감사', detail: '규정 준수 체크리스트' },
  { key: 'reg_watch',         icon: Landmark,      label: '규제·제재 모니터링', category: '준법·감사', detail: '규제·제재 리스트 업데이트' },
  // ── 마케팅 ────────────────────────────────────────────────────
  { key: 'content',        icon: PenTool,       label: '콘텐츠 초안 작성',  category: '마케팅',    detail: '블로그·뉴스레터·보도자료 초안' },
  { key: 'sns',            icon: Share,         label: 'SNS 게시물 생성',   category: '마케팅',    detail: '채널별 포맷에 맞는 게시물 초안' },
  { key: 'mkt_report',     icon: AreaChart,     label: '마케팅 리포트',     category: '마케팅',    detail: '캠페인 성과 집계·인사이트 정리' },
  { key: 'keyword',        icon: Tag,           label: '키워드 분석',       category: '마케팅',    detail: 'SEO·광고 키워드 발굴·분류' },
  // ── 공통 ──────────────────────────────────────────────────────
  { key: 'web',            icon: Search,        label: '웹 검색',           category: '공통',      detail: '외부 자료 조회 (선택 사항)' },
  { key: 'email',          icon: Mail,          label: '이메일 발송',       category: '공통',      detail: '지정 템플릿으로 이메일 발송' },
  { key: 'translate',      icon: Languages,     label: '번역',              category: '공통',      detail: '한·영·일·중 다국어 번역' },
  { key: 'ocr',            icon: Scan,          label: 'OCR 처리',          category: '공통',      detail: '스캔·이미지에서 텍스트 추출' },
]

export const SKILL_CATEGORIES = ['전체', '경영지원', '재무·회계', '보험 FP', '증권 리서치', '준법·감사', '기획/PM', '개발·운영', '영업·CS', '인사·총무', '마케팅', '공통']

export const SKILL_RECOMMENDED: Record<string, string[]> = {
  '전체':     ['file', 'analysis', 'report', 'doc_summary', 'meeting', 'web', 'email', 'cs_reply', 'translate', 'ocr'],
  '경영지원': ['file', 'analysis', 'report', 'presentation', 'announcement'],
  '재무·회계':['voucher', 'vat', 'close', 'budget', 'invoice', 'expense'],
  '보험 FP':   ['coverage_analysis', 'policy_lookup', 'suitability_check', 'renewal_mgmt', 'proposal', 'contract'],
  '증권 리서치':['dart_filing', 'earnings_analysis', 'valuation', 'sector_research', 'research', 'analysis'],
  '준법·감사': ['txn_monitor', 'str_report', 'kyc_check', 'internal_control', 'reg_watch'],
  '기획/PM':  ['doc_summary', 'meeting', 'research', 'spec_draft', 'requirements', 'schedule'],
  '개발·운영':['code_exec', 'log', 'alert', 'deploy', 'pr_review', 'api_doc'],
  '영업·CS':  ['cs_triage', 'cs_reply', 'sales_report', 'proposal', 'contract'],
  '인사·총무':['attendance', 'recruiting', 'resume_screen', 'onboarding', 'salary', 'biztrip'],
  '마케팅':   ['content', 'sns', 'mkt_report', 'keyword'],
  '공통':     ['web', 'email', 'translate', 'ocr'],
}

export const SKILL_EMOJI: Record<string, string> = {
  file: '📁', analysis: '📊', report: '📄', presentation: '📋', announcement: '📢',
  voucher: '🧾', budget: '📈', invoice: '🔍', vat: '✅', close: '📅', expense: '🧮',
  doc_summary: '📖', research: '🎯', meeting: '📝', spec_draft: '✍️', requirements: '☑️', schedule: '🗓️',
  code_exec: '⚡', log: '🖥️', alert: '🔔', deploy: '🚀', pr_review: '🔀', api_doc: '📃',
  cs_triage: '📥', cs_reply: '💬', sales_report: '🥧', proposal: '💼', contract: '📄',
  attendance: '👤', recruiting: '👥', resume_screen: '🗂️', onboarding: '🏢', salary: '💰', biztrip: '💳',
  content: '✏️', sns: '📤', mkt_report: '📉', keyword: '🏷️',
  web: '🔎', email: '📧', translate: '🌐', ocr: '🔬',
  coverage_analysis: '📊', policy_lookup: '📖', suitability_check: '☑️', renewal_mgmt: '🗓️',
  dart_filing: '🔍', earnings_analysis: '📈', valuation: '📊', sector_research: '📉',
  txn_monitor: '🔔', str_report: '📄', kyc_check: '👤', internal_control: '📋', reg_watch: '📄',
}

// 템플릿 키 → 기본 선택 스킬 (백엔드 TEMPLATES와 1:1 매핑)
export const TEMPLATE_SKILLS: Record<string, string[]> = {
  // 공통 업무
  common_doc:     ['doc_summary', 'file', 'report'],
  common_meeting: ['meeting', 'doc_summary', 'report'],
  common_report:  ['report', 'doc_summary', 'file'],
  common_email:   ['email', 'doc_summary', 'translate'],
  common_weekly:  ['report', 'analysis', 'file'],
  common_idea:    ['doc_summary', 'spec_draft', 'file'],
  // 재무·회계
  vat:          ['vat', 'voucher', 'invoice', 'close', 'report'],
  close:        ['close', 'budget', 'analysis', 'report'],
  expense:      ['expense', 'file', 'report', 'ocr'],
  budget:       ['budget', 'analysis', 'report'],
  pm_research:  ['research', 'web', 'doc_summary', 'report'],
  pm_brief:     ['spec_draft', 'doc_summary', 'meeting', 'report'],
  pm_spec:      ['requirements', 'spec_draft', 'doc_summary'],
  pm_meeting:   ['meeting', 'doc_summary', 'report', 'file'],
  dev_sprint:   ['requirements', 'schedule', 'report'],
  dev_pr:       ['pr_review', 'code_exec', 'api_doc'],
  dev_incident: ['log', 'alert', 'report', 'deploy'],
  dev_doc:      ['api_doc', 'code_exec', 'doc_summary'],
  ops_monitor:  ['log', 'alert', 'deploy'],
  ops_deploy:   ['deploy', 'alert', 'log'],
  cs_triage:    ['cs_triage', 'cs_reply', 'report', 'email'],
  cs_reply:     ['cs_reply', 'email', 'translate'],
  // 영업
  sales_proposal: ['proposal', 'doc_summary', 'file', 'report', 'web'],
  sales_followup: ['email', 'meeting', 'report'],
  sales_report:   ['sales_report', 'analysis', 'report'],
  sales_contract: ['contract', 'file', 'report'],
  hr:           ['attendance', 'salary', 'report'],
  hr_hire:      ['recruiting', 'doc_summary', 'report'],
  hr_screen:    ['resume_screen', 'doc_summary', 'analysis'],
  hr_onboard:   ['onboarding', 'doc_summary', 'file'],
  hr_faq:       ['doc_summary', 'web', 'file'],
  // 재무·회계
  tax_invoice:  ['invoice', 'vat', 'analysis', 'report'],
  // 보험 FP (전용 스킬)
  fp_coverage:  ['coverage_analysis', 'contract', 'doc_summary', 'report'],
  fp_proposal:  ['proposal', 'policy_lookup', 'doc_summary', 'report'],
  fp_policy_qa: ['policy_lookup', 'doc_summary', 'web'],
  fp_compliance:['suitability_check', 'contract', 'report'],
  fp_renewal:   ['renewal_mgmt', 'contract', 'email'],
  // 증권 리서치 (전용 스킬)
  rs_company:   ['earnings_analysis', 'research', 'doc_summary', 'report'],
  rs_dart:      ['dart_filing', 'doc_summary', 'report'],
  rs_earnings:  ['earnings_analysis', 'research', 'report'],
  rs_sector:    ['sector_research', 'web', 'doc_summary'],
  rs_valuation: ['valuation', 'analysis', 'report'],
  // 준법·감사 (전용 스킬)
  aml_monitor:  ['txn_monitor', 'log', 'alert', 'report'],
  aml_str:      ['str_report', 'doc_summary', 'file'],
  aml_kyc:      ['kyc_check', 'doc_summary', 'ocr'],
  aml_control:  ['internal_control', 'contract', 'report'],
  aml_reg:      ['reg_watch', 'web', 'doc_summary'],
  blank:        ['file', 'analysis', 'report'],
}

// 템플릿 키 → 스킬 피커 기본 카테고리
export const TEMPLATE_CATEGORY: Record<string, string> = {
  vat: '재무·회계', close: '재무·회계', expense: '재무·회계', budget: '재무·회계',
  pm_research: '기획/PM', pm_brief: '기획/PM', pm_spec: '기획/PM', pm_meeting: '기획/PM',
  dev_sprint: '개발·운영', dev_pr: '개발·운영', dev_incident: '개발·운영', dev_doc: '개발·운영',
  ops_monitor: '개발·운영', ops_deploy: '개발·운영',
  cs_triage: '영업·CS', cs_reply: '영업·CS',
  hr: '인사·총무', hr_hire: '인사·총무',
}
