"""
제안서 PDF 생성 — 마크다운 초안 → 한글 PDF.

reportlab 내장 CID 폰트(HYSMyeongJo/HYGothic)를 써서 별도 TTF 없이 한글을 렌더링한다.
생성물은 data/proposals_pdf/{stage_id}.pdf 에 저장.
"""
import re
from pathlib import Path
from html import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

PDF_DIR = Path(__file__).parent.parent / "data" / "proposals_pdf"

_FONT_SERIF = "HYSMyeongJo-Medium"   # 본문(명조)
_FONT_SANS = "HYGothic-Medium"        # 제목(고딕)
_fonts_ready = False


def _ensure_fonts() -> None:
    global _fonts_ready
    if _fonts_ready:
        return
    pdfmetrics.registerFont(UnicodeCIDFont(_FONT_SERIF))
    pdfmetrics.registerFont(UnicodeCIDFont(_FONT_SANS))
    _fonts_ready = True


def _inline(text: str) -> str:
    """마크다운 인라인 → reportlab 마크업. **굵게**, [출처:…] 회색 처리."""
    out = escape(text)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"\[출처:\s*([^\]]+)\]",
                 r'<font size="8" color="#3a6ea5">[출처: \1]</font>', out)
    return out


def _styles():
    return {
        "title": ParagraphStyle("t", fontName=_FONT_SANS, fontSize=20, leading=26,
                                 spaceAfter=14, textColor="#1a1a2e"),
        "h2": ParagraphStyle("h2", fontName=_FONT_SANS, fontSize=14, leading=20,
                              spaceBefore=12, spaceAfter=6, textColor="#22223b"),
        "h3": ParagraphStyle("h3", fontName=_FONT_SANS, fontSize=12, leading=17,
                             spaceBefore=8, spaceAfter=4, textColor="#22223b"),
        "body": ParagraphStyle("b", fontName=_FONT_SERIF, fontSize=10.5, leading=16.5,
                               alignment=TA_LEFT, spaceAfter=4),
        "li": ParagraphStyle("li", fontName=_FONT_SERIF, fontSize=10.5, leading=16,
                             leftIndent=12, bulletIndent=2, spaceAfter=2),
    }


def generate(stage_id: str, title: str, markdown_text: str) -> str:
    """마크다운 초안을 PDF로. 저장 경로(str) 반환."""
    _ensure_fonts()
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    out = PDF_DIR / f"{stage_id}.pdf"
    st = _styles()

    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm, topMargin=22 * mm, bottomMargin=20 * mm,
        title=title,
    )
    flow = []
    # 첫 # 제목은 title로, 없으면 인자 title 사용
    lines = markdown_text.split("\n")
    used_title = False
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flow.append(Spacer(1, 5))
            continue
        h = re.match(r"^(#{1,3})\s+(.*)", line)
        if h:
            lvl, txt = len(h[1]), h[2]
            if lvl == 1 and not used_title:
                flow.append(Paragraph(_inline(txt), st["title"])); used_title = True
            else:
                flow.append(Paragraph(_inline(txt), st["h2"] if lvl <= 2 else st["h3"]))
            continue
        li = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.*)", line)
        if li:
            flow.append(Paragraph(_inline(li[1]), st["li"], bulletText="•"))
            continue
        flow.append(Paragraph(_inline(line), st["body"]))

    if not used_title:
        flow.insert(0, Paragraph(_inline(title), st["title"]))
    doc.build(flow)
    return str(out)


def path_for(stage_id: str) -> Path:
    return PDF_DIR / f"{stage_id}.pdf"
