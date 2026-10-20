import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Switch } from '@astryxdesign/core/Switch'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Banner } from '@astryxdesign/core/Banner'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import HireModal from '../components/HireModal'
import { SearchBar } from '../components/SearchBar'
import { FilterDropdown } from '../components/FilterDropdown'
import { AgentIconBadge } from '../utils/agentIcon'
import { MCP_LOGOS } from '../utils/mcpLogos'
import { PLATFORM_LOGOS } from '../utils/platformLogos'
import {
  Receipt, BarChart2, Search, GitPullRequest,
  Code2, MessageSquare, Globe, LayoutDashboard, AlertTriangle,
  X, Plus, Check, ChevronDown, ChevronRight, Lock, Hand, Ban,
  FileCheck, Shield, PenTool, Mic,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon'

type TabKey = 'templates' | 'mcp'

interface Agent { id: string; [key: string]: unknown }
interface Template { key: string; icon: string; name: string; purpose: string; job: string | null; category?: string }
interface Platform { key: string; name: string; icon: string }
interface Meta { templates: Template[]; platforms: Platform[]; mcp_catalog: unknown[] }

const HIRE_KEY: Record<string, string> = {
  'mpl-01': 'vat_reconcile',
  'mpl-02': 'close',
  'mpl-03': 'hr_hire',
  'mpl-04': 'pm_research',
  'mpl-05': 'cs_reply',
  'mpl-06': 'blank',
  'mpl-07': 'blank',
  'mpl-08': 'blank',
  'mpl-09': 'blank',
  'mpl-10': 'pm_research',
}

const TPL_CATEGORIES = ['전체', '재무·회계', '인사·총무', '기획/PM', '영업·CS', '마케팅', '경영지원', '개발·운영']
const MCP_CATEGORIES = ['전체', '금융', '개발', '메신저', '생산성', '문서', '운영']

interface TplDef {
  id: string
  category: string
  Icon: LucideIcon
  title: string
  author: string
  shortDesc: string
  longDesc: string
  samplePrompts: string[]
  skills: string[]
  subOptions: string[]
  mcps: string[]
}

const TEMPLATES: TplDef[] = [
  {
    id: 'mpl-01', category: '재무·회계', Icon: Receipt,
    title: '부가세 대사 에이전트',
    author: 'Byr 제공',
    shortDesc: '매입·매출 원장을 자동으로 대사하고 불일치 항목을 즉시 식별합니다.',
    longDesc:
      '세금계산서 파일과 원장 데이터를 업로드하면 매입·매출을 자동으로 대사하고 불일치 항목·누락 건·금액 오차를 탐지합니다. ' +
      '부가세 신고 전 사전 검증 단계로 활용하여 오류 수정 시간을 단축하고 정확한 납부세액 산출을 지원합니다.',
    samplePrompts: [
      '이번 달 매입·매출 대사 결과를 요약해줘',
      '불일치 항목과 원인을 분류해줘',
      '세금계산서 누락 건을 찾아줘',
      '부가세 납부세액을 계산해줘',
    ],
    skills: ['부가세 대사', '세금계산서 조회', '데이터 분석', '보고서 생성', '파일 관리'],
    subOptions: [
      '매입·매출 원장 읽기',
      '부가세 계산 — 10% 정밀 재현',
      '이상값·불일치 플래깅',
      '대사 결과 신규 파일 저장',
      '홈택스 세금계산서 조회',
    ],
    mcps: ['국세청 전자세금계산서'],
  },
  {
    id: 'mpl-02', category: '재무·회계', Icon: BarChart2,
    title: '월마감 보고서 에이전트',
    author: 'Byr 제공',
    shortDesc: '부서별 손익을 집계하고 전월 대비 분석이 포함된 월마감 보고서를 자동 생성합니다.',
    longDesc:
      '원장 데이터와 전표를 기준으로 부서별 매출·비용을 집계하고 전월·전년 동기 대비 증감 분석, 이상 항목 플래그가 포함된 월마감 보고서를 자동으로 생성합니다. ' +
      'CFO·재무팀의 월말 결산 작업 시간을 단축하고 일관된 보고 포맷을 유지합니다.',
    samplePrompts: [
      '이번 달 부서별 매출·비용을 집계해줘',
      '전월 대비 증감 분석을 요약해줘',
      '이상 항목을 플래그로 표시해줘',
      '월마감 보고서 초안을 PDF로 만들어줘',
    ],
    skills: ['월마감 보고서', '데이터 분석', '보고서 생성', '전표 처리', '파일 관리'],
    subOptions: [
      '월별 손익 집계',
      '전분기 기준값 재현 확인',
      '이상값 탐지',
      'PDF 내보내기',
      '이메일 발송',
    ],
    mcps: [],
  },
  {
    id: 'mpl-03', category: '인사·총무', Icon: UserPlus,
    title: '이력서 스크리닝 에이전트',
    author: 'Byr 제공',
    shortDesc: '지원서를 직무 요건에 맞게 자동 분류하고 면접 질문을 생성합니다.',
    longDesc:
      '채용 공고의 직무 요건을 기준으로 접수된 이력서를 자동 분류하고 후보자별 강점·약점 요약과 1차 면접 질문을 생성합니다. ' +
      '채용 담당자의 초기 스크리닝 시간을 줄이고 일관된 평가 기준을 적용합니다.',
    samplePrompts: [
      '이번 주 접수된 지원서를 직무 요건에 맞게 분류해줘',
      '상위 5명의 강점과 약점을 비교해줘',
      '1차 면접 질문 리스트를 만들어줘',
      '합격·보류·불합격 기준으로 분류해줘',
    ],
    skills: ['채용 공고 초안', '문서 요약', '보고서 생성', '파일 관리', '이메일 발송'],
    subOptions: [
      '직무 요건 기반 자동 분류',
      '후보자 강점·약점 요약',
      '면접 질문 자동 생성',
      '채용 결과 이메일 발송',
    ],
    mcps: [],
  },
  {
    id: 'mpl-04', category: '기획/PM', Icon: Mic,
    title: '고객 인터뷰 분석 에이전트',
    author: 'Byr 제공',
    shortDesc: '인터뷰 녹취록에서 Pain Point와 요구사항을 자동으로 추출합니다.',
    longDesc:
      '사용자 인터뷰 녹취록을 업로드하면 Pain Point(불편 사항), 기능 요구사항, 사용 패턴을 자동 추출하고 ' +
      '우선순위 매트릭스와 어피니티 레이블(주제별 그루핑 도구)을 생성합니다. ' +
      'UX 리서처와 기획자의 분석 작업을 빠르게 구조화합니다.',
    samplePrompts: [
      '인터뷰 녹취록에서 Pain Point를 추출해줘',
      '사용자 요구사항을 우선순위별로 정리해줘',
      '참여자들의 공통 패턴을 요약해줘',
      '어피니티 다이어그램용 레이블을 만들어줘',
    ],
    skills: ['문서 요약', '요구사항 분석', '경쟁사 리서치', '보고서 생성', '파일 관리'],
    subOptions: [
      'Pain Point 자동 추출',
      '요구사항 우선순위 정렬',
      '공통 패턴 요약',
      '어피니티 레이블 생성',
    ],
    mcps: [],
  },
  {
    id: 'mpl-05', category: '영업·CS', Icon: MessageSquare,
    title: 'CS 문의 자동 응대 에이전트',
    author: 'Byr 제공',
    shortDesc: '고객 문의를 자동 분류하고 FAQ 기반 답변 초안을 즉시 생성합니다.',
    longDesc:
      '고객 문의 내용을 카테고리별로 자동 분류하고 등록된 FAQ와 정책 문서를 참고하여 답변 초안을 생성합니다. ' +
      '복잡한 문의는 담당자에게 자동 에스컬레이션(상위 담당자 이관)하여 응대 품질을 유지하면서 처리 시간을 단축합니다.',
    samplePrompts: [
      '오늘 접수된 문의를 유형별로 분류해줘',
      '이 문의에 대한 답변 초안을 만들어줘',
      '에스컬레이션 필요 건을 식별해줘',
      '일주일간 CS 응대 현황 리포트를 만들어줘',
    ],
    skills: ['CS 문의 분류', '답변 초안 작성', '이메일 발송', '웹 검색', '보고서 생성'],
    subOptions: [
      '문의 유형 자동 분류',
      'FAQ 기반 답변 초안',
      '에스컬레이션 규칙 적용',
      '고객 응대 이메일 발송',
    ],
    mcps: ['Slack'],
  },
  {
    id: 'mpl-06', category: '마케팅', Icon: PenTool,
    title: 'SNS 마케팅 에이전트',
    author: 'Byr 제공',
    shortDesc: 'LinkedIn, Instagram 등 채널별 맞춤형 콘텐츠와 해시태그를 자동 생성합니다.',
    longDesc:
      '제품·서비스 정보와 목표 메시지를 입력하면 채널별 포맷에 최적화된 게시물과 해시태그를 생성합니다. ' +
      '브랜드 톤을 유지하면서 주간 콘텐츠 캘린더 초안까지 자동으로 작성합니다.',
    samplePrompts: [
      '신제품 출시 공지를 LinkedIn용으로 작성해줘',
      '같은 내용을 Instagram 스타일로 바꿔줘',
      '최적 해시태그 10개를 추천해줘',
      '다음 주 콘텐츠 캘린더 초안을 만들어줘',
    ],
    skills: ['콘텐츠 초안 작성', 'SNS 게시물 생성', '키워드 분석', '웹 검색'],
    subOptions: [
      'SNS 채널별 포맷 자동 최적화',
      '해시태그 자동 생성',
      '뉴스·트렌드 검색',
      '주간 콘텐츠 캘린더 초안',
    ],
    mcps: ['Slack'],
  },
  {
    id: 'mpl-07', category: '경영지원', Icon: Shield,
    title: '규정 준수 감사 에이전트',
    author: 'Byr 제공',
    shortDesc: '내부 정책과 외부 규정 대비 준수 여부를 자동으로 점검합니다.',
    longDesc:
      '개인정보보호법, ISO 27001 등 적용 규정과 내부 정책을 기준으로 현행 프로세스·문서의 준수 여부를 점검하고 ' +
      '미준수 항목과 조치 계획을 보고서로 생성합니다. ' +
      '분기별 내부 감사 체크리스트를 자동화하여 감사 준비 시간을 단축합니다.',
    samplePrompts: [
      '이번 분기 내부 감사 체크리스트를 생성해줘',
      '개인정보보호법 준수 여부를 점검해줘',
      '미준수 항목과 조치 계획을 보고서로 만들어줘',
      'ISO 27001 통제 항목과 현재 정책을 대조해줘',
    ],
    skills: ['문서 요약', '데이터 분석', '보고서 생성', '파일 관리'],
    subOptions: [
      '체크리스트 자동 생성',
      '미준수 항목 탐지',
      '조치 계획 보고서 생성',
      'PDF 내보내기',
    ],
    mcps: [],
  },
  {
    id: 'mpl-08', category: '영업·CS', Icon: FileCheck,
    title: '계약서 검토 에이전트',
    author: 'Byr 제공',
    shortDesc: '계약서의 위험 조항과 누락 항목을 자동으로 식별하고 요약 보고서를 생성합니다.',
    longDesc:
      '계약서 원문을 업로드하면 표준 계약 조항과 비교하여 불리한 조건, 위약금 구조, 갱신 조항의 위험 여부를 분석합니다. ' +
      '법무팀 검토 전 사전 스크리닝으로 활용하여 리뷰 시간을 단축하고 놓치기 쉬운 조항을 사전에 식별합니다.',
    samplePrompts: [
      '이 계약서에서 불리한 조항을 찾아줘',
      '위약금 조건이 표준 범위 안에 있어?',
      '계약 기간과 갱신 조건을 요약해줘',
      '누락된 필수 조항이 있는지 확인해줘',
    ],
    skills: ['계약서 검토', '문서 요약', '보고서 생성', '파일 관리'],
    subOptions: [
      '위험 조항 자동 탐지',
      '표준 조항 누락 확인',
      '계약 요약 보고서 생성',
      'PDF 내보내기',
    ],
    mcps: [],
  },
  {
    id: 'mpl-09', category: '개발·운영', Icon: GitPullRequest,
    title: 'PR 리뷰 요약 에이전트',
    author: 'Byr 제공',
    shortDesc: 'PR 변경사항을 자동 요약하고 로그 이상 항목을 탐지해 팀에 공유합니다.',
    longDesc:
      'GitHub PR의 diff(변경 내역)와 코멘트를 분석하여 변경 요약, 리스크 항목, 테스트 필요 영역을 자동으로 정리하고 Slack 채널로 공유합니다. ' +
      '로그 이상 패턴이 감지되면 즉시 온콜 알림을 발송하여 빠른 대응을 지원합니다.',
    samplePrompts: [
      '오늘 열린 PR 목록을 요약해줘',
      '이 PR의 변경사항과 리스크를 분석해줘',
      '어제 로그에서 이상 패턴을 찾아줘',
      'PR 리뷰 결과를 Slack으로 공유해줘',
    ],
    skills: ['PR 리뷰 요약', '로그 분석', '이상 알림', '보고서 생성'],
    subOptions: [
      'PR diff 자동 요약',
      '리스크 항목 탐지',
      '에러·이상 패턴 탐지',
      'Slack 알림 발송',
    ],
    mcps: ['GitHub', 'Slack'],
  },
  {
    id: 'mpl-10', category: '기획/PM', Icon: Search,
    title: '경쟁사 리서치 에이전트',
    author: 'Byr 제공',
    shortDesc: '경쟁사 동향과 가격 변동을 자동 수집하고 주간 경쟁사 리포트를 생성합니다.',
    longDesc:
      '지정 경쟁사의 공개 뉴스·공시·가격 정보를 주기적으로 수집·비교하여 변동이 감지되면 즉시 알림을 발송합니다. ' +
      '주간 경쟁사 동향 리포트로 전략 의사결정을 지원하며, 시장 변화에 빠른 대응을 가능하게 합니다.',
    samplePrompts: [
      '주요 경쟁사 3사의 최신 동향을 수집해줘',
      '경쟁사 가격 변동을 비교 분석해줘',
      '이번 주 경쟁사 뉴스를 요약해줘',
      '경쟁사 리서치 주간 리포트를 만들어줘',
    ],
    skills: ['경쟁사 리서치', '웹 검색', '마케팅 리포트', '보고서 생성'],
    subOptions: [
      '뉴스·공시 자동 수집',
      '가격 변동 모니터링',
      '변동 감지 시 즉시 알림',
      '주간 요약 리포트',
    ],
    mcps: [],
  },
]

interface McpDef {
  id: string
  name: string
  category: string
  Icon: LucideIcon
  shortDesc: string
  longDesc: string
  status: '연결됨' | '미연결'
}

const MCPS: McpDef[] = [
  {
    id: 'm-01', name: '국세청 전자세금계산서', category: '금융', Icon: Receipt, status: '연결됨',
    shortDesc: '전자세금계산서 발행·조회 데이터를 에이전트에 연결합니다.',
    longDesc: '국세청 전자세금계산서 API를 통해 매입·매출 세금계산서를 실시간으로 조회하고 에이전트가 자동 대사 업무를 수행할 수 있도록 합니다.',
  },
  {
    id: 'm-02', name: 'GitHub', category: '개발', Icon: Code2, status: '연결됨',
    shortDesc: 'GitHub 리포지토리와 PR 데이터를 에이전트에 연결합니다.',
    longDesc: 'GitHub 조직 리포지토리에 대한 읽기 권한을 부여하여 PR 리뷰 요약, 코드 변경 추적 등의 업무를 자동화합니다.',
  },
  {
    id: 'm-03', name: 'Slack', category: '메신저', Icon: MessageSquare, status: '연결됨',
    shortDesc: 'Slack 채널로 에이전트 결과와 알림을 발송합니다.',
    longDesc: '에이전트가 생성한 보고서, 이상 알림, 업무 완료 메시지를 지정 Slack 채널로 자동 발송합니다. 봇 권한이 필요합니다.',
  },
  {
    id: 'm-04', name: 'Google Workspace', category: '생산성', Icon: Globe, status: '미연결',
    shortDesc: 'Google Drive, Docs, Sheets 데이터를 에이전트에 연결합니다.',
    longDesc: 'Google Drive 파일 접근, Docs 초안 작성, Sheets 데이터 읽기/쓰기를 에이전트가 수행할 수 있도록 OAuth 권한을 부여합니다.',
  },
  {
    id: 'm-05', name: 'Jira', category: '개발', Icon: LayoutDashboard, status: '미연결',
    shortDesc: 'Jira 이슈와 스프린트 데이터를 에이전트에 연결합니다.',
    longDesc: 'Jira 프로젝트의 이슈 생성·업데이트·조회 권한을 에이전트에 부여합니다. 스프린트 리포트 자동화에 활용합니다.',
  },
  {
    id: 'm-06', name: 'PagerDuty', category: '운영', Icon: AlertTriangle, status: '미연결',
    shortDesc: '에스컬레이션 정책과 온콜 알림을 에이전트에 연결합니다.',
    longDesc: '이상 탐지 시 PagerDuty 에스컬레이션 정책에 따라 온콜 담당자에게 자동으로 인시던트(운영 장애 알림)를 생성하고 알림을 발송합니다.',
  },
  // ── 브랜드 사이트 연동 목록(13종)과 맞춤 — 콘솔에 없던 10종 ──
  {
    id: 'm-07', name: 'Microsoft Teams', category: '메신저', Icon: MessageSquare, status: '미연결',
    shortDesc: 'Teams 채널에서 에이전트에게 요청하고 결과를 받습니다.',
    longDesc: 'Teams 채널과 대화에서 @멘션으로 에이전트를 호출합니다. 결과 보고와 승인 요청도 같은 채널로 전달합니다. 조직 관리자의 앱 승인이 필요합니다.',
  },
  {
    id: 'm-08', name: 'Telegram', category: '메신저', Icon: MessageSquare, status: '미연결',
    shortDesc: 'Telegram 그룹에서 에이전트에게 요청하고 결과를 받습니다.',
    longDesc: 'Telegram 봇으로 그룹 대화에 에이전트를 배치합니다. 요청·결과·승인 요청이 같은 대화에서 오갑니다. 봇 토큰이 필요합니다.',
  },
  {
    id: 'm-09', name: 'Discord', category: '메신저', Icon: MessageSquare, status: '미연결',
    shortDesc: 'Discord 채널에서 에이전트에게 요청하고 결과를 받습니다.',
    longDesc: 'Discord 서버 채널에 에이전트 봇을 배치합니다. 채널에서 @멘션으로 요청하고, 결과와 승인 요청을 같은 채널로 받습니다.',
  },
  {
    id: 'm-10', name: 'Google Drive', category: '생산성', Icon: Globe, status: '연결됨',
    shortDesc: '공유 드라이브의 문서를 에이전트가 근거 자료로 읽습니다.',
    longDesc: '지정한 공유 드라이브·폴더의 파일을 에이전트가 조회합니다. 결과물 초안은 지정 폴더에 새 파일로 저장합니다. 기존 파일 덮어쓰기는 승인 후에만 실행합니다.',
  },
  {
    id: 'm-11', name: 'Gmail', category: '생산성', Icon: Globe, status: '미연결',
    shortDesc: '메일 초안을 만들고 승인 후 발송합니다.',
    longDesc: '받은 메일을 조회해 요약하고, 회신·발송 메일 초안을 작성합니다. 외부로 나가는 메일은 담당자 승인 후에만 발송합니다.',
  },
  {
    id: 'm-12', name: 'Google Sheets', category: '생산성', Icon: BarChart2, status: '미연결',
    shortDesc: '시트 데이터를 읽어 집계하고 결과를 기록합니다.',
    longDesc: '지정한 스프레드시트의 데이터를 읽어 집계·대사합니다. 결과는 새 시트나 지정 범위에 기록하며, 기존 값 수정은 승인 후에만 실행합니다.',
  },
  {
    id: 'm-13', name: 'Google Meet', category: '생산성', Icon: Mic, status: '미연결',
    shortDesc: '회의 기록을 받아 회의록과 후속 작업을 정리합니다.',
    longDesc: 'Google Meet 회의 기록(녹취·자막)을 받아 회의록을 작성하고, 담당자별 후속 작업을 정리해 채널로 전달합니다.',
  },
  {
    id: 'm-14', name: '사내 ERP (더존)', category: '금융', Icon: Receipt, status: '미연결',
    shortDesc: '전표·거래처 데이터를 조회해 마감·대사에 씁니다.',
    longDesc: '더존 ERP의 전표·계정·거래처 데이터를 조회합니다. 월마감 점검과 세금계산서 대사에 활용하며, 전표 생성·수정은 승인 후에만 실행합니다.',
  },
  {
    id: 'm-15', name: 'Confluence', category: '문서', Icon: FileCheck, status: '미연결',
    shortDesc: '사내 위키 문서를 근거 자료로 읽고 페이지를 작성합니다.',
    longDesc: 'Confluence 스페이스의 페이지를 근거 자료로 조회합니다. 회의록·기획서 초안을 새 페이지로 작성하며, 기존 페이지 수정은 승인 후에만 실행합니다.',
  },
  {
    id: 'm-16', name: 'SharePoint', category: '문서', Icon: FileCheck, status: '미연결',
    shortDesc: '사이트·문서 라이브러리의 파일을 근거 자료로 읽습니다.',
    longDesc: 'SharePoint 사이트와 문서 라이브러리의 파일을 조회합니다. 결과물은 지정 라이브러리에 새 파일로 저장하며, 덮어쓰기는 승인 후에만 실행합니다.',
  },
]

// ── 아이콘 배지 ────────────────────────────────────────────────

function IconBadge({ Icon, size = 44 }: { Icon: LucideIcon; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius-element)',
      background: 'var(--color-background-body)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={size * 0.44} strokeWidth={1.8} color="var(--color-icon-primary)" />
    </div>
  )
}

// ── 템플릿 상세 모달 (참조 이미지 스타일) ────────────────────────

function TemplateDetailModal({
  tpl, onClose, onApply,
}: {
  tpl: TplDef
  onClose: () => void
  onApply: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--color-background-surface)',
          borderRadius: 'var(--radius-container)', width: 540, maxWidth: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 28px' }}>

          {/* 헤더: 아이콘 + 타이틀 + 버튼 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'var(--color-background-muted)',
                border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <tpl.Icon size={22} strokeWidth={1.8} color="var(--color-icon-primary)" />
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Figtree, -apple-system, sans-serif', lineHeight: 1.25 }}>
                  {tpl.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', marginTop: 3 }}>
                  {tpl.author}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 16, marginTop: 2,
              }}
            >
              <AstryxIcon icon={X} size="sm" color="secondary" strokeWidth={2} />
            </button>
          </div>

          {/* 설명 */}
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: '0 0 20px', fontFamily: 'inherit' }}>
            {tpl.longDesc}
          </p>

          {/* 샘플 프롬프트 */}
          {tpl.samplePrompts.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10, fontFamily: 'inherit' }}>
                다음과 같이 질문해 보세요...
              </div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', overflow: 'hidden' }}>
                {tpl.samplePrompts.map((prompt, i) => (
                  <div key={i} style={{
                    padding: '11px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                    lineHeight: 1.45,
                  }}>
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 세부 스킬 옵션 */}
          {tpl.subOptions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10, fontFamily: 'inherit' }}>
                사전 설정된 세부 옵션
              </div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                {tpl.subOptions.map((opt, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '9px 14px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'var(--color-status-active)', display: 'flex' }}><AstryxIcon icon={Check} size="xsm" color="inherit" strokeWidth={3} /></span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 스킬 */}
          {tpl.skills.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>스킬</span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  background: 'var(--color-background-muted)',
                  color: 'var(--color-text-secondary)',
                  padding: '1px 7px', borderRadius: 'var(--radius-full)', fontFamily: 'inherit',
                }}>
                  {tpl.skills.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tpl.skills.map(s => (
                  <span key={s} style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background-muted)',
                    fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 커넥터 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>커넥터</span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                background: 'var(--color-background-muted)',
                color: 'var(--color-text-secondary)',
                padding: '1px 7px', borderRadius: 'var(--radius-full)', fontFamily: 'inherit',
              }}>
                {tpl.mcps.length}
              </span>
            </div>
            {tpl.mcps.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, fontFamily: 'inherit' }}>
                외부 커넥터 없이 바로 사용할 수 있습니다.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px', fontFamily: 'inherit' }}>
                  MCP(Model Context Protocol)를 통해 연결된 외부 서비스 및 도구입니다.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tpl.mcps.map(m => (
                    <span key={m} style={{
                      padding: '6px 12px', borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-background-muted)',
                      fontSize: 13, color: 'var(--color-text-primary)', fontFamily: 'inherit',
                    }}>
                      {m}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '14px 28px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 12, color: '#a3a3a3', margin: 0, fontFamily: 'inherit' }}>
            설치 후 조직에서 세부 설정을 완료하세요.
          </p>
          <button
            onClick={onApply}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              background: '#1a1a1a', color: 'white',
              border: 'none', borderRadius: 'var(--radius-full)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <AstryxIcon icon={Plus} size="sm" />
            적용하기
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 서비스 로고 SVG ───────────────────────────────────────────

function GitHubLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1a1a1a">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function SlackLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6.527 14.514a2.4 2.4 0 01-2.4 2.4 2.4 2.4 0 01-2.4-2.4 2.4 2.4 0 012.4-2.4h2.4v2.4z" fill="#E01E5A"/>
      <path d="M7.74 14.514a2.4 2.4 0 012.4-2.4 2.4 2.4 0 012.4 2.4v6.013a2.4 2.4 0 01-2.4 2.4 2.4 2.4 0 01-2.4-2.4v-6.013z" fill="#E01E5A"/>
      <path d="M10.14 6.527a2.4 2.4 0 01-2.4-2.4 2.4 2.4 0 012.4-2.4 2.4 2.4 0 012.4 2.4v2.4H10.14z" fill="#36C5F0"/>
      <path d="M10.14 7.74a2.4 2.4 0 012.4 2.4 2.4 2.4 0 01-2.4 2.4H4.127a2.4 2.4 0 01-2.4-2.4 2.4 2.4 0 012.4-2.4H10.14z" fill="#36C5F0"/>
      <path d="M17.473 10.14a2.4 2.4 0 012.4-2.4 2.4 2.4 0 012.4 2.4 2.4 2.4 0 01-2.4 2.4h-2.4V10.14z" fill="#2EB67D"/>
      <path d="M16.26 10.14a2.4 2.4 0 01-2.4 2.4 2.4 2.4 0 01-2.4-2.4V4.127a2.4 2.4 0 012.4-2.4 2.4 2.4 0 012.4 2.4V10.14z" fill="#2EB67D"/>
      <path d="M13.86 17.473a2.4 2.4 0 012.4 2.4 2.4 2.4 0 01-2.4 2.4 2.4 2.4 0 01-2.4-2.4v-2.4h2.4z" fill="#ECB22E"/>
      <path d="M13.86 16.26a2.4 2.4 0 01-2.4-2.4 2.4 2.4 0 012.4-2.4h6.013a2.4 2.4 0 012.4 2.4 2.4 2.4 0 01-2.4 2.4H13.86z" fill="#ECB22E"/>
    </svg>
  )
}

function GoogleWorkspaceLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function JiraLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.75 2L1.75 12a1 1 0 000 1.41l4.5 4.5L12 12l5.75 5.91 4.5-4.5A1 1 0 0022.25 12L12.66 2a1 1 0 00-1.41.41L11.75 2z" fill="#0052CC"/>
      <path d="M12 7.59L6.66 12.94 12 18.28l5.34-5.34L12 7.59z" fill="#2684FF"/>
    </svg>
  )
}

function PagerDutyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#06AC38"/>
      <path d="M7.5 5.5h4.8c2.8 0 4.2 1.6 4.2 3.8 0 2.3-1.5 3.9-4.3 3.9H9.8v4.8H7.5V5.5zm2.3 5.8h2.3c1.4 0 2.1-.7 2.1-2 0-1.2-.7-1.9-2-1.9H9.8v3.9z" fill="white"/>
    </svg>
  )
}

function NTSLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#003C8F"/>
      <rect x="5" y="7" width="14" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
      <rect x="5" y="10.8" width="14" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
      <rect x="5" y="14.6" width="9" height="1.8" rx="0.9" fill="white" opacity="0.95"/>
    </svg>
  )
}

// 브랜드 사이트(web/index.html #m-teams·m-meet·m-confluence·m-sharepoint)와 같은 SVG
function TeamsLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="18" cy="6" r="2.5" fill="#5059C9" /><rect x="13" y="9" width="9" height="8" rx="1.8" fill="#5059C9" />
      <circle cx="9.6" cy="5.8" r="3" fill="#7B83EB" /><rect x="2" y="8.8" width="14" height="11.2" rx="1.8" fill="#7B83EB" />
      <path d="M5 11.6h8v1.7h-3v5.8H8v-5.8H5z" fill="#fff" />
    </svg>
  )
}

function MeetLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="2.5" y="6" width="11" height="12" rx="1.8" fill="#0066DA" />
      <path d="M13.5 9.6l4-3.1c.6-.5 1.5 0 1.5.8v9.4c0 .8-.9 1.3-1.5.8l-4-3.1V9.6z" fill="#00AC47" />
      <path d="M2.5 9.6V7.8c0-1 .8-1.8 1.8-1.8h3.4L2.5 9.6z" fill="#E94235" />
      <path d="M13.5 14.4v1.8c0 1-.8 1.8-1.8 1.8H8.3l5.2-3.6z" fill="#FFBA00" />
    </svg>
  )
}

function ConfluenceLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M2.4 16.9c-.3.5-.1 1.1.4 1.4l4.2 2.6c.5.3 1.1.1 1.4-.4 1.6-2.7 3-2.4 5.5-1.2l4.2 2c.5.2 1.1 0 1.3-.5l2-4.5c.2-.5 0-1.1-.5-1.3-1.8-.8-5.2-2.5-8.4-2.5-4.2 0-7.9 2.6-10.1 4.4z" fill="#2684FF" />
      <path d="M21.6 7.1c.3-.5.1-1.1-.4-1.4L17 3.1c-.5-.3-1.1-.1-1.4.4-1.6 2.7-3 2.4-5.5 1.2l-4.2-2c-.5-.2-1.1 0-1.3.5l-2 4.5c-.2.5 0 1.1.5 1.3 1.8.8 5.2 2.5 8.4 2.5 4.2 0 7.9-2.6 10.1-4.4z" fill="#0052CC" />
    </svg>
  )
}

function SharePointLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="10.5" cy="6.6" r="4.6" fill="#036C70" /><circle cx="16.6" cy="12.4" r="4.6" fill="#1A9BA1" />
      <circle cx="11.4" cy="17.6" r="3.9" fill="#37C6D0" /><rect x="2" y="8.4" width="10.4" height="10.4" rx="1.2" fill="#03787C" />
      <path d="M9.9 11.9c-.35-.42-.95-.7-1.65-.7-.9 0-1.5.4-1.5 1 0 .6.5.85 1.6 1.15 1.4.4 2.2.9 2.2 2.1 0 1.3-1.1 2.05-2.6 2.05-1.1 0-2-.4-2.55-1.1l.9-.85c.4.5 1 .8 1.7.8.8 0 1.3-.3 1.3-.85 0-.5-.4-.8-1.5-1.1-1.3-.4-2.3-.9-2.3-2.1 0-1.2 1-2.1 2.7-2.1 1 0 1.85.4 2.4 1z" fill="#fff" />
    </svg>
  )
}

const MCP_SERVICE_LOGOS: Record<string, React.FC<{ size?: number }>> = {
  'm-01': NTSLogo,
  'm-02': GitHubLogo,
  'm-03': SlackLogo,
  'm-04': GoogleWorkspaceLogo,
  'm-05': JiraLogo,
  'm-06': PagerDutyLogo,
  'm-07': TeamsLogo,
  'm-08': PLATFORM_LOGOS.telegram,
  'm-09': PLATFORM_LOGOS.discord,
  'm-10': MCP_LOGOS.gdrive,
  'm-11': MCP_LOGOS.gmail,
  'm-12': MCP_LOGOS.sheets,
  'm-13': MeetLogo,
  'm-14': MCP_LOGOS.erp,
  'm-15': ConfluenceLogo,
  'm-16': SharePointLogo,
}

function McpLogoIcon({ id, size = 44 }: { id: string; size?: number }) {
  const Logo = MCP_SERVICE_LOGOS[id]
  const logoSize = Math.round(size * 0.52)
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--radius-element)',
      background: '#fff',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {Logo && <Logo size={logoSize} />}
    </div>
  )
}

// ── MCP 도구 권한 ─────────────────────────────────────────────

type ToolPerm = 'locked' | 'auto' | 'approve' | 'disabled'

const MCP_TOOLS_MAP: Record<string, string[]> = {
  'm-01': ['get_tax_invoice', 'list_invoices', 'verify_business_number', 'download_certificate', 'check_payment_status'],
  'm-02': ['list_repos', 'get_pull_request', 'list_pr_comments', 'get_commit_diff', 'create_review_comment', 'merge_pull_request'],
  'm-03': ['send_message', 'list_channels', 'get_channel_history', 'upload_file', 'create_channel'],
  'm-04': ['list_drive_files', 'read_document', 'write_document', 'read_spreadsheet', 'write_spreadsheet'],
  'm-05': ['list_issues', 'create_issue', 'update_issue', 'list_sprints', 'get_board', 'add_comment'],
  'm-06': ['create_incident', 'acknowledge_incident', 'resolve_incident', 'list_on_call_schedules', 'escalate_incident'],
  'm-07': ['send_message', 'list_channels', 'get_channel_messages', 'reply_to_thread', 'upload_file'],
  'm-08': ['send_message', 'get_updates', 'reply_to_message', 'send_document'],
  'm-09': ['send_message', 'list_channels', 'get_channel_messages', 'create_thread'],
  'm-10': ['list_files', 'search_files', 'read_file', 'create_file', 'update_file'],
  'm-11': ['list_messages', 'read_message', 'create_draft', 'send_message'],
  'm-12': ['read_range', 'append_rows', 'create_sheet', 'update_range'],
  'm-13': ['list_meetings', 'get_transcript', 'get_recording'],
  'm-14': ['list_vouchers', 'get_account_balance', 'list_vendors', 'create_voucher'],
  'm-15': ['search_pages', 'read_page', 'create_page', 'update_page'],
  'm-16': ['list_sites', 'search_documents', 'read_document', 'upload_document'],
}

const MP_PERM_OPTIONS: Array<{ type: ToolPerm; Icon: React.ElementType; activeColor: string; label: string }> = [
  { type: 'locked',   Icon: Lock,  activeColor: '#1a1a1a', label: '조직에서 관리' },
  { type: 'auto',     Icon: Check, activeColor: '#1a1a1a', label: '자동 승인' },
  { type: 'approve',  Icon: Hand,  activeColor: '#1a1a1a', label: '승인 필요' },
  { type: 'disabled', Icon: Ban,   activeColor: '#1a1a1a', label: '사용 안 함' },
]

const MP_GROUP_PERM_LABELS: Record<ToolPerm, string> = {
  locked: '조직에서 관리', auto: '자동 승인', approve: '승인 필요', disabled: '사용 안 함',
}
const MP_USER_PERMS: ToolPerm[] = ['auto', 'approve', 'disabled']

function McpDetailModal({
  mcp, onClose, onConnect,
}: {
  mcp: McpDef
  onClose: () => void
  onConnect: () => void
}) {
  const tools = MCP_TOOLS_MAP[mcp.id] ?? []
  const [toolPerms, setToolPerms] = useState<Record<string, ToolPerm>>({})
  const [groupPerm, setGroupPerm] = useState<ToolPerm>('approve')
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [gpDropdown, setGpDropdown] = useState(false)
  const gpRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gpDropdown) return
    const handler = (e: MouseEvent) => { if (!gpRef.current?.contains(e.target as Node)) setGpDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [gpDropdown])

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--color-background-surface)',
          borderRadius: 'var(--radius-container)', width: 560, maxWidth: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 24px', position: 'relative' }}>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1,
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--color-background-muted)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <AstryxIcon icon={X} size="sm" strokeWidth={2} />
          </button>

          <div style={{ marginBottom: 14 }}>
            <McpLogoIcon id={mcp.id} size={40} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', fontFamily: 'inherit', marginBottom: 8, lineHeight: 1.2 }}>
            {mcp.name}
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.65, color: '#525252', margin: '0 0 20px', fontFamily: 'inherit' }}>
            {mcp.longDesc}
          </p>

          <div style={{ marginBottom: 20 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
              background: mcp.status === '연결됨' ? 'rgba(22,163,74,0.1)' : 'var(--color-background-muted)',
              color: mcp.status === '연결됨' ? 'var(--color-status-active)' : 'var(--color-text-secondary)',
              border: mcp.status === '연결됨' ? '1px solid rgba(22,163,74,0.25)' : '1px solid var(--color-border)',
            }}>
              {mcp.status === '연결됨' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-status-active)', display: 'inline-block' }} />
              )}
              {mcp.status}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', marginBottom: 6 }}>
              도구 권한
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 16 }}>
              에이전트가 이 커넥터의 도구를 사용할 수 있는 시기를 선택하세요. 조직에서 접근 권한을 부여한 도구만 볼 수 있습니다.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={() => setToolsExpanded(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                {toolsExpanded
                  ? <AstryxIcon icon={ChevronDown} size="sm" color="secondary" />
                  : <AstryxIcon icon={ChevronRight} size="sm" color="secondary" />
                }
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>기타 도구</span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
                  background: 'var(--color-background-muted)', borderRadius: 'var(--radius-full)',
                  padding: '1px 7px', fontFamily: 'inherit',
                }}>
                  {tools.length}
                </span>
              </button>

              <div ref={gpRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setGpDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px 5px 10px', borderRadius: 'var(--radius-inner)',
                    border: '1px solid var(--color-border-emphasized)',
                    background: 'var(--color-background-surface)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    color: 'var(--color-text-primary)', fontFamily: 'inherit',
                  }}
                >
                  {(() => {
                    const opt = MP_PERM_OPTIONS.find(o => o.type === groupPerm)
                    return opt ? <opt.Icon size={13} strokeWidth={2} color={opt.activeColor} /> : null
                  })()}
                  {MP_GROUP_PERM_LABELS[groupPerm]}
                  <AstryxIcon icon={ChevronDown} size="xsm" color="secondary" />
                </button>
                {gpDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'var(--color-background-surface)',
                    border: '1px solid var(--color-border-emphasized)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 10, overflow: 'hidden', minWidth: 140,
                  }}>
                    {MP_USER_PERMS.map(p => {
                      const opt = MP_PERM_OPTIONS.find(o => o.type === p)!
                      return (
                        <button key={p}
                          onClick={() => { setGroupPerm(p); setGpDropdown(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '9px 14px',
                            background: groupPerm === p ? 'var(--color-background-muted)' : 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            fontSize: 13, fontWeight: 500,
                            color: 'var(--color-text-primary)', fontFamily: 'inherit',
                          }}
                        >
                          <opt.Icon size={13} strokeWidth={2} color={opt.activeColor} />
                          {MP_GROUP_PERM_LABELS[p]}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {toolsExpanded && tools.map(tool => {
              const perm = toolPerms[tool] ?? groupPerm
              return (
                <div key={tool} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0',
                  borderTop: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit' }}>{tool}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {MP_PERM_OPTIONS.map(opt => {
                      const active = perm === opt.type
                      return (
                        <button
                          key={opt.type}
                          title={opt.label}
                          onClick={() => opt.type !== 'locked' && setToolPerms(prev => ({ ...prev, [tool]: opt.type }))}
                          style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: active ? 'rgba(0,0,0,0.08)' : 'transparent',
                            border: `1.5px solid ${active ? '#1a1a1a' : 'transparent'}`,
                            cursor: opt.type !== 'locked' ? 'pointer' : 'default',
                            color: active ? '#1a1a1a' : 'var(--color-icon-secondary)',
                            transition: 'all 0.12s',
                          }}
                        >
                          <opt.Icon size={13} strokeWidth={2} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '16px 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 12, color: '#a3a3a3', margin: 0, fontFamily: 'inherit' }}>
            관리자만 조직 전체 연결을 추가·해제할 수 있습니다.
          </p>
          <button
            onClick={onConnect}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', flexShrink: 0, marginLeft: 16,
              background: '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-full)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <AstryxIcon icon={Plus} size="sm" />
            {mcp.status === '연결됨' ? '연결 해제' : '조직에 연결'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function Marketplace() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('templates')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [selectedTpl, setSelectedTpl] = useState<TplDef | null>(null)
  const [selectedMcp, setSelectedMcp] = useState<McpDef | null>(null)
  const [meta, setMeta] = useState<Meta>({ templates: [], platforms: [], mcp_catalog: [] })
  const [isHireOpen, setIsHireOpen] = useState(false)
  const [hireTemplateKey, setHireTemplateKey] = useState('blank')
  const [mcps, setMcps] = useState(MCPS)

  useEffect(() => {
    fetch('/api/meta').then(r => r.json()).then(setMeta)
  }, [])

  const handleTabChange = (v: string) => {
    setTab(v as TabKey)
    setSearchQuery('')
    setSelectedCategory('전체')
  }

  const handleApplyTemplate = () => {
    if (!selectedTpl) return
    setHireTemplateKey(HIRE_KEY[selectedTpl.id] ?? 'blank')
    setSelectedTpl(null)
    setIsHireOpen(true)
  }

  const handleConnectMcp = () => {
    if (!selectedMcp) return
    setMcps(prev => prev.map(m =>
      m.id === selectedMcp.id ? { ...m, status: m.status === '연결됨' ? '미연결' : '연결됨' } : m
    ))
    setSelectedMcp(null)
  }

  const handleHire = (newAgent: Agent) => {
    setIsHireOpen(false)
    navigate(`/agents/${newAgent.id}`)
  }

  const q = searchQuery.toLowerCase()
  const hasFilter = searchQuery !== '' || selectedCategory !== '전체'

  // 에이전트 템플릿 = 백엔드 카탈로그(meta.templates, blank 제외) — 전체 에이전트 카탈로그 일원화
  const catalogTemplates = meta.templates.filter(t => t.key !== 'blank')
  const tplCategories = ['전체', ...Array.from(new Set(catalogTemplates.map(t => t.category ?? '기타')))]

  const filteredCatalog = catalogTemplates.filter(t => {
    const matchCat = selectedCategory === '전체' || (t.category ?? '기타') === selectedCategory
    const matchQ = !q || t.name.toLowerCase().includes(q) || t.purpose.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q)
    return matchCat && matchQ
  })

  const filteredMcps = mcps.filter(m => {
    const matchCat = selectedCategory === '전체' || m.category === selectedCategory
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.shortDesc.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  const categories = tab === 'templates' ? tplCategories : MCP_CATEGORIES

  return (
    <>
    <VStack gap={0} style={{ padding: '32px 40px', gap: 0 }}>

      <Heading level={2} style={{ marginBottom: 24 }}>마켓플레이스</Heading>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <FilterDropdown
          label="카테고리"
          options={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
          minDropdownWidth={200}
        />
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={tab === 'templates' ? '에이전트 템플릿 검색...' : 'MCP 커넥터 검색...'}
        />
        {hasFilter && (
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('전체') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 4px', fontSize: 14, fontFamily: 'inherit',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap', flexShrink: 0,
              textDecoration: 'underline', fontWeight: 600,
            }}
          >
            초기화
          </button>
        )}
      </div>

      <TabList value={tab} onChange={handleTabChange} aria-label="마켓플레이스 탭" hasDivider>
        <Tab value="templates" label="에이전트 템플릿" />
        <Tab value="mcp" label="MCP 커넥터" />
      </TabList>

      {/* ── 템플릿 탭 (백엔드 카탈로그 meta.templates 전체) ── */}
      {tab === 'templates' && (
        <div style={{ marginTop: 24 }}>
          {filteredCatalog.length === 0 ? (
            <div style={{
              padding: '60px 0', textAlign: 'center',
              color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'inherit',
            }}>
              {meta.templates.length === 0 ? '카탈로그를 불러오는 중...' : '검색 결과가 없습니다.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {filteredCatalog.map(tpl => (
                <div
                  key={tpl.key}
                  onClick={() => { setHireTemplateKey(tpl.key); setIsHireOpen(true) }}
                  style={{
                    minWidth: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-background-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <AgentIconBadge emoji={tpl.icon} boxSize={42} iconSize={19} radius={12} mono monoLevel="secondary" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tpl.name}
                      </span>
                      {tpl.category && (
                        <span style={{
                          flexShrink: 0, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)',
                          fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                        }}>{tpl.category}</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'inherit',
                      lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {tpl.purpose}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setHireTemplateKey(tpl.key); setIsHireOpen(true) }}
                      style={{
                        padding: '7px 16px', borderRadius: 'var(--radius-full)',
                        background: 'var(--color-accent)', color: 'var(--color-on-accent)',
                        border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      적용하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MCP 탭 ── */}
      {tab === 'mcp' && (
        <div style={{ marginTop: 24 }}>
          <Banner
            status="info"
            title="MCP (외부 도구 연결) 관리"
            description="조직 관리자(Admin)만 MCP 연결을 추가·해제할 수 있습니다. 연결된 MCP는 조직 스킬 구획에서 선택 가능합니다."
          />

          <div style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}>
            {filteredMcps.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '60px 0', textAlign: 'center',
                color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'inherit',
              }}>
                검색 결과가 없습니다.
              </div>
            ) : filteredMcps.map(mcp => (
              <ClickableCard
                key={mcp.id}
                label={mcp.name}
                onClick={() => setSelectedMcp(mcp)}
                width="100%"
              >
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  padding: '4px 2px',
                }}>
                  {/* 아이콘 오른쪽에 제목·설명을 붙여 카드 높이를 줄인다 — [아이콘 | 제목+설명 | 스위치] */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <McpLogoIcon id={mcp.id} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <VStack gap={1}>
                        <Text type="large" style={{ fontWeight: 600 }}>{mcp.name}</Text>
                        <Text type="supporting" color="secondary">{mcp.shortDesc}</Text>
                      </VStack>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <Switch
                        label={mcp.name}
                        isLabelHidden
                        value={mcp.status === '연결됨'}
                        onChange={(v) => setMcps(prev => prev.map(m =>
                          m.id === mcp.id ? { ...m, status: v ? '연결됨' : '미연결' } : m
                        ))}
                      />
                    </div>
                  </div>
                  <div style={{
                    marginTop: 16, paddingTop: 12,
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {mcp.category}
                    </span>
                  </div>
                </div>
              </ClickableCard>
            ))}
          </div>
        </div>
      )}
    </VStack>

    {selectedTpl && (
      <TemplateDetailModal
        tpl={selectedTpl}
        onClose={() => setSelectedTpl(null)}
        onApply={handleApplyTemplate}
      />
    )}

    {selectedMcp && (
      <McpDetailModal
        mcp={selectedMcp}
        onClose={() => setSelectedMcp(null)}
        onConnect={handleConnectMcp}
      />
    )}

    <HireModal
      isOpen={isHireOpen}
      onClose={() => setIsHireOpen(false)}
      onHire={newAgent => handleHire(newAgent as Agent)}
      meta={meta}
      initialTemplate={hireTemplateKey}
    />
    </>
  )
}
