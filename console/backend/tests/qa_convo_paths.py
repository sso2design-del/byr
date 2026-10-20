"""메신저 대화 경로 QA — 단일 에이전트 대화 엔진(app.conversation)을 경로별로 태워 본다.

자동 회귀 테스트와 달리 '사용자가 메신저에서 겪을 수 있는 경로'를 한 줄씩 나열하고
기대 응답과 실제 응답을 표로 남긴다. 실패 건은 고칠 대상이다.
실행: ./.venv/bin/python -m tests.qa_convo_paths   (backend 디렉토리에서)
"""
import os, sys, tempfile, json
os.environ["BYR_CONNECTORS_LIVE"] = "0"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app.conversation as C, app.execution as ex, app.audit as au  # noqa: E402

tmp = tempfile.mkdtemp()
C.SESSION_FILE = os.path.join(tmp, "s.json")
ex.STAGING_FILE = os.path.join(tmp, "st.json")
au.AUDIT_FILE = os.path.join(tmp, "a.jsonl")

SOLO = {"id": "qa-vat", "name": "부가세 대사 도우미", "job": "vat_reconcile"}
APPR = {"id": "qa-vat2", "name": "부가세 대사 도우미", "job": "vat_reconcile", "approvers": ["U2"]}
TEAM_APPR = {"id": "qa-vat3", "name": "부가세 대사 도우미", "job": "vat_reconcile", "approvers": ["U1", "U2"]}
SELF_OK = {"id": "qa-vat4", "name": "부가세 대사 도우미", "job": "vat_reconcile", "approvers": ["U1", "U2"], "allow_self_approval": True}
REG = {"id": "qa-rs", "name": "기업 분석", "job": "securities_research"}
AML = {"id": "qa-aml", "name": "의심거래 보고", "job": "compliance_aml", "approvers": ["U2"]}
VAT_OK = ["2026-04-01", "2026-06-30", "NHN01", "0"]

ROWS = []
_ch = [0]


def ch():
    _ch[0] += 1
    return f"C{_ch[0]:02d}"


def say(c, agent, text, user="U1"):
    return "\n".join(C.handle("slack", c, user, agent, text))


def staged(agent, c, user="U1"):
    say(c, agent, "부가세 대사 해줘", user)
    out = ""
    for v in VAT_OK:
        out = say(c, agent, v, user)
    return out


def case(no, group, path, inp, expect, got, ok):
    ROWS.append({"no": no, "group": group, "path": path, "input": inp, "expect": expect,
                 "got": " ".join(got.split())[:90], "ok": bool(ok)})


# ── 1. 시작과 라우팅 ──
c = ch(); r = say(c, SOLO, "안녕하세요")
case(1, "시작", "시작 문구 없이 인사", "안녕하세요", "직무 소개와 시작 문구 예시", r, "바로 시작하려면" in r)
c = ch(); r = say(c, SOLO, "부가세 대사 해줘")
case(2, "시작", "시작 문구로 작업 시작", "부가세 대사 해줘", "작업 시작 + 첫 질문", r, "부가세 대사* 시작" in r and ":speech_balloon:" in r)
c = ch(); r = say(c, SOLO, "부가세 대사랑 월마감 해줘")
case(3, "시작", "두 작업에 걸치는 요청", "부가세 대사랑 월마감 해줘", "후보 2개를 보여 주고 고르게 함", r, "어떤 작업을 원하시나요" in r)
r = say(c, SOLO, "날씨 어때")
case(4, "시작", "후보 고르는 중 엉뚱한 답", "날씨 어때", "후보 중에서 다시 고르게 함", r, "중에 골라주세요" in r)
r = say(c, SOLO, "월마감")
case(5, "시작", "후보 중 하나 선택", "월마감", "선택한 작업 시작", r, "월마감* 시작" in r)

# ── 2. 입력 수집과 검증 ──
c = ch(); say(c, SOLO, "부가세 대사 해줘"); r = say(c, SOLO, "4월 1일")
case(6, "입력", "날짜 칸에 형식이 다른 날짜", "4월 1일", "YYYY-MM-DD 형식 안내", r, ":warning:" in r and "YYYY-MM-DD" in r)
c = ch(); say(c, SOLO, "부가세 대사 해줘"); say(c, SOLO, "2026-04-01"); say(c, SOLO, "2026-06-30"); r = say(c, SOLO, "없음")
case(7, "입력", "필수 칸에 '없음'", "없음 (회사 코드)", "필수 항목이라고 다시 요청", r, "필요합니다" in r)
c = ch(); say(c, SOLO, "부가세 대사 해줘")
for v in VAT_OK[:3]:
    say(c, SOLO, v)
r = say(c, SOLO, "영")
case(8, "입력", "숫자 칸에 글자", "영 (허용 오차)", "숫자로 입력하라고 안내", r, "숫자로 입력" in r)
r = say(c, SOLO, "150")
case(9, "입력", "숫자 범위 초과", "150 (허용 오차 %)", "0~100 범위 안내", r, "0~100" in r)
r = say(c, SOLO, "0")
case(10, "입력", "모든 입력 완료", "0", "초안 준비 + 승인 방법 안내", r, "작업 초안 준비됨" in r and "`승인`" in r)

# ── 3. 승인 단어와 승인 정책 ──
c = ch(); staged(SOLO, c); r = say(c, SOLO, "확인")
case(11, "승인", "일상어 '확인'", "확인", "승인하지 않고, 초안도 다시 만들지 않음", r, "승인 완료" not in r and "작업 초안 준비됨" not in r)
r = say(c, SOLO, "확정")
case(12, "승인", "일상어 '확정'", "확정", "승인하지 않고, 초안도 다시 만들지 않음", r, "승인 완료" not in r and "작업 초안 준비됨" not in r)
r = say(c, SOLO, "승인")
case(13, "승인", "승인자 없는 에이전트, 요청자 본인 승인", "승인", "승인 + '요청자 본인 승인' 표시", r, "요청자 본인 승인" in r)
r = say(c, SOLO, "승인")
case(14, "승인", "이미 승인한 건을 다시 승인", "승인 (두 번째)", "이미 승인됐다고 안내, 중복 처리 없음", r, "승인 완료" not in r)
c = ch(); staged(APPR, c); r = say(c, APPR, "승인")
case(15, "승인", "지정 승인자가 있는데 요청자가 승인", "승인 (요청자)", "지정 승인자만 가능하다고 거절", r, "지정 승인자" in r and "승인 완료" not in r)
r = say(c, APPR, "승인", user="U3")
case(16, "승인", "승인자가 아닌 제3자가 승인", "승인 (제3자)", "승인되지 않음", r, "승인 완료" not in r)
r = say(c, APPR, "승인", user="U2")
case(17, "승인", "지정 승인자가 채널에서 승인", "승인 (지정 승인자)", "다른 사람의 대기 건을 찾아 승인", r, "승인자 <@U2>" in r)
c = ch(); say(c, REG, "기업 분석 해줘"); say(c, REG, "삼성전자"); say(c, REG, "2026 상반기"); r = say(c, REG, "승인")
case(18, "승인", "규제 직무(증권 리포트) 자기 승인", "승인 (요청자)", "요청자 직접 승인 차단", r, "직접 승인할 수 없습니다" in r)
c = ch(); staged(SELF_OK, c); r = say(c, SELF_OK, "승인")
case(19, "승인", "승인자 목록에 요청자도 있고 자기 승인 허용", "승인 (요청자)", "요청자 본인 승인 허용", r, "요청자 본인 승인" in r)
c = ch(); staged(TEAM_APPR, c); r = say(c, TEAM_APPR, "승인")
case(32, "승인", "승인자 목록에 요청자도 있지만 자기 승인 미허용", "승인 (요청자)", "다른 지정 승인자가 승인하라고 거절", r, "지정 승인자가" in r and "승인 완료" not in r)
c = ch(); staged(SOLO, c); r = say(c, SOLO, "승인해줘")
case(20, "승인", "승인 단어에 말을 붙임", "승인해줘", "승인하지 않고 승인 방법 안내", r, "승인 완료" not in r and "`승인`" in r)

# ── 4. 반려와 수정 ──
c = ch(); staged(SOLO, c); r = say(c, SOLO, "반려: 기간이 틀렸어요")
case(21, "반려", "사유와 함께 반려", "반려: 기간이 틀렸어요", "사유 기록 후 처음부터 다시 입력", r, "반려 사유 기록" in r and ":speech_balloon:" in r)
c = ch(); r = say(c, SOLO, "반려: 테스트")
case(22, "반려", "진행 중 작업 없이 반려", "반려: 테스트", "반려할 작업이 없다고 안내", r, "반려할 진행 중 작업이 없어요" in r)
c = ch(); r = say(c, SOLO, "승인")
case(23, "승인", "진행 중 작업 없이 승인", "승인", "진행 중 작업이 없다고 안내", r, "진행 중인 작업이 없어요" in r)

# ── 5. 외부 반영(재실행) ──
c = ch(); staged(SOLO, c); r = say(c, SOLO, "재실행 live")
case(24, "반영", "승인 전 외부 반영 시도", "재실행 live", "승인 전 실행 차단", r, "승인 전에는 외부 실행이 차단" in r)
say(c, SOLO, "승인"); r = say(c, SOLO, "재실행 dry_run")
case(25, "반영", "승인 후 미리보기", "재실행 dry_run", "보낼 내용 미리보기", r, "미리보기" in r)
r = say(c, SOLO, "재실행 live")
case(26, "반영", "승인 후 외부 반영(커넥터 미연결)", "재실행 live", "완료 또는 미연결 안내(오류로 끊기지 않음)", r, ("작업 완료" in r) or ("반영 실패" in r))
r = say(c, SOLO, "재실행 live")
case(27, "반영", "같은 건을 다시 반영", "재실행 live (두 번째)", "이미 반영됐다고 안내", r, ("이미 반영된" in r) or ("반영 실패" in r))

# ── 6. 취소와 세션 ──
c = ch(); say(c, SOLO, "부가세 대사 해줘"); r = say(c, SOLO, "취소")
case(28, "세션", "입력 도중 취소", "취소", "진행 취소 안내", r, "진행을 취소했어요" in r)
r = say(c, SOLO, "2026-04-01")
case(29, "세션", "취소 뒤 이전 질문에 답", "2026-04-01", "새로 시작하라는 안내(이전 작업 이어가지 않음)", r, "바로 시작하려면" in r)
c = ch(); say(c, SOLO, "부가세 대사 해줘"); r = say(c, SOLO, "부가세 대사 해줘", user="U3")
r1 = say(c, SOLO, "2026-04-01")
case(30, "세션", "같은 채널 두 사람이 동시에 요청", "U1·U3 각각 시작", "사람마다 따로 진행(U1은 다음 질문)", r + " / " + r1, "부가세 대사* 시작" in r and "종료일" in r1)

# ── 7. 규칙 차단 ──
c = ch(); say(c, AML, "의심거래보고 STR 작성"); say(c, AML, "STR-2026-014"); say(c, AML, "분할 입금 반복"); r = say(c, AML, "없음")
case(31, "규칙", "STR 증빙에 '없음'", "없음 (증빙)", "증빙 없는 STR은 진행하지 않음(재요청 또는 확정 불가)", r, ("필요합니다" in r) or ("확정 불가" in r))
c = ch(); staged(SOLO, c); say(c, SOLO, "승인"); r = say(c, SOLO, "월마감 해줘")
case(33, "세션", "승인 뒤 새 작업 요청", "월마감 해줘", "이전 작업을 다시 돌리지 않고 새 작업 시작", r, "월마감* 시작" in r)

if __name__ == "__main__":
    passed = sum(r["ok"] for r in ROWS)
    for r in ROWS:
        print(f"{r['no']:>2} [{'PASS' if r['ok'] else 'FAIL'}] {r['group']} | {r['path']} | 입력: {r['input']} | 기대: {r['expect']} | 실제: {r['got']}")
    print(f"\n{passed}/{len(ROWS)} PASS")
    out = os.environ.get("QA_OUT")
    if out:
        json.dump(ROWS, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
