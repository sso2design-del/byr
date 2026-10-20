import json, uuid, os
from datetime import date
from pathlib import Path

DATA_FILE = os.path.join(os.path.dirname(__file__), "../data/agents.json")

PLATFORMS = [
    {"key": "slack", "name": "Slack", "icon": "💬"},
    {"key": "discord", "name": "Discord", "icon": "🎧"},
    {"key": "telegram", "name": "Telegram", "icon": "✈️"},
]

MCP_CATALOG = [
    {"key": "gdrive",   "name": "Google Drive",    "icon": "📂"},
    {"key": "email",    "name": "Gmail",           "icon": "✉️"},
    {"key": "hometax",  "name": "국세청 홈택스",    "icon": "🏛️"},
    {"key": "erp",      "name": "사내 ERP (더존)", "icon": "🗄️"},
    {"key": "sheets",   "name": "Google Sheets",    "icon": "📊"},
    {"key": "jira",     "name": "Jira",             "icon": "🔷"},
]

TEMPLATES = [
    # ── 공통 업무 (모든 직무에 노출) ────────────────────
    {"key": "common_doc", "icon": "📄", "category": "공통 업무", "name": "문서 요약", "purpose": "PDF·링크·텍스트의 핵심 내용 3줄 요약", "job": None},
    {"key": "common_meeting", "icon": "🎙️", "category": "공통 업무", "name": "회의록 정리", "purpose": "회의 내용 붙여넣기 → 요약·안건·액션아이템 자동 추출", "job": None},
    {"key": "common_report", "icon": "📝", "category": "공통 업무", "name": "보고서 초안", "purpose": "자유 메모를 제목·본문·결론 구조 보고서로 변환", "job": None},
    {"key": "common_email", "icon": "✉️", "category": "공통 업무", "name": "이메일 요약·작성", "purpose": "이메일 스레드 붙여넣기 → 핵심 요약 + 답장 초안", "job": None},
    {"key": "common_weekly", "icon": "📅", "category": "공통 업무", "name": "주간 업무 보고", "purpose": "이번 주 한 일 메모 → 주간 보고 양식 자동 정리", "job": None},
    {"key": "common_idea", "icon": "💡", "category": "공통 업무", "name": "아이디어 정리", "purpose": "흩어진 아이디어를 구조화된 기획 메모로 정리", "job": None},
    # ── 재무·회계 ──────────────────────────────────────
    {"key": "vat", "icon": "🧾", "category": "재무·회계", "name": "부가세 대사 도우미", "purpose": "매입·매출 원장 대사 → 부가세 신고 초안", "job": "vat_reconcile"},
    {"key": "close", "icon": "📊", "category": "재무·회계", "name": "월마감 보고서", "purpose": "부서별 매출 집계 · 전월 대비 리포트", "job": "vat_reconcile"},
    {"key": "expense", "icon": "🧮", "category": "재무·회계", "name": "지출결의 요약", "purpose": "지출 증빙 요약 · 분류 · 결재 초안", "job": "vat_reconcile"},
    {"key": "budget", "icon": "💰", "category": "재무·회계", "name": "예산 집행 현황", "purpose": "부서별 예산 소진율 집계 · 초과 항목 알림", "job": "vat_reconcile"},
    {"key": "tax_invoice", "icon": "🧾", "category": "재무·회계", "name": "세금계산서 검증", "purpose": "매입·매출 세금계산서 누락·불일치 자동 점검", "job": "vat_reconcile"},
    # ── 보험 FP ────────────────────────────────────────
    {"key": "fp_coverage", "icon": "📊", "category": "보험 FP", "name": "보장 분석", "purpose": "보유 계약 분석 → 부족·중복 보장 진단", "job": "insurance_fp"},
    {"key": "fp_proposal", "icon": "📝", "category": "보험 FP", "name": "맞춤 제안서", "purpose": "고객 니즈 → 상품 제안서·설명 화법 초안", "job": "insurance_fp"},
    {"key": "fp_policy_qa", "icon": "📄", "category": "보험 FP", "name": "약관 Q&A", "purpose": "약관·특약 질의 → 근거와 함께 답변", "job": "insurance_fp"},
    {"key": "fp_compliance", "icon": "📋", "category": "보험 FP", "name": "완전판매 체크", "purpose": "설명의무·서류·녹취 항목 점검 (불완전판매 방지)", "job": "insurance_fp"},
    {"key": "fp_renewal", "icon": "🔔", "category": "보험 FP", "name": "계약 관리·갱신 안내", "purpose": "갱신 도래·해지 방어 대상 정리 · 안내", "job": "insurance_fp"},
    # ── 증권 리서치 ────────────────────────────────────
    {"key": "rs_company", "icon": "🏢", "category": "증권 리서치", "name": "기업 분석 리포트", "purpose": "재무·사업 요약 → 리포트 초안", "job": "securities_research"},
    {"key": "rs_dart", "icon": "🗂️", "category": "증권 리서치", "name": "DART 공시 분석", "purpose": "전자공시 자동 수집 · 핵심 요약", "job": "securities_research"},
    {"key": "rs_earnings", "icon": "📈", "category": "증권 리서치", "name": "실적 리뷰", "purpose": "실적 발표 → 컨센서스 대비 요약", "job": "securities_research"},
    {"key": "rs_sector", "icon": "🌐", "category": "증권 리서치", "name": "산업·섹터 리서치", "purpose": "산업 동향·경쟁 구도 요약", "job": "securities_research"},
    {"key": "rs_valuation", "icon": "💰", "category": "증권 리서치", "name": "밸류에이션 정리", "purpose": "멀티플·목표주가 근거 정리", "job": "securities_research"},
    # ── 준법·감사 ──────────────────────────────────────
    {"key": "aml_monitor", "icon": "📈", "category": "준법·감사", "name": "이상거래 모니터링", "purpose": "거래 패턴 이상 탐지 · 요약", "job": "compliance_aml"},
    {"key": "aml_str", "icon": "📋", "category": "준법·감사", "name": "STR 초안", "purpose": "의심거래보고서(STR) 초안 작성", "job": "compliance_aml"},
    {"key": "aml_kyc", "icon": "👥", "category": "준법·감사", "name": "KYC 고객확인", "purpose": "고객 정보·리스크 등급 검토", "job": "compliance_aml"},
    {"key": "aml_control", "icon": "🔍", "category": "준법·감사", "name": "내부통제 점검", "purpose": "규정 준수 체크리스트 점검", "job": "compliance_aml"},
    {"key": "aml_reg", "icon": "📄", "category": "준법·감사", "name": "규제·제재 모니터링", "purpose": "규제 변경·제재 리스트 업데이트 요약", "job": "compliance_aml"},
    # ── 인사·총무 ──────────────────────────────────────
    {"key": "hr", "icon": "👥", "category": "인사·총무", "name": "인사 요약 도우미", "purpose": "근태·급여 요약 (민감정보 포함, 검증 이력 확보 후 사용)", "job": "hr"},
    {"key": "hr_hire", "icon": "🏢", "category": "인사·총무", "name": "채용 공고 초안", "purpose": "직무 요건 입력 → 채용 공고문 초안 생성", "job": "hr"},
    {"key": "hr_screen", "icon": "🗂️", "category": "인사·총무", "name": "이력서 스크리닝", "purpose": "직무 요건 대비 이력서 분류·요약", "job": "hr"},
    {"key": "hr_onboard", "icon": "📅", "category": "인사·총무", "name": "온보딩 안내", "purpose": "신규 입사자 온보딩 체크·안내", "job": "hr"},
    {"key": "hr_faq", "icon": "💬", "category": "인사·총무", "name": "인사 FAQ", "purpose": "사규·복지 질의응답", "job": "hr"},
    # ── 기획/PM ────────────────────────────────────────
    {"key": "pm_research", "icon": "🔍", "category": "기획/PM", "name": "경쟁사 리서치", "purpose": "경쟁사 뉴스·공시 자동 수집 및 요약", "job": "pm_brief"},
    {"key": "pm_brief", "icon": "📝", "category": "기획/PM", "name": "컨셉 브리프 작성", "purpose": "기획 의도·시장 조건 입력 → 보고서 초안", "job": "pm_brief"},
    {"key": "pm_spec", "icon": "📋", "category": "기획/PM", "name": "제품 스펙 정리", "purpose": "요구사항 정리 · 기능 명세서 초안 작성", "job": "pm_brief"},
    {"key": "pm_meeting", "icon": "🗂️", "category": "기획/PM", "name": "회의록 자동 정리", "purpose": "회의 내용 → 결정사항·액션 아이템 추출", "job": "pm_brief"},
    # ── 개발·운영 ──────────────────────────────────────
    {"key": "dev_sprint", "icon": "🏃", "category": "개발·운영", "name": "스프린트 플래닝", "purpose": "에픽·스토리를 스프린트로 분해 · 작업 우선순위 정리", "job": "dev_incident"},
    {"key": "dev_pr", "icon": "⚡", "category": "개발·운영", "name": "코드 리뷰 도우미", "purpose": "GitHub PR 변경사항 요약 · 리뷰 포인트 추출 · 팀 공유", "job": "dev_incident"},
    {"key": "dev_incident", "icon": "🔔", "category": "개발·운영", "name": "인시던트 리포트", "purpose": "장애 원인 분석 · 조치 내역 자동 정리", "job": "dev_incident"},
    {"key": "dev_doc", "icon": "📄", "category": "개발·운영", "name": "API 문서 초안", "purpose": "코드·주석 분석 → API 명세 초안 생성", "job": "dev_incident"},
    {"key": "ops_monitor", "icon": "📈", "category": "개발·운영", "name": "이상 알림 모니터링", "purpose": "로그 분석 · 임계값 초과 시 온콜 알림", "job": "dev_incident"},
    {"key": "ops_deploy", "icon": "🔧", "category": "개발·운영", "name": "배포 현황 알림", "purpose": "배포 완료·롤백 이벤트 자동 요약 발송", "job": "dev_incident"},
    # ── 영업 ────────────────────────────────────────────
    {"key": "sales_proposal", "icon": "💼", "category": "영업", "name": "제안서 작성·발송", "purpose": "메신저 요청 → 사내 자료 근거 초안 → PDF → 사용자 승인 → 이메일 발송", "job": "sales"},
    {"key": "sales_followup", "icon": "✉️", "category": "영업", "name": "미팅 팔로업 메일", "purpose": "미팅 노트 → 후속 메일 초안 · 다음 액션 정리", "job": "sales"},
    {"key": "sales_report", "icon": "📈", "category": "영업", "name": "영업 현황 리포트", "purpose": "파이프라인·전환율 집계 리포트 초안", "job": "sales"},
    {"key": "sales_contract", "icon": "📄", "category": "영업", "name": "계약서 검토", "purpose": "조항 누락·위험 항목 자동 점검", "job": "sales"},
    # ── CS (직무 선택엔 미노출, 마켓플레이스 카탈로그) ──
    {"key": "cs_triage", "icon": "💬", "category": "영업/CS", "name": "CS 문의 분류", "purpose": "고객 문의 자동 분류 · 담당자 배정", "job": None},
    {"key": "cs_reply", "icon": "🌐", "category": "영업/CS", "name": "CS 답변 초안", "purpose": "FAQ 기반 고객 응대 초안 자동 생성", "job": None},
    # ── 직접 만들기 ────────────────────────────────────
    {"key": "blank", "icon": "✨", "category": "직접 만들기", "name": "빈 직원", "purpose": "직접 목적을 정의합니다", "job": None},
]

def _caps(web=False, glob=False):
    return [
        {"key": "file", "icon": "📁", "label": "파일 접근", "on": True,
         "detail": "허용 폴더 안에서만 읽기/쓰기"},
        {"key": "analysis", "icon": "📊", "label": "데이터 분석", "on": True,
         "detail": "결정론적 계산 (LLM이 산수 안 함)"},
        {"key": "report", "icon": "📄", "label": "보고서 생성", "on": True,
         "detail": "새 버전 파일만 (덮어쓰기 없음)"},
        {"key": "web", "icon": "🔍", "label": "웹 검색", "on": web,
         "detail": "외부 자료 조회 (옵션)"},
        {"key": "global_llm", "icon": "🌐", "label": "글로벌 LLM", "on": glob,
         "detail": "기본=로컬. 필요 시 API 연결 (옵션)"},
    ]

JOB_META = {
    "vat_reconcile":       {"role": "재무·회계",    "purpose": "부가세 대사·월마감·전표 처리를 자동화합니다."},
    "insurance_fp":        {"role": "보험 FP",      "purpose": "제안서 자동화·보장 갭 분석·약관 Q&A를 지원합니다."},
    "securities_research": {"role": "증권 리서치",  "purpose": "투자리포트 초안·DART 공시 분석을 수행합니다."},
    "compliance_aml":      {"role": "준법·내부감사","purpose": "STR 초안 작성·이상거래 조사를 자동화합니다."},
    "hr":                  {"role": "인사·총무",    "purpose": "근태 요약·채용 공고·급여 명세서를 정리합니다."},
    "pm_brief":            {"role": "기획/PM",      "purpose": "회의록 정리·기획서·경쟁사 리서치를 담당합니다."},
    "dev_incident":        {"role": "개발·운영",    "purpose": "로그 분석·배포 현황·PR 리뷰 요약을 자동화합니다."},
    "sales":               {"role": "영업",         "purpose": "사내 자료 근거로 제안서 초안을 만들고, 사용자 승인 후 발송합니다."},
    "blank":               {"role": "직접 구성",    "purpose": "직접 목적을 정의합니다."},
}

JOB_MCP_KEYS = {
    "insurance_fp":        ["email", "gdrive", "sheets"],
    "securities_research": ["gdrive", "sheets"],
    "vat_reconcile":       ["hometax", "erp", "sheets", "gdrive"],
    "dev_incident":        ["gdrive", "jira"],
    "pm":                  ["gdrive", "sheets", "jira"],
    "hr":                  ["gdrive", "erp", "sheets"],
    "sales":               ["email", "gdrive"],
}
_MCP_CATALOG_MAP = {m["key"]: m for m in MCP_CATALOG}

def _mcp_for_job(job):
    keys = JOB_MCP_KEYS.get(job, ["gdrive", "sheets"])
    # jira·email 은 자격증명/설정이 필요하므로 기본 미연결로 시드
    return [{**_MCP_CATALOG_MAP[k], "connected": k not in ("jira", "email")} for k in keys if k in _MCP_CATALOG_MAP]

def _mcp(*connected_keys):
    return [{**m, "connected": m["key"] in connected_keys} for m in MCP_CATALOG]

# 대표 페르소나 = 금융권 실무자 (persona-금융권-실무자-v1)
#   P1 보험 FP(insurance_fp) ×4 + P2 증권 리서치(securities_research) ×2 — 발표 쇼케이스 구성
DEFAULTS = [
    {"id": "agent-fp-coverage", "name": "보장분석 도우미", "icon": "🛡️",
     "role": "보험 FP · 보장분석",
     "purpose": "고객의 기존 가입 계약을 분석해 부족한 보장(보장 갭)을 찾아냅니다.",
     "status": "active", "job": "insurance_fp", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(),
     "file_paths": ["\\보험\\고객계약", "\\보험\\보장분석"],
     "mcp": _mcp_for_job("insurance_fp"),
     "deployment": {"platform": "slack", "channel": "#fp-보장분석", "status": "배치됨"}},
    {"id": "agent-fp-proposal", "name": "맞춤 제안서 초안", "icon": "📝",
     "role": "보험 FP · 제안서",
     "purpose": "보장 갭을 바탕으로 상품을 추천하고 고객 맞춤 제안서 초안을 만듭니다.",
     "status": "active", "job": "insurance_fp", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(),
     "file_paths": ["\\보험\\상품자료"],
     "mcp": _mcp_for_job("insurance_fp"),
     "deployment": {"platform": "slack", "channel": "#fp-제안서", "status": "배치됨"}},
    {"id": "agent-fp-terms", "name": "약관 Q&A 도우미", "icon": "📖",
     "role": "보험 FP · 약관 질의",
     "purpose": "약관·산출방법서에서 근거를 찾아 현장 질문에 즉시 답합니다.",
     "status": "draft", "job": "insurance_fp", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(),
     "file_paths": ["\\보험\\약관", "\\보험\\산출방법서"],
     "mcp": _mcp_for_job("insurance_fp"),
     "deployment": {"platform": None, "channel": "", "status": "미배치"}},
    {"id": "agent-fp-compliance", "name": "완전판매 체크", "icon": "✅",
     "role": "보험 FP · 컴플라이언스",
     "purpose": "금소법(금융소비자보호법) 기준 불완전판매 체크리스트를 자동 적용합니다.",
     "status": "draft", "job": "insurance_fp", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(),
     "file_paths": ["\\보험\\상담로그"],
     "mcp": _mcp_for_job("insurance_fp"),
     "deployment": {"platform": None, "channel": "", "status": "미배치"}},
    {"id": "agent-rs-disclosure", "name": "공시·뉴스 수집", "icon": "📰",
     "role": "증권 리서치 · 데이터 수집",
     "purpose": "DART 공시와 뉴스를 자동 수집·정리해 리서치 입력 자료를 준비합니다.",
     "status": "active", "job": "securities_research", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(web=True),
     "file_paths": ["\\리서치\\공시", "\\리서치\\뉴스"],
     "mcp": _mcp_for_job("securities_research"),
     "deployment": {"platform": "slack", "channel": "#리서치-데이터", "status": "배치됨"}},
    {"id": "agent-rs-report", "name": "리포트 초안", "icon": "📈",
     "role": "증권 리서치 · 리포트",
     "purpose": "밸류에이션·실적요약 섹션의 투자리포트 초안을 만듭니다. 발간 책임은 애널리스트에게 있습니다.",
     "status": "draft", "job": "securities_research", "tone": ["정중", "간결·팩트"],
     "model": "로컬 모델 · 정액 무제한",
     "capabilities": _caps(web=True),
     "file_paths": ["\\리서치\\리포트초안"],
     "mcp": _mcp_for_job("securities_research"),
     "deployment": {"platform": None, "channel": "", "status": "미배치"}},
]

def _load():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        defaults = _inject_defaults(DEFAULTS)
        _save(defaults)
        return defaults
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    changed = False
    for a in data:
        if not a.get("created_at"):
            a["created_at"] = "2026-07-13"
            changed = True
        if not a.get("created_by"):
            a["created_by"] = "황소이 선임"
            changed = True
    if changed:
        _save(data)
    return data

def _inject_defaults(agents):
    for a in agents:
        a.setdefault("created_at", "2026-07-13")
        a.setdefault("created_by", "황소이 선임")
    return agents

def _save(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def list_agents():
    return _load()

def get_agent(agent_id):
    return next((a for a in _load() if a["id"] == agent_id), None)

def hire(template_key, name, tone, capabilities=None, mcp=None, icon=None, job=None, channels=None):
    data = _load()
    tpl = next((t for t in TEMPLATES if t["key"] == template_key), TEMPLATES[-1])
    first_ch = channels[0] if channels else None
    # 생성 시 선택한 플랫폼·채널명은 상세에 '미리 채움'으로만 넘긴다.
    # 실제 배치(채널 생성)는 상세에서 사용자가 눌러야 하므로 기본 상태는 '미배치'.
    deployment = (
        {"platform": first_ch["platform"], "channel": first_ch["channel"], "status": "미배치"}
        if first_ch else
        {"platform": None, "channel": "", "status": "미배치"}
    )
    effective_job = job if job is not None else tpl.get("job")
    job_meta = JOB_META.get(effective_job or "blank", {})
    # 템플릿이 이미 purpose를 가지면(blank 템플릿 제외) 템플릿 purpose 우선
    resolved_role    = job_meta.get("role")    or tpl["name"]
    resolved_purpose = (tpl["purpose"] if tpl.get("purpose") and tpl["key"] != "blank"
                        else job_meta.get("purpose") or tpl["purpose"])
    new = {
        "id": f"agent-{uuid.uuid4().hex[:6]}",
        "name": name or tpl["name"],
        "icon": icon or tpl["icon"],
        "role": resolved_role,
        "purpose": resolved_purpose,
        "status": "draft",
        "job": effective_job,
        "tone": tone or ["정중"],
        "llm_key": "builtin",
        "model": "내장 LLM",
        "created_at": date.today().isoformat(),
        "created_by": "황소이 선임",
        "capabilities": capabilities if capabilities is not None else _caps(),
        "file_paths": [],
        "mcp": mcp if mcp is not None else _mcp_for_job(effective_job),
        "deployment": deployment,
    }
    data.append(new)
    _save(data)
    return new

def update_agent(agent_id, patch):
    data = _load()
    for a in data:
        if a["id"] == agent_id:
            a.update(patch)
            _save(data)
            return a
    return None

def delete_agent(agent_id):
    data = _load()
    next_data = [a for a in data if a["id"] != agent_id]
    if len(next_data) == len(data):
        return False
    _save(next_data)
    _detach_from_teams(agent_id)   # 팀 멤버·협업 흐름 단계에서 함께 제거
    return True

def _detach_from_teams(agent_id):
    """삭제된 에이전트를 참조하는 팀 멤버 목록·흐름 단계를 정리한다.

    안 하면 teams.json에 죽은 id가 남아 흐름이 존재하지 않는 에이전트를 가리킨다.
    (멤버 목록은 화면에서 걸러져 보이지만 흐름 단계는 그대로 남아 실행이 깨진다.)
    순환 import를 피하려고 teams.json을 직접 다룬다.
    """
    teams_file = os.path.join(os.path.dirname(__file__), "../data/teams.json")
    try:
        with open(teams_file, encoding="utf-8") as f:
            teams = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return

    changed = False
    for t in teams:
        if agent_id in (t.get("agents") or []):
            t["agents"] = [a for a in t["agents"] if a != agent_id]
            changed = True
        for flow in t.get("flows") or []:
            steps = flow.get("steps") or []
            kept = [s for s in steps if s.get("agent_id") != agent_id]
            if len(kept) != len(steps):
                for i, s in enumerate(kept):       # order 재부여 — 빈 번호가 생기면 안 된다
                    s["order"] = i + 1
                flow["steps"] = kept
                changed = True

    if changed:
        with open(teams_file, "w", encoding="utf-8") as f:
            json.dump(teams, f, ensure_ascii=False, indent=2)

def deploy_agent(agent_id, platform, channel):
    # status는 배치의 파생값 — 팀(teams.deploy_team_channel)과 같은 규칙을 쓴다.
    return update_agent(agent_id, {
        "deployment": {"platform": platform, "channel": channel, "status": "배치됨"},
        "status": "active",
    })

def undeploy_agent(agent_id):
    return update_agent(agent_id, {
        "deployment": {"platform": None, "channel": "", "status": "미배치"},
        "status": "draft",
    })
