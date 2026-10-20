"""
제안서 슬라이드 덱 생성 — 디자인된 HTML 덱 → 헤드리스 Chrome으로 PDF 렌더.

reportlab 텍스트 PDF가 아니라, 16:9 슬라이드(표지 + 내용 슬라이드)를 CSS로 디자인해
실제 발표/제안에 쓸 수 있는 퀄리티로 만든다. Chrome이 없으면 텍스트 PDF로 폴백.
"""
import re
import math
import html
import time
import shutil
import subprocess
from pathlib import Path

PDF_DIR = Path(__file__).parent.parent / "data" / "proposals_pdf"
_HTML_DIR = Path(__file__).parent.parent / "data" / "proposals_html"

_CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def chrome_path() -> str | None:
    import os
    env = os.environ.get("BYR_CHROME_PATH") or os.environ.get("AGENT_BROWSER_EXECUTABLE_PATH")
    for p in [env, *_CHROME_CANDIDATES]:
        if p and Path(p).exists():
            return p
    return shutil.which("google-chrome") or shutil.which("chromium")


def available() -> bool:
    return chrome_path() is not None


# ── 브랜드 로고(흐르는 B 마크) ─────────────────────────────────────
_LOGO_B = ("M576.183 293.704C609.643 289.988 645.923 303.731 670.654 326.037C695.349 348.676 710.084 380.165 "
           "711.643 413.63C713.421 449.481 701.026 481.922 677.029 508.356C679.861 510.677 682.428 512.856 685.049 "
           "515.422C709.314 539.507 723.044 572.228 723.233 606.416C723.443 640.333 709.833 671.137 685.957 "
           "695.006C669.223 711.497 648.186 722.944 625.251 728.039C609.25 731.651 597.157 730.669 581.105 "
           "730.697C567.923 730.779 554.741 730.791 541.558 730.734L425.49 730.594C431.548 713.19 443.676 696.969 "
           "458.124 685.643C473.731 673.294 492.264 665.186 511.927 662.106C524.101 660.121 534.238 660.473 546.439 "
           "660.477L581.429 660.502C591.915 660.506 602.867 660.968 613.059 658.381C622.201 656.057 630.576 651.383 "
           "637.353 644.822C648.284 634.27 653.327 620.743 653.63 605.709C653.616 604.435 653.568 603.161 653.486 "
           "601.89C652.559 586.917 645.348 572.032 633.786 562.59C577.685 516.776 503.95 592.316 467.404 "
           "628.958C456.618 639.787 445.742 650.527 434.779 661.178C394.356 699.894 355.503 726.035 298.521 "
           "730.249C309.51 705.616 321.929 680.82 333.542 656.428L408.288 500.171L446.959 418.957L463.172 "
           "384.854C471.221 368.03 476.99 354.387 489.255 340.012C512.048 313.297 540.998 296.839 576.183 293.704Z")
_LOGO_COUNTER = ("M583.81 363.206C592.924 362.338 603.705 365.072 611.512 369.469C660.991 397.287 647.805 467.516 "
                 "593.068 478.499C581.648 480.79 569.885 481.493 558.528 484.483C539.753 489.495 521.768 497.098 "
                 "505.092 507.074C493.34 514.31 480.164 523.047 470.17 532.607C483.72 503.143 497.608 473.836 "
                 "511.829 444.69L526.929 412.924C531.212 403.93 536.59 391.359 542.819 383.989C553.781 371.021 "
                 "567.019 364.682 583.81 363.206Z")


def _logo(size: int = 34) -> str:
    """둥근 타일 로고(흰 배경용은 아님 — 파비콘형)."""
    return (f'<svg viewBox="0 0 1024 1024" width="{size}" height="{size}" style="display:block;flex-shrink:0">'
            f'<rect width="1024" height="1024" rx="224" fill="#0A0A0B"/>'
            f'<g transform="translate(512 512) scale(1.5) translate(-512 -512)">'
            f'<path fill="#FFFFFF" d="{_LOGO_B}"/><path fill="#0A0A0B" d="{_LOGO_COUNTER}"/></g></svg>')


def _logo_mono(size: int = 30, color: str = "#ffffff") -> str:
    """타일 없는 단색 B 마크(카운터는 evenodd로 투명 → 어떤 배경에도 선명)."""
    return (f'<svg viewBox="0 0 1024 1024" width="{size}" height="{size}" style="display:block;flex-shrink:0">'
            f'<g transform="translate(512 512) scale(1.5) translate(-512 -512)">'
            f'<path fill="{color}" fill-rule="evenodd" d="{_LOGO_B} {_LOGO_COUNTER}"/></g></svg>')


def _logo_invert(size: int = 30, tile: str = "#FFFFFF", glyph: str = "#14163A") -> str:
    """반전 로고 — 흰 타일 + 네이비 B(카운터=타일색으로 카빙). 어두운 배경용."""
    return (f'<svg viewBox="0 0 1024 1024" width="{size}" height="{size}" style="display:block;flex-shrink:0">'
            f'<rect width="1024" height="1024" rx="224" fill="{tile}"/>'
            f'<g transform="translate(512 512) scale(1.5) translate(-512 -512)">'
            f'<path fill="{glyph}" d="{_LOGO_B}"/><path fill="{tile}" d="{_LOGO_COUNTER}"/></g></svg>')


# ── 인라인 마크업 → HTML ──────────────────────────────────────────
def _inline(text: str) -> str:
    out = html.escape(text or "")
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\[출처:\s*([^\]]+)\]", r'<span class="cite">\1</span>', out)
    return out


_ACCENT_BY_TYPE = {
    "situation": "과제", "solution": "제안", "evidence": "근거",
    "plan": "플랜", "next": "다음 단계",
}


def _bullet_html(b) -> str:
    """불릿 = 문자열 또는 {lead, detail}. lead(굵게) + detail(설명) 렌더."""
    if isinstance(b, dict):
        lead = _inline(b.get("lead", ""))
        detail = _inline(b.get("detail", ""))
        inner = f'<span class="b-lead">{lead}</span>'
        if detail:
            inner += f'<span class="b-detail">{detail}</span>'
        return f"<li>{inner}</li>"
    return f'<li><span class="b-lead">{_inline(str(b))}</span></li>'


def _metrics_html(metrics: list) -> str:
    cards = ""
    for m in metrics[:4]:
        val = _inline(str(m.get("value", "")))
        lab = _inline(str(m.get("label", "")))
        sub = _inline(str(m.get("sub", "")))
        sub_html = f'<div class="sub">{sub}</div>' if sub else ""
        cards += (f'<div class="metric"><div class="val">{val}</div>'
                  f'<div class="lab">{lab}</div>{sub_html}</div>')
    return f'<div class="metrics">{cards}</div>'


def _table_html(table: dict) -> str:
    cols = table.get("columns") or []
    rows = table.get("rows") or []
    hl = table.get("highlight")          # 강조 열
    hlr = table.get("highlight_row")     # 강조 행(추천)
    ths = "".join(
        f'<th class="{"hl" if hl == i else ""}">{_inline(str(c))}</th>' for i, c in enumerate(cols)
    )
    trs = ""
    for ri, r in enumerate(rows):
        rowcls = "hl-row" if hlr == ri else ""
        tds = "".join(
            f'<td class="{"hl" if hl == i else ""}">{_inline(str(v))}</td>' for i, v in enumerate(r)
        )
        trs += f'<tr class="{rowcls}">{tds}</tr>'
    return f'<table class="cmp"><thead><tr>{ths}</tr></thead><tbody>{trs}</tbody></table>'


def _bars_html(chart: dict) -> str:
    """가로 막대 인포그래픽(비교/분포). items: [{label, value, note, highlight}]."""
    items = (chart.get("items") or [])[:5]
    unit = html.escape(str(chart.get("unit", "")))
    vals = [float(i.get("value", 0) or 0) for i in items]
    mx = max(vals + [1])
    rows = ""
    for i in items:
        v = float(i.get("value", 0) or 0)
        pct = max(3, round(v / mx * 100))
        hl = "hl" if i.get("highlight") else ""
        note = f'<span class="bar-note">{_inline(str(i.get("note","")))}</span>' if i.get("note") else ""
        rows += (f'<div class="bar-row"><div class="bar-label">{_inline(str(i.get("label","")))}</div>'
                 f'<div class="bar-track"><div class="bar-fill {hl}" style="width:{pct}%"></div></div>'
                 f'<div class="bar-val">{_inline(str(i.get("value","")))}{unit}{note}</div></div>')
    return f'<div class="bars">{rows}</div>'


def _donut_html(chart: dict) -> str:
    """도넛 게이지(단일 비율 강조)."""
    val = max(0, min(100, float(chart.get("value", 0) or 0)))
    r = 92
    circ = 2 * math.pi * r
    dash = circ * val / 100
    label = _inline(str(chart.get("label", "")))
    cap = _inline(str(chart.get("caption", "")))
    vtxt = (str(chart.get("value", 0)).rstrip("0").rstrip(".") if isinstance(chart.get("value"), float) else str(chart.get("value", 0)))
    return f'''<div class="donut-wrap">
      <svg width="230" height="230" viewBox="0 0 230 230">
        <circle cx="115" cy="115" r="{r}" fill="none" stroke="#e9eafc" stroke-width="26"/>
        <circle cx="115" cy="115" r="{r}" fill="none" stroke="url(#dg)" stroke-width="26" stroke-linecap="round"
          stroke-dasharray="{dash:.1f} {circ:.1f}" transform="rotate(-90 115 115)"/>
        <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6d7bff"/><stop offset="1" stop-color="#a98bff"/></linearGradient></defs>
        <text x="115" y="115" text-anchor="middle" dominant-baseline="central" font-size="50" font-weight="900" fill="#3b46c9">{html.escape(vtxt)}%</text>
      </svg>
      <div class="donut-side"><div class="donut-label">{label}</div><div class="donut-cap">{cap}</div></div>
    </div>'''


def _timeline_html(items: list) -> str:
    """가로 타임라인(도입 로드맵)."""
    cells = ""
    for i, it in enumerate(items[:5]):
        cells += (f'<div class="tl-step"><div class="tl-line"></div><div class="tl-dot">{i+1}</div>'
                  f'<div class="tl-phase">{_inline(str(it.get("phase","")))}</div>'
                  f'<div class="tl-title">{_inline(str(it.get("title","")))}</div>'
                  f'<div class="tl-desc">{_inline(str(it.get("desc","")))}</div></div>')
    return f'<div class="timeline">{cells}</div>'


def _cards_html(cards: list) -> str:
    """요약 카드 그리드(제안 요약: 과제·해법·효과·다음 등)."""
    tags = ["과제", "해법", "효과", "다음 단계"]
    cs = ""
    for i, c in enumerate(cards[:4]):
        tag = _inline(str(c.get("tag") or (tags[i] if i < len(tags) else "")))
        title = _inline(str(c.get("title", "")))
        desc = _inline(str(c.get("desc", "")))
        cs += (f'<div class="ecard"><div class="ecard-tag">{tag}</div>'
               f'<div class="ecard-title">{title}</div><div class="ecard-desc">{desc}</div></div>')
    grid = "g2" if len(cards) >= 4 else "g1"
    return f'<div class="ecards {grid}">{cs}</div>'


def _flow_html(steps: list) -> str:
    """가로 플로우(작동 방식: 요청→근거검색→초안→승인→실행)."""
    n = len(steps[:6])
    parts = ""
    for i, s in enumerate(steps[:6]):
        label = _inline(str(s.get("label", s.get("title", ""))))
        desc = _inline(str(s.get("desc", "")))
        desc_html = f'<div class="flow-desc">{desc}</div>' if desc else ""
        parts += (f'<div class="flow-step"><div class="flow-num">{i+1}</div>'
                  f'<div class="flow-label">{label}</div>{desc_html}</div>')
        if i < n - 1:
            parts += '<div class="flow-arrow">→</div>'
    return f'<div class="flow">{parts}</div>'


def _bullets_block(blist: list, cls: str = "") -> str:
    dense = " dense" if len(blist) >= 4 else ""
    return f'<ul class="bullets{dense} {cls}">' + "".join(_bullet_html(b) for b in blist) + "</ul>"


def _slide_html(idx: int, total: int, s: dict) -> str:
    heading = _inline(s.get("heading", ""))
    kicker = _ACCENT_BY_TYPE.get(s.get("type", ""), "")
    subhead = s.get("subhead")
    subhead_html = f'<div class="subhead">{_inline(subhead)}</div>' if subhead else ""
    note = s.get("note")
    note_html = f'<div class="note">{_inline(note)}</div>' if note else ""
    blist = [b for b in (s.get("bullets") or []) if b]

    # 어떤 시각화가 있는지
    viz = None
    kind = None
    if s.get("cards"):
        viz, kind = _cards_html(s["cards"]), "cards"
    elif s.get("flow"):
        viz, kind = _flow_html(s["flow"]), "flow"
    elif s.get("bars") and s["bars"].get("items"):
        viz, kind = _bars_html(s["bars"]), "bars"
    elif s.get("donut") and s["donut"].get("value") is not None:
        viz, kind = _donut_html(s["donut"]), "donut"
    elif s.get("timeline"):
        viz, kind = _timeline_html(s["timeline"]), "timeline"
    elif s.get("metrics"):
        viz, kind = _metrics_html(s["metrics"]), "metrics"
    elif s.get("table") and s["table"].get("rows"):
        viz, kind = f'<div class="table-wrap">{_table_html(s["table"])}</div>', "table"

    # 조합: 차트 + 보조 불릿을 한 화면에
    if viz and blist:
        if kind in ("bars", "donut"):   # 좌:차트 / 우:인사이트
            body = (f'<div class="split"><div class="split-viz">{viz}</div>'
                    f'<aside class="split-aside">{_bullets_block(blist, "aside")}</aside></div>')
        else:                           # 상:차트 / 하:불릿
            body = f'<div class="stack"><div class="stack-viz {kind}">{viz}</div>{_bullets_block(blist)}</div>'
    elif viz:
        body = f'<div class="viz-full {kind}">{viz}</div>'
    else:
        body = _bullets_block(blist)

    return f"""
    <section class="slide content">
      <div class="slide-head">
        {'<div class="kicker">'+html.escape(kicker)+'</div>' if kicker else ''}
        <h2>{heading}</h2>
        {subhead_html}
      </div>
      <div class="body">{body}</div>
      {note_html}
      <div class="foot"><span class="fb">{_logo(18)} Byr · 제안서</span><span>{idx} / {total}</span></div>
    </section>"""


def _closing_html(s: dict) -> str:
    c = s.get("contact") or {}
    msg = _inline(s.get("message") or "함께 시작하시죠")
    sub = _inline(s.get("subhead") or "도입 상담과 데모를 도와드립니다.")
    rows = ""
    for label, val in [("담당", c.get("rep")), ("소속", c.get("company")),
                       ("이메일", c.get("email")), ("전화", c.get("phone")),
                       ("주소", c.get("address")), ("웹", c.get("web"))]:
        if val:
            rows += (f'<div class="c-row"><span class="c-key">{html.escape(label)}</span>'
                     f'<span class="c-val">{_inline(str(val))}</span></div>')
    return f"""
    <section class="slide closing">
      <div class="brand">{_logo_invert(30)}<span>Byr</span></div>
      <div class="bar"></div>
      <div class="thanks">감사합니다</div>
      <h1>{msg}</h1>
      <div class="csub">{sub}</div>
      <div class="card">{rows}</div>
    </section>"""


def render_html(deck: dict) -> str:
    customer = html.escape(deck.get("customer") or "고객사")
    title = _inline(deck.get("title") or f"{customer} 대상 Byr 도입 제안")
    subtitle = _inline(deck.get("subtitle") or "사내 근거 기반 · 사람 승인 게이트 · 감사 기록")
    date = html.escape(deck.get("date") or "")
    slides = deck.get("slides") or []
    total = len(slides) + 1  # + 표지
    body = "".join(
        _closing_html(s) if s.get("type") == "closing" else _slide_html(i + 2, total, s)
        for i, s in enumerate(slides)
    )
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @page {{ size: 1280px 720px; margin: 0; }}
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  html, body {{ margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo','Pretendard','Malgun Gothic',sans-serif; color: #1a1c2e; }}
  .slide {{ width: 1280px; height: 720px; page-break-after: always; position: relative; overflow: hidden; padding: 72px 84px; }}
  /* 표지 */
  .cover {{ background: radial-gradient(120% 120% at 100% 0%, #2b2f6b 0%, #14163a 55%, #0d0f28 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }}
  .cover .brand {{ position: absolute; top: 60px; left: 84px; display: flex; align-items: center; gap: 11px; font-weight: 800; letter-spacing: .5px; font-size: 22px; color: #c9ccff; }}
  .cover .bar {{ width: 64px; height: 6px; border-radius: 6px; background: linear-gradient(90deg,#6d7bff,#a98bff); margin-bottom: 26px; }}
  .cover h1 {{ font-size: 58px; line-height: 1.15; margin: 0 0 20px; font-weight: 800; letter-spacing: -0.5px; max-width: 900px; }}
  .cover .sub {{ font-size: 22px; color: #b9bde6; max-width: 820px; line-height: 1.5; }}
  .cover .meta {{ position: absolute; bottom: 60px; left: 84px; font-size: 16px; color: #8f93c9; }}
  .cover .client {{ position: absolute; bottom: 60px; right: 84px; font-size: 18px; color: #c9ccff; font-weight: 700; }}
  /* 마무리(클로징) */
  .closing {{ background: radial-gradient(120% 120% at 0% 100%, #2b2f6b 0%, #14163a 55%, #0d0f28 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }}
  .closing .brand {{ position: absolute; top: 60px; left: 84px; display: flex; align-items: center; gap: 11px; font-weight: 800; letter-spacing: .5px; font-size: 22px; color: #c9ccff; }}
  .closing .bar {{ width: 64px; height: 6px; border-radius: 6px; background: linear-gradient(90deg,#6d7bff,#a98bff); margin-bottom: 22px; }}
  .closing .thanks {{ font-size: 20px; font-weight: 700; letter-spacing: 3px; color: #8f93c9; margin-bottom: 10px; }}
  .closing h1 {{ font-size: 52px; line-height: 1.15; margin: 0 0 16px; font-weight: 800; letter-spacing: -0.5px; }}
  .closing .csub {{ font-size: 21px; color: #b9bde6; margin-bottom: 40px; }}
  .closing .card {{ display: inline-flex; flex-direction: column; gap: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 18px; padding: 28px 34px; max-width: 620px; }}
  .closing .c-row {{ display: flex; align-items: baseline; gap: 18px; font-size: 20px; }}
  .closing .c-key {{ width: 64px; flex-shrink: 0; font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #8f93c9; }}
  .closing .c-val {{ font-weight: 600; color: #eceeff; }}
  /* 내용 슬라이드 */
  .content {{ background: #ffffff; display: flex; flex-direction: column; }}
  .kicker {{ display: inline-block; font-size: 15px; font-weight: 800; color: #5b6cff; letter-spacing: 1px; margin-bottom: 10px; }}
  .content h2 {{ font-size: 40px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.5px; }}
  .subhead {{ font-size: 20px; color: #5b6cff; font-weight: 600; margin-top: 4px; }}
  .slide-head {{ border-bottom: 3px solid #eceefb; padding-bottom: 18px; margin-bottom: 26px; }}
  ul.bullets {{ list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 22px; flex: 1; }}
  ul.bullets.dense {{ gap: 15px; }}
  ul.bullets li {{ position: relative; padding-left: 30px; color: #2a2d45; }}
  ul.bullets li::before {{ content: ""; position: absolute; left: 4px; top: 11px; width: 10px; height: 10px; border-radius: 3px; background: linear-gradient(135deg,#6d7bff,#a98bff); }}
  .b-lead {{ font-size: 23px; font-weight: 800; color: #14163a; line-height: 1.35; }}
  ul.bullets.dense .b-lead {{ font-size: 21px; }}
  .b-detail {{ display: block; font-size: 18px; font-weight: 400; color: #4b4f6b; margin-top: 5px; line-height: 1.5; }}
  ul.bullets.dense .b-detail {{ font-size: 16.5px; margin-top: 3px; }}
  .b-lead strong {{ color: #4b57d6; }}
  .body {{ flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }}
  /* 수치 카드 */
  .metrics {{ display: flex; gap: 24px; align-items: stretch; flex: 1; }}
  .metric {{ flex: 1; background: linear-gradient(160deg,#f5f6ff,#eceeff); border: 1px solid #e2e5ff; border-radius: 20px; padding: 40px 30px; display: flex; flex-direction: column; justify-content: center; }}
  .metric .val {{ font-size: 60px; font-weight: 900; letter-spacing: -1.5px; line-height: 1; background: linear-gradient(135deg,#5b6cff,#a98bff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }}
  .metric .lab {{ font-size: 21px; font-weight: 800; color: #14163a; margin-top: 16px; line-height: 1.3; }}
  .metric .sub {{ font-size: 15px; color: #7a7e9c; margin-top: 8px; }}
  /* 비교 표 */
  .table-wrap {{ width: 100%; }}
  table.cmp {{ width: 100%; border-collapse: separate; border-spacing: 0; font-size: 20px; }}
  table.cmp th {{ text-align: left; padding: 16px 22px; background: #14163a; color: #fff; font-weight: 700; }}
  table.cmp th:first-child {{ border-top-left-radius: 12px; }}
  table.cmp th:last-child {{ border-top-right-radius: 12px; }}
  table.cmp th.hl {{ background: #4b57d6; }}
  table.cmp td {{ padding: 15px 22px; border-bottom: 1px solid #ececf6; color: #333650; }}
  table.cmp tr td:first-child {{ font-weight: 700; color: #14163a; }}
  table.cmp td.hl {{ background: #eef0ff; font-weight: 700; color: #2f38a8; }}
  table.cmp tbody tr:last-child td {{ border-bottom: none; }}
  table.cmp tr.hl-row td {{ background: #eef0ff; color: #2f38a8; font-weight: 800; }}
  table.cmp tr.hl-row td:first-child {{ color: #2f38a8; box-shadow: inset 4px 0 0 #5b6cff; }}
  /* 막대 인포그래픽 */
  .bars {{ display: flex; flex-direction: column; gap: 24px; flex: 1; justify-content: center; }}
  .bar-row {{ display: grid; grid-template-columns: 200px 1fr auto; align-items: center; gap: 20px; }}
  .bar-label {{ font-size: 21px; font-weight: 700; color: #14163a; text-align: right; }}
  .bar-track {{ height: 34px; background: #f0f1f9; border-radius: 10px; overflow: hidden; }}
  .bar-fill {{ height: 100%; border-radius: 10px; background: linear-gradient(90deg,#c3c9ff,#aab2ff); }}
  .bar-fill.hl {{ background: linear-gradient(90deg,#6d7bff,#a98bff); }}
  .bar-val {{ font-size: 22px; font-weight: 800; color: #3b46c9; min-width: 90px; }}
  .bar-note {{ display: block; font-size: 13px; font-weight: 500; color: #9195b4; }}
  /* 도넛 */
  .donut-wrap {{ display: flex; align-items: center; gap: 48px; flex: 1; justify-content: center; }}
  .donut-side .donut-label {{ font-size: 30px; font-weight: 800; color: #14163a; }}
  .donut-side .donut-cap {{ font-size: 19px; color: #6b6f8e; margin-top: 8px; max-width: 360px; line-height: 1.5; }}
  /* 타임라인 */
  .timeline {{ display: flex; gap: 0; flex: 1; align-items: flex-start; padding-top: 30px; }}
  .tl-step {{ flex: 1; position: relative; padding: 0 12px; text-align: center; }}
  .tl-line {{ position: absolute; top: 17px; left: 50%; width: 100%; height: 3px; background: #e4e6f5; z-index: 0; }}
  .tl-step:last-child .tl-line {{ display: none; }}
  .tl-dot {{ position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 16px; background: linear-gradient(135deg,#6d7bff,#a98bff); color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; }}
  .tl-phase {{ font-size: 15px; font-weight: 800; color: #5b6cff; letter-spacing: .5px; }}
  .tl-title {{ font-size: 21px; font-weight: 800; color: #14163a; margin-top: 6px; }}
  .tl-desc {{ font-size: 16px; color: #6b6f8e; margin-top: 8px; line-height: 1.5; }}
  /* 조합 레이아웃(차트+불릿) */
  .split {{ display: flex; gap: 44px; flex: 1; align-items: center; }}
  .split-viz {{ flex: 1.25; min-width: 0; }}
  .split-aside {{ flex: 1; min-width: 0; }}
  .split-aside ul.bullets {{ gap: 16px; }}
  .split-aside .b-lead {{ font-size: 20px; }}
  .split-aside .b-detail {{ font-size: 15.5px; }}
  .stack {{ display: flex; flex-direction: column; gap: 22px; flex: 1; }}
  .stack-viz {{ flex-shrink: 0; }}
  .stack-viz.metrics-wrap {{ }}
  .stack ul.bullets {{ gap: 12px; }}
  .stack ul.bullets .b-lead {{ font-size: 19px; }}
  .stack ul.bullets .b-detail {{ font-size: 15px; margin-top: 2px; }}
  .stack-viz.table .table-wrap table.cmp {{ font-size: 18px; }}
  .viz-full {{ flex: 1; display: flex; flex-direction: column; justify-content: center; }}
  /* 요약 카드 */
  .ecards {{ display: grid; gap: 22px; flex: 1; }}
  .ecards.g2 {{ grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }}
  .ecards.g1 {{ grid-auto-flow: column; }}
  .ecard {{ background: linear-gradient(160deg,#f6f7ff,#eef0ff); border: 1px solid #e3e6ff; border-radius: 18px; padding: 26px 28px; display: flex; flex-direction: column; }}
  .ecard-tag {{ align-self: flex-start; font-size: 13px; font-weight: 800; letter-spacing: .5px; color: #fff; background: linear-gradient(135deg,#6d7bff,#a98bff); padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }}
  .ecard-title {{ font-size: 24px; font-weight: 800; color: #14163a; line-height: 1.3; }}
  .ecard-desc {{ font-size: 17px; color: #4b4f6b; margin-top: 8px; line-height: 1.5; }}
  /* 작동 방식 플로우 */
  .flow {{ display: flex; align-items: center; justify-content: center; gap: 6px; flex: 1; }}
  .flow-step {{ flex: 1; background: #f6f7fb; border: 1px solid #e6e8f5; border-radius: 14px; padding: 22px 16px; text-align: center; }}
  .flow-num {{ width: 34px; height: 34px; border-radius: 50%; margin: 0 auto 12px; background: linear-gradient(135deg,#6d7bff,#a98bff); color: #fff; font-weight: 800; font-size: 17px; display: flex; align-items: center; justify-content: center; }}
  .flow-label {{ font-size: 19px; font-weight: 800; color: #14163a; line-height: 1.25; }}
  .flow-desc {{ font-size: 14px; color: #7a7e9c; margin-top: 8px; line-height: 1.4; }}
  .flow-arrow {{ flex: 0 0 auto; font-size: 30px; color: #b9bce0; font-weight: 700; }}
  .cite {{ display: inline-block; margin-left: 6px; padding: 2px 9px; border-radius: 999px; background: #eef0ff; color: #4b57d6; font-size: 14px; font-weight: 700; vertical-align: middle; }}
  .note {{ margin-top: 18px; padding: 14px 18px; background: #f6f7fb; border-left: 4px solid #5b6cff; border-radius: 8px; font-size: 18px; color: #454863; }}
  .foot {{ position: absolute; bottom: 36px; left: 84px; right: 84px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #a9adc6; }}
  .foot .fb {{ display: inline-flex; align-items: center; gap: 8px; }}
</style></head><body>
  <section class="slide cover">
    <div class="brand">{_logo_invert(30)}<span>Byr</span></div>
    <div class="bar"></div>
    <h1>{title}</h1>
    <div class="sub">{subtitle}</div>
    <div class="meta">{date}</div>
    <div class="client">{customer}</div>
  </section>
  {body}
</body></html>"""


def generate(stage_id: str, deck: dict) -> str | None:
    """덱 → PDF. 성공 시 경로, Chrome 없거나 실패 시 None."""
    ch = chrome_path()
    if not ch:
        return None
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    _HTML_DIR.mkdir(parents=True, exist_ok=True)
    html_path = _HTML_DIR / f"{stage_id}.html"
    out = PDF_DIR / f"{stage_id}.pdf"
    html_path.write_text(render_html(deck), encoding="utf-8")
    if out.exists():
        out.unlink()
    # Chrome은 PDF를 쓴 뒤에도 프로세스가 안 죽는 경우가 있어(headless 특성),
    # 완료를 기다리지 않고 출력 파일이 안정될 때까지 폴링 후 종료시킨다.
    try:
        proc = subprocess.Popen([
            ch, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", "--disable-background-networking", "--disable-sync",
            "--mute-audio", "--no-pdf-header-footer",
            f"--user-data-dir=/tmp/byr-chrome-{stage_id}",
            f"--print-to-pdf={out}",
            html_path.as_uri(),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        return None

    ok = False
    last = -1
    try:
        for _ in range(60):  # 최대 ~30초
            time.sleep(0.5)
            if out.exists():
                sz = out.stat().st_size
                if sz > 3000 and sz == last:  # 크기가 안정되면 완료로 간주
                    ok = True
                    break
                last = sz
            if proc.poll() is not None:  # Chrome이 스스로 종료
                ok = out.exists() and out.stat().st_size > 3000
                break
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
    return str(out) if ok else None
