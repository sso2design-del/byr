"""
제안서 초안 엔진 — Byr 첫 '진짜로 도는 한 줄기'(영업 · 제안서 초안).

파이프라인:
  1) load_kb()   : data/sales_kb/*.md 를 섹션 단위 청크로 로드(실제 문서)
  2) retrieve()  : 고객 요청과 겹치는 키워드로 상위 청크 검색(실제 근거)
  3) draft()     : 검색된 근거만 넣어 Claude API로 제안 초안 생성(출처 인용)
                   API 키·호출 실패 시 템플릿 기반 초안으로 우아하게 폴백

기밀: ANTHROPIC_API_KEY 는 저장소가 아니라 ~/.hermes/.env 에서만 읽는다.
KB 문서는 Byr 자체 소개(가상 사례)라 사내 기밀이 아니다.
"""
import os
import re
import json
import urllib.request
from pathlib import Path

KB_DIR = Path(__file__).parent.parent / "data" / "sales_kb"          # 샘플(기본 제공) 문서
AGENT_KB_DIR = Path(__file__).parent.parent / "data" / "agent_kb"    # 에이전트별 업로드 문서

# 문서 파일명 → 사람이 읽는 표시명(샘플)
_DOC_LABELS = {
    "product-overview": "Byr 제품 소개",
    "pricing": "Byr 요금제",
    "case-studies": "Byr 도입 사례",
    "company-and-faq": "Byr 회사 소개·FAQ",
}

_STOP = set("그리고 그러나 하지만 또는 및 등 의 을 를 이 가 은 는 에 에서 으로 로 와 과 도 만 the a an of to and or for is are with in on at by".split())


def _load_hermes_env() -> None:
    env = Path.home() / ".hermes" / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _doc_label(stem: str) -> str:
    return _DOC_LABELS.get(stem, stem)


def _safe_name(name: str) -> str:
    """업로드 파일명 → 안전한 파일 stem(경로 조작 방지)."""
    base = Path(name or "").name
    stem = re.sub(r"\.(md|markdown|txt)$", "", base, flags=re.I)
    stem = re.sub(r"[^\w가-힣 .\-]", "", stem).strip() or "문서"
    return stem[:60]


def _agent_dir(agent_id: str) -> Path:
    return AGENT_KB_DIR / re.sub(r"[^\w\-]", "", agent_id or "")


def _first_heading(text: str, fallback: str) -> str:
    m = re.search(r"^#\s+(.+)", text, flags=re.M)
    return m.group(1).strip() if m else fallback


def _chunk_doc(text: str, doc_label: str, doc_id: str, source: str) -> list[dict]:
    """문서 하나를 ## 섹션 단위 청크로. 섹션이 없으면 통째로 한 청크."""
    chunks: list[dict] = []
    parts = re.split(r"\n(?=##\s)", text)
    for part in parts:
        body = part.strip()
        if len(body) < 10:
            continue
        m = re.match(r"##\s*(.+)", body)
        section = m.group(1).strip() if m else "개요"
        chunks.append({"doc": doc_label, "doc_id": doc_id, "source": source,
                       "section": section, "text": body})
    return chunks


def load_kb(agent_id: str | None = None, audit: bool = False) -> list[dict]:
    """근거 청크 로드 = 이 에이전트에 **사용자가 직접 연결한 소스**만.
    (샘플 자동 연결 없음 — 소스는 사용자가 콘솔에서 연결한다.)
    각 청크: {doc, doc_id, source('uploaded'), section, text}.

    audit=True 면 어떤 문서를 읽었는지 감사에 남긴다.
    UI 목록 조회(kb_docs)까지 기록하면 로그가 의미 없이 불어나므로,
    **실제 답변 근거로 쓰는 경로에서만** 켠다.
    """
    chunks: list[dict] = []
    if not agent_id:
        return chunks
    ad = _agent_dir(agent_id)
    docs = []
    if ad.exists():
        for f in sorted(ad.glob("*.md")):
            text = f.read_text(encoding="utf-8")
            label = _first_heading(text, f.stem)
            docs.append(label)
            chunks += _chunk_doc(text, label, f"uploaded:{f.stem}", "uploaded")
    if audit and docs:
        try:
            from . import audit as _au
            _au.log("agent", "KB_READ", agent_id, f"{len(docs)}건: " + " · ".join(docs[:5]))
        except Exception:
            pass
    return chunks


def kb_docs(agent_id: str | None = None) -> list[dict]:
    """연결된 소스 목록(UI용). 업로드는 doc_id로 연결 해제 가능."""
    docs: dict[str, dict] = {}
    for c in load_kb(agent_id):
        d = docs.setdefault(c["doc_id"], {
            "doc_id": c["doc_id"], "label": c["doc"],
            "source": c["source"], "sections": 0,
        })
        d["sections"] += 1
    return list(docs.values())


def has_sources(agent_id: str) -> bool:
    ad = _agent_dir(agent_id)
    return ad.exists() and any(ad.glob("*.md"))


def add_agent_doc(agent_id: str, filename: str, text: str) -> dict:
    """에이전트에 문서 업로드(텍스트). md/txt 내용 그대로 저장."""
    if not (text or "").strip():
        return {"ok": False, "message": "빈 문서입니다."}
    ad = _agent_dir(agent_id)
    ad.mkdir(parents=True, exist_ok=True)
    stem = _safe_name(filename)
    # 이름 충돌 시 -2, -3 …
    target = ad / f"{stem}.md"
    n = 2
    while target.exists():
        target = ad / f"{stem}-{n}.md"
        n += 1
    target.write_text(text, encoding="utf-8")
    return {"ok": True, "doc_id": f"uploaded:{target.stem}", "label": _first_heading(text, target.stem)}


def remove_agent_doc(agent_id: str, doc_id: str) -> bool:
    """업로드 문서 삭제. 샘플(sample:)은 삭제 불가."""
    if not doc_id.startswith("uploaded:"):
        return False
    stem = doc_id.split(":", 1)[1]
    f = _agent_dir(agent_id) / f"{stem}.md"
    if f.exists() and f.parent == _agent_dir(agent_id):
        f.unlink()
        return True
    return False


def remove_agent_doc_by_filename(agent_id: str, filename: str) -> bool:
    """파일명(경로 라벨)으로 연결된 소스 해제 — 프론트가 doc_id 계산 없이 해제."""
    return remove_agent_doc(agent_id, f"uploaded:{_safe_name(filename)}")


def _tokens(s: str) -> list[str]:
    toks = re.findall(r"[a-zA-Z0-9]+|[가-힣]{2,}", (s or "").lower())
    return [t for t in toks if t not in _STOP and len(t) > 1]


def retrieve(query: str, k: int = 5, agent_id: str | None = None) -> list[dict]:
    """고객 요청과 키워드가 겹치는 상위 k개 청크(실제 근거). 점수 0은 제외.
    업로드 문서는 동점 시 샘플보다 우선(고객의 실제 자료를 앞세움)."""
    corpus = load_kb(agent_id, audit=True)
    q = _tokens(query)
    if not q:
        return corpus[:k]
    qset = set(q)
    scored = []
    for c in corpus:
        ctoks = _tokens(c["text"] + " " + c["section"])
        if not ctoks:
            continue
        overlap = sum(1 for t in ctoks if t in qset)
        sec_bonus = 2 * sum(1 for t in _tokens(c["section"]) if t in qset)
        upload_bonus = 1 if c.get("source") == "uploaded" else 0  # 동점 시 업로드 우선
        score = overlap + sec_bonus
        if score > 0:
            scored.append((score, upload_bonus, c))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    top = [c for _, _, c in scored[:k]]
    if not top:  # 겹침이 전혀 없으면 대표 섹션으로 폴백
        top = corpus[:k]
    return top


def _call_openai_compatible(base: str, key: str, model: str, system: str, user: str,
                            extra_headers: dict | None = None, max_tokens: int = 1500) -> tuple | None:
    """OpenAI 호환 Chat Completions 호출(OpenAI·OpenRouter 공용).
    반환 (text, usage) — usage={in,out}. 실패 시 None."""
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {"content-type": "application/json", "authorization": f"Bearer {key}"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        base.rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        u = data.get("usage") or {}
        usage = {"in": u.get("prompt_tokens"), "out": u.get("completion_tokens")}
        return (text, usage) if text else None
    except Exception:
        return None


def _call_anthropic(key: str, model: str, system: str, user: str, max_tokens: int = 1500) -> tuple | None:
    payload = {"model": model, "max_tokens": max_tokens, "system": system,
               "messages": [{"role": "user", "content": user}]}
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", "x-api-key": key,
                 "anthropic-version": "2023-06-01"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        text = "".join(parts).strip()
        u = data.get("usage") or {}
        usage = {"in": u.get("input_tokens"), "out": u.get("output_tokens")}
        return (text, usage) if text else None
    except Exception:
        return None


def _audit_model_call(provider: str, model: str, usage, ok: bool, target: str = "-"):
    """어떤 모델이 호출됐는지 남긴다.

    왜 필요한가: 우리가 파는 것이 "데이터가 외부로 나가지 않는다"(주권)인데,
    그걸 증명하려면 **어떤 모델이 호출됐는지** 기록이 있어야 한다.
    이 기록은 소급해서 만들 수 없으므로 호출 시점에 남긴다.
    본문(system/user)은 남기지 않는다 — 개인정보가 섞이고, 감사에 필요한 건
    "무엇이 호출됐나"이지 "무슨 내용이었나"가 아니다.
    """
    from . import audit as _au
    scope = "internal" if provider == "builtin" else "external"
    tin = (usage or {}).get("in")
    tout = (usage or {}).get("out")
    detail = f"{provider}/{model}/{scope}/{'ok' if ok else 'fail'}"
    if tin is not None or tout is not None:
        detail += f"/in:{tin or 0},out:{tout or 0}"
    try:
        _au.log("agent", "MODEL_CALL", target, detail)
    except Exception:
        pass   # 감사 실패가 본 작업을 막지 않는다


def _call_llm(system: str, user: str, max_tokens: int = 1500, target: str = "-") -> tuple[str, str] | None:
    """사용 가능한 provider 순서로 시도(크레딧 있는 곳). 반환 (text, model) 또는 None.
    우선순위: OpenAI 호환 → OpenRouter → Anthropic. BYR_LLM_MODEL 로 모델 지정 가능."""
    _load_hermes_env()
    model_override = os.environ.get("BYR_LLM_MODEL")

    attempts = []   # 실패한 provider도 기록한다 — "왜 안 됐나"를 남기기 위해

    # 1) OpenAI (직접 또는 커스텀 base_url)
    oai = os.environ.get("OPENAI_API_KEY")
    if oai:
        base = os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        model = model_override or "gpt-4o-mini"
        r = _call_openai_compatible(base, oai, model, system, user, max_tokens=max_tokens)
        if r:
            _audit_model_call("openai", model, r[1], True, target=target)
            return r[0], model
        attempts.append(("openai", model))

    # 2) OpenRouter
    ork = os.environ.get("OPENROUTER_API_KEY")
    if ork:
        model = model_override or "openai/gpt-4o-mini"
        r = _call_openai_compatible(
            "https://openrouter.ai/api/v1", ork, model, system, user,
            extra_headers={"HTTP-Referer": "https://byr.local", "X-Title": "Byr Proposal"}, max_tokens=max_tokens,
        )
        if r:
            _audit_model_call("openrouter", model, r[1], True, target=target)
            return r[0], model
        attempts.append(("openrouter", model))

    # 3) Anthropic (크레딧 있을 때)
    ant = os.environ.get("ANTHROPIC_API_KEY")
    if ant:
        model = model_override or "claude-sonnet-4-20250514"
        r = _call_anthropic(ant, model, system, user, max_tokens=max_tokens)
        if r:
            _audit_model_call("anthropic", model, r[1], True, target=target)
            return r[0], model
        attempts.append(("anthropic", model))

    for provider, model in attempts:
        _audit_model_call(provider, model, None, False, target=target)
    return None


def _citation_label(c: dict) -> str:
    return f"{c['doc']} · {c['section']}"


def _template_draft(customer: str, req: str, evidence: list[dict]) -> str:
    """LLM 미사용/실패 시 폴백: 근거를 그대로 인용해 조립한 초안."""
    lines = [
        f"# {customer or '고객사'} 대상 Byr 도입 제안 (초안)",
        "",
        "## 1. 고객 요청 이해",
        (req.strip() or "요청 내용이 비어 있습니다."),
        "",
        "## 2. 제안 개요",
        "Byr는 사내 근거 기반 + 사람 승인 게이트 + 감사 기록을 갖춘 L2/L3 Agentic AI 플랫폼입니다. "
        "아래 근거 문서를 바탕으로 귀사 요청에 맞춰 제안합니다.",
        "",
        "## 3. 근거 (연결된 자료 인용)",
    ]
    for i, c in enumerate(evidence, 1):
        snippet = re.sub(r"\s+", " ", c["text"])[:240]
        lines.append(f"{i}. **{_citation_label(c)}** — {snippet}…")
    lines += ["", "## 4. 다음 단계", "무료 상담 → 4주 파일럿(PoC) → 정식 도입 순으로 제안합니다."]
    return "\n".join(lines)


def _parse_deck_json(text: str) -> dict | None:
    """LLM 출력에서 덱 JSON 파싱(코드펜스 제거). 유효한 slides면 반환."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.I | re.M).strip()
    m = re.search(r"\{.*\}", t, flags=re.S)
    if m:
        t = m.group(0)
    try:
        d = json.loads(t)
    except Exception:
        return None
    slides = d.get("slides")
    if isinstance(slides, list) and slides:
        d["slides"] = [s for s in slides if isinstance(s, dict) and s.get("heading")]
        return d if d["slides"] else None
    return None


def _deck_to_markdown(deck: dict) -> str:
    """덱 → 미리보기/텍스트 폴백용 마크다운."""
    lines = [f"# {deck.get('title','제안서')}", "", deck.get("subtitle", ""), ""]
    for s in deck.get("slides", []):
        lines.append(f"## {s.get('heading','')}")
        if s.get("subhead"):
            lines.append(f"_{s['subhead']}_")
        for m in s.get("metrics", []) or []:
            sub = f" ({m.get('sub')})" if m.get("sub") else ""
            lines.append(f"- **{m.get('value','')}** {m.get('label','')}{sub}")
        tb = s.get("table")
        if tb and tb.get("rows"):
            lines.append("| " + " | ".join(str(c) for c in tb.get("columns", [])) + " |")
            for r in tb["rows"]:
                lines.append("| " + " | ".join(str(v) for v in r) + " |")
        for b in s.get("bullets", []):
            if isinstance(b, dict):
                lead, detail = b.get("lead", ""), b.get("detail", "")
                lines.append(f"- **{lead}** — {detail}" if detail else f"- **{lead}**")
            else:
                lines.append(f"- {b}")
        if s.get("note"):
            lines.append(f"> {s['note']}")
        lines.append("")
    return "\n".join(lines)


def _template_deck(customer: str, req: str, evidence: list[dict]) -> dict:
    """LLM 실패 시 폴백 덱(근거 인용 조립)."""
    ev = []
    for c in evidence[:4]:
        snip = re.sub(r"\s+", " ", c["text"])[:150]
        ev.append({"lead": c["section"][:16], "detail": f"{snip}… [출처: {_citation_label(c)}]"})
    mock = "예시 수치 — 실제 데이터로 교체하세요"
    return {
        "customer": customer or "고객사",
        "title": f"{customer or '고객사'} 대상 Byr 도입 제안",
        "subtitle": "사내 근거 기반 · 사람 승인 게이트 · 감사 기록",
        "slides": [
            {"type": "summary", "heading": "제안 요약", "subhead": "한 장으로 보는 제안",
             "cards": [
                 {"tag": "과제", "title": "반복 업무 과부하", "desc": req or "반복적 처리로 담당자 시간이 소진됩니다."},
                 {"tag": "해법", "title": "근거 기반 자동화 + 사람 승인", "desc": "사내 자료를 근거로 초안을 만들고 승인 후 실행합니다."},
                 {"tag": "효과", "title": "처리 시간 대폭 단축", "desc": "반복 업무는 자동화, 담당자는 고부가 업무에 집중합니다."},
                 {"tag": "다음 단계", "title": "4주 파일럿", "desc": "한 업무로 성과를 먼저 검증하고 확대합니다."},
             ]},
            {"type": "situation", "heading": "고객 현황과 과제", "subhead": "요청하신 상황을 정리했어요",
             "bullets": [
                 {"lead": "요청 요약", "detail": req or "요청 내용 확인 필요"},
                 {"lead": "반복 업무 부담", "detail": "정형적·반복적 처리가 많아 담당자 시간이 소진됩니다."},
                 {"lead": "정확도·보안 요구", "detail": "결과를 사람이 검증하고 데이터 보호가 필요한 환경입니다."},
             ]},
            {"type": "solution", "heading": "Byr 제안 개요", "subhead": "핵심 3가지",
             "bullets": [
                 {"lead": "사내 근거 자동화", "detail": "연결된 문서에서 근거를 찾아 업무 결과를 자동으로 만들고 출처를 인용합니다."},
                 {"lead": "사람 승인 게이트", "detail": "외부 발송·제출 같은 고위험 작업은 사람이 확인·승인하기 전까지 실행되지 않습니다."},
                 {"lead": "전 과정 감사 기록", "detail": "누가 무엇을 언제 실행·승인했는지 작업 기록부에 남아 규제 대응이 쉽습니다."},
             ]},
            {"type": "how", "heading": "작동 방식", "subhead": "요청부터 실행까지 한 흐름",
             "flow": [
                 {"label": "요청", "desc": "메신저에서 요청"},
                 {"label": "근거 검색", "desc": "연결된 사내 문서"},
                 {"label": "초안 작성", "desc": "출처 인용"},
                 {"label": "사람 승인", "desc": "미리보기·게이트"},
                 {"label": "실행", "desc": "발송·기록"},
             ],
             "bullets": [
                 {"lead": "덮어쓰기 없음", "detail": "결과는 새 버전으로 스테이징되어 되돌리기가 가능합니다."},
                 {"lead": "전 과정 기록", "detail": "요청·근거·승인·실행이 모두 감사 로그에 남습니다."},
             ]},
            {"type": "effect", "heading": "기대 효과", "subhead": "도입 사례 기준", "note": mock,
             "metrics": [
                 {"value": "20분", "label": "1차 응답 시간", "sub": "기존 4시간"},
                 {"value": "-73%", "label": "처리 시간", "sub": "반복 업무 기준"},
                 {"value": "60%", "label": "자동 처리 비중", "sub": "반복 문의"},
                 {"value": "4주", "label": "성과 확인", "sub": "파일럿(PoC)"},
             ],
             "bullets": [
                 {"lead": "응대 속도", "detail": "상담사는 예외 케이스에 집중하고 반복 문의는 자동 초안으로 처리합니다."},
                 {"lead": "품질 유지", "detail": "모든 답변이 사내 문서를 근거로 하고 사람 승인 후 나갑니다."},
             ]},
            {"type": "impact", "heading": "핵심 지표", "subhead": "자동 응대로 처리량을 확 줄입니다", "note": mock,
             "bars": {"unit": "건/일", "items": [
                 {"label": "기존 수기 응대", "value": 120},
                 {"label": "도입 1개월", "value": 78, "note": "35% 감소"},
                 {"label": "도입 3개월", "value": 34, "highlight": True, "note": "약 72% 감소"},
             ]},
             "bullets": [
                 {"lead": "선형적 감소", "detail": "자동 응대 커버리지가 늘수록 수기 처리량이 빠르게 줄어듭니다."},
                 {"lead": "재배치 효과", "detail": "확보된 시간을 고부가 상담·클레임 대응으로 돌립니다."},
             ]},
            {"type": "comparison", "heading": "범용 챗봇 대비 Byr", "subhead": "실무 투입 관점",
             "table": {"columns": ["항목", "범용 챗봇", "Byr"],
                       "rows": [["사내 근거", "약함", "강함(출처 인용)"],
                                ["실행 전 사람 승인", "없음", "기본 제공"],
                                ["감사 기록", "제한적", "전 과정 기록"],
                                ["보안·설치형", "제한적", "테넌트 격리·설치형"],
                                ["업무 자동 실행", "제한적", "스킬·MCP로 실제 실행"]],
                       "highlight": 2},
             "bullets": [
                 {"lead": "규제 대응", "detail": "승인 게이트와 작업 기록부로 감사 추적이 가능합니다."},
                 {"lead": "데이터 보호", "detail": "내장 LLM·설치형으로 데이터가 외부로 나가지 않게 운영합니다."},
             ]},
            {"type": "security", "heading": "보안·컴플라이언스", "subhead": "규제·검증 환경에 맞춥니다",
             "bullets": [
                 {"lead": "데이터 미유출", "detail": "내장 LLM 사용 시 데이터는 사내에서만 처리되고 외부로 나가지 않습니다."},
                 {"lead": "사람 승인 게이트", "detail": "외부 발송·제출은 사람이 승인하기 전까지 실행되지 않습니다."},
                 {"lead": "전 과정 감사 기록", "detail": "누가 무엇을 언제 실행·승인했는지 작업 기록부에 남아 감사 추적이 됩니다."},
                 {"lead": "설치형·테넌트 격리", "detail": "설치형·프라이빗 클라우드로 전용 스토리지·KMS·작업 기록부를 분리 운영합니다."},
             ]},
            {"type": "roadmap", "heading": "도입 로드맵", "subhead": "4주면 성과를 확인할 수 있어요",
             "timeline": [
                 {"phase": "1주", "title": "상담·진단", "desc": "반복 업무·문서 현황 파악"},
                 {"phase": "2–4주", "title": "파일럿(PoC)", "desc": "한 업무를 실제 에이전트로 검증"},
                 {"phase": "5주~", "title": "정식 도입", "desc": "플랜·권한 설정, 팀 온보딩"},
                 {"phase": "이후", "title": "확대", "desc": "직무·팀 단위로 확장"},
             ],
             "bullets": [
                 {"lead": "빠른 검증", "detail": "4주 파일럿으로 실제 업무에서 성과를 먼저 확인합니다."},
                 {"lead": "안전한 확장", "detail": "성공 업무부터 순차 확대해 리스크를 낮춥니다."},
             ]},
            {"type": "plan", "heading": "추천 플랜", "subhead": "승인 게이트가 필요한 팀에 적합",
             "bullets": ev or [{"lead": "플랜", "detail": "연결된 요금 자료를 확인하세요."}]},
        ],
    }


_LAYOUT_GUIDE = (
    "출력은 **오직 JSON**(마크다운·설명·코드펜스 금지). 슬라이드는 목적에 맞는 레이아웃 하나를 쓴다:\n"
    "- 불릿: \"bullets\":[{\"lead\":\"핵심(6~16자)\",\"detail\":\"1~2문장\"}]\n"
    "- 수치카드: \"metrics\":[{\"value\":\"20분\",\"label\":\"라벨\",\"sub\":\"부가\"}]\n"
    "- 막대: \"bars\":{\"unit\":\"건\",\"items\":[{\"label\":\"기존\",\"value\":100},{\"label\":\"도입 후\",\"value\":30,\"highlight\":true}]}\n"
    "- 도넛: \"donut\":{\"value\":60,\"label\":\"라벨\",\"caption\":\"부가\"}\n"
    "- 표: \"table\":{\"columns\":[...],\"rows\":[[...]],\"highlight\":2}\n"
    "- 타임라인: \"timeline\":[{\"phase\":\"1주\",\"title\":\"제목\",\"desc\":\"...\"}]\n"
    "- 요약카드: \"cards\":[{\"tag\":\"태그\",\"title\":\"핵심 한 줄\",\"desc\":\"1문장\"}]  (4개)\n"
    "- 플로우: \"flow\":[{\"label\":\"단계\",\"desc\":\"짧게\"}]  (4~5개)\n\n"
    "덱 스키마: {\"title\":\"표지 제목(임팩트)\",\"subtitle\":\"부제 한 줄\",\"slides\":[{\"type\":\"...\",\"heading\":\"제목\",\"subhead\":\"한 줄 요약\", (레이아웃 키 하나), \"note\":\"(선택)\"}]}\n\n"
    "**밀도 규칙**: 인포그래픽 슬라이드에도 보조 **bullets 2~3개**를 함께 넣어 꽉 채운다."
)

_JOB_DECK = {
    "sales": {
        "role": "Byr(L3 Agentic AI 플랫폼)의 영업 제안서 디자이너",
        "plan": (
            "슬라이드 10개(순서 고정):\n"
            "1) summary 제안 요약 — cards 4개(과제·해법·효과·다음 단계). BLUF\n"
            "2) situation 고객 현황·과제 — bullets 4\n"
            "3) solution Byr 제안 개요 — bullets 4\n"
            "4) how 작동 방식 — flow(요청→근거검색→초안→사람 승인→실행) + bullets 2\n"
            "5) effect 기대 효과 — metrics 3~4 + bullets 2\n"
            "6) impact 핵심 지표 — bars 또는 donut + bullets 2~3\n"
            "7) comparison 범용 챗봇 대비 Byr — table(행 4~5, 열[항목,범용 챗봇,Byr], highlight=2) + bullets 2\n"
            "8) security 보안·컴플라이언스 — bullets 4\n"
            "9) roadmap 도입 로드맵 — timeline 4단계 + bullets 2\n"
            "10) plan 추천 플랜 — bullets 3~4(요금 근거, detail 끝에 [출처: 문서·섹션])"
        ),
    },
    "insurance_fp": {
        "role": "보험 FP(재무설계사)의 맞춤 보험 제안 설계자",
        "plan": (
            "슬라이드 8개(순서 고정). '고객'은 개인 고객이다:\n"
            "1) summary 제안 요약 — cards 4개(현재 상황·발견된 보장 갭·추천 방향·다음 단계)\n"
            "2) situation 고객 현황 — bullets 4(나이·가족·직업·니즈 등 요청에서 파악)\n"
            "3) gap 보장 갭 분석 — bars 또는 table(현재 보장 vs 권장, 예시 수치) + bullets 2\n"
            "4) plan 추천 보장·상품 — table(담보별: 사망/실손/암/상해 등 추천, 근거의 상품·특약 반영, [출처] 표기) + bullets 2\n"
            "5) premium 예상 보험료 — metrics(월 보험료 등 예시 수치) + bullets 2\n"
            "6) value 보장 강화 효과 — bullets 4(왜 필요한지·리스크 대비)\n"
            "7) next 가입 절차 — timeline 4단계(상담→맞춤 설계→청약→보장 개시) + bullets 2"
        ),
    },
}


def draft_structured(customer: str, req: str, agent_name: str = "제안서 작성 에이전트",
                     agent_id: str | None = None, facts: dict | None = None, job: str = "sales") -> dict:
    """슬라이드 덱용 구조화 초안(직무별 구성). 반환: {deck, draft_text, citations, used_llm, model}."""
    evidence = retrieve(req or customer, k=6, agent_id=agent_id)
    citations = [{"doc": c["doc"], "section": c["section"], "label": _citation_label(c),
                  "source": c.get("source", "uploaded")} for c in evidence]
    ev_block = "\n\n".join(
        f"[근거 {i}] 출처: {_citation_label(c)}\n{c['text']}" for i, c in enumerate(evidence, 1)
    )
    spec = _JOB_DECK.get(job, _JOB_DECK["sales"])
    system = (
        f"당신은 {spec['role']}다. 고객 상황과 아래 '근거'로 발표용 슬라이드 덱을 만든다. "
        "근거에 없는 사실·상품은 지어내지 말되, 인포그래픽(차트) 수치는 발표 임팩트를 위해 "
        "**예시(mock) 수치로 채워도 된다**(그 슬라이드 note에 '예시 수치 — 실제 데이터로 교체'라고 적는다).\n\n"
        + _LAYOUT_GUIDE + "\n\n" + spec["plan"] + "\n불릿 detail은 구체적으로 충실히. 빈 강조어·과장 금지."
    )
    facts = facts or {}
    fact_lines = []
    if facts.get("team_size"):
        fact_lines.append(f"팀 인원: {facts['team_size']}명")
    if facts.get("volume"):
        fact_lines.append(f"현재 처리량: {facts['volume']}건/일")
    if facts.get("goal"):
        fact_lines.append(f"목표: {facts['goal']}")
    fact_block = ("\n=== 고객 제공 수치(본문·요약에 자연스럽게 반영) ===\n" + "\n".join(fact_lines) + "\n") if fact_lines else ""
    user = (
        f"고객: {customer or '(미기재)'}\n고객 상황/요청:\n{req or '(요청 없음 — 대표 제안)'}\n{fact_block}\n"
        f"=== 근거(사실은 이 안에서) ===\n{ev_block}\n=== 근거 끝 ===\n\n"
        "위 지침의 슬라이드 구성대로 JSON 덱을 밀도 있게 출력하라. "
        "고객 제공 수치가 있으면 그 숫자를 본문에 활용하라."
    )
    res = _call_llm(system, user, max_tokens=4800, target=agent_id or "proposal")
    if res:
        text, model = res
        deck = _parse_deck_json(text)
        if deck:
            deck["customer"] = customer or "고객사"
            return {"deck": deck, "draft_text": _deck_to_markdown(deck),
                    "citations": citations, "used_llm": True, "model": model}
    deck = _template_deck(customer, req, evidence)
    return {"deck": deck, "draft_text": _deck_to_markdown(deck),
            "citations": citations, "used_llm": False, "model": None}


def draft(customer: str, req: str, agent_name: str = "제안서 초안 에이전트",
          agent_id: str | None = None) -> dict:
    """제안서 초안 생성. 반환: {draft, citations, used_llm, model}."""
    evidence = retrieve(req or customer, k=5, agent_id=agent_id)
    citations = [{"doc": c["doc"], "section": c["section"], "label": _citation_label(c),
                  "source": c.get("source", "sample")} for c in evidence]

    ev_block = "\n\n".join(
        f"[근거 {i}] 출처: {_citation_label(c)}\n{c['text']}" for i, c in enumerate(evidence, 1)
    )
    system = (
        "당신은 Byr(L3 Agentic AI 플랫폼)의 영업 제안서 작성 에이전트다. "
        "아래 '근거' 블록에 제공된 내용만 사실 근거로 사용하고, 근거에 없는 수치·기능·약속을 지어내지 마라. "
        "한국어로, 고객 요청에 맞춘 제안서 초안을 마크다운으로 작성한다. "
        "구성: 1) 고객 요청 이해 2) 제안 개요 3) Byr가 푸는 문제와 근거(문장 끝에 [출처: 문서·섹션] 표기) "
        "4) 추천 플랜(요금 근거 인용) 5) 도입 절차/다음 단계. "
        "빈 강조어·과장 없이 간결하게. 근거가 부족하면 '확인 필요'라고 적는다."
    )
    user = (
        f"고객사: {customer or '(미기재)'}\n"
        f"고객 요청/상황:\n{req or '(요청 내용 없음 — 대표 제안으로 작성)'}\n\n"
        f"=== 근거(이 안의 내용만 사용) ===\n{ev_block}\n=== 근거 끝 ===\n\n"
        "위 근거만으로 제안서 초안을 작성하라."
    )
    res = _call_llm(system, user, target=agent_id or "proposal")
    if res:
        text, model = res
        return {"draft": text, "citations": citations, "used_llm": True, "model": model}
    # 폴백(키 없음/호출 실패)
    return {"draft": _template_draft(customer, req, evidence), "citations": citations,
            "used_llm": False, "model": None}
