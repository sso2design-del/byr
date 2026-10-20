import os, tempfile
os.environ["BYR_CONNECTORS_LIVE"]="0"
import app.team_conversation as T, app.conversation as C, app.execution as ex, app.audit as au, app.team_config as cfg
tmp=tempfile.mkdtemp()
T.TEAM_SESSION_FILE=os.path.join(tmp,"team.json"); ex.STAGING_FILE=os.path.join(tmp,"s.json"); au.AUDIT_FILE=os.path.join(tmp,"a.jsonl")
ok=True
def ck(n,c,x=""):
    global ok; ok=ok and c; print(f"  [{'PASS' if c else 'FAIL'}] {n} {x}")
def team(tid="team-x"): return {"id":tid,"name":"팀"}
def mk(ch,u="u1",tid="team-x"): return lambda t: T.handle("slack",ch,u,team(tid),t)
def key(ch,u="u1",tid="team-x"): return T.tkey("slack",ch,u,tid)

print("=== 정책3: CHANNEL_PRIORITY 라우팅(team>agent, 설정값 반영) ===")
_by_kind = {
    "agent": {"공유채널": {"kind": "agent", "name": "재무봇"}},
    "team":  {"공유채널": {"kind": "team", "name": "재무팀"}},
}
r_default = cfg.merge_routes_by_priority(_by_kind)                       # 기본 team>agent
ck("기본 우선순위 team → 팀이 응답 주체", r_default["공유채널"]["kind"] == "team", f"→ {r_default['공유채널']['kind']}")
r_flip = cfg.merge_routes_by_priority(_by_kind, priority=("agent", "team"))  # 설정 뒤집기
ck("우선순위 변경 시 순서를 따름(agent 우선)", r_flip["공유채널"]["kind"] == "agent", f"→ {r_flip['공유채널']['kind']}")

print("=== AC1: 모호 발화 → 후보 2개(점수순) + 1/2 선택 ===")
H=mk("c1")
r=H("온보딩 인사 요약 관련")   # 온보딩 + 인사 요약 매칭
amb = "신뢰도" in r[-1] and "1)" in r[-1] and "2)" in r[-1]
ck("후보 2개 점수(신뢰도%) 제시", amb, f"→ {r[-1].splitlines()[-1][:40]}")
r=H("1")
ck("숫자 1 선택 → 작업 진입", "작업으로 나눕니다" in r[-1] or "진행할까요" in r[-1], f"→ {r[-1][:40]}")

print("=== AC2/AC3: 동시 다건 생성/현황/전환/취소 ===")
H=mk("c2")
H("부가세 대사")             # t1
H("이력서 스크리닝")         # t2 (동시)
ws=T.get_workspace(key("c2"))
ck("동시 2개 작업 생성", len(ws["tasks"])==2, f"→ {list(ws['tasks'])}")
r=H("현황")
ck("현황 → 작업별 상태", "[t1]" in r[-1] and "[t2]" in r[-1], f"→ {r[-1][:50]}")
r=H("전환: t1")
ws=T.get_workspace(key("c2"))
ck("전환:[id] → active 변경", ws["active"]=="t1")
r=H("취소: t2")
ws=T.get_workspace(key("c2"))
ck("취소:[id] → 특정 작업 취소", ws["tasks"]["t2"]["state"]=="cancelled")

print("=== AC4/AC5: TTL 만료 → 재개 ===")
H=mk("c4")
H("부가세 대사")            # t1
ws=T.get_workspace(key("c4")); ws["tasks"]["t1"]["updated_at"]="2020-01-01T00:00:00"; T.save_workspace(key("c4"),ws)
r=H("현황")                 # 만료 트리거
expired_msg = any("만료" in m and "재개:t1" in m for m in r)
ck("TTL 만료 → 요약+재개 안내", expired_msg, f"→ {r[0][:50]}")
ck("SESSION_EXPIRED 로그", any(l["action"]=="SESSION_EXPIRED" for l in au.list_audit(200)))
r=H("재개: t1")
ck("재개:[id] → 이어서 진행", "재개" in r[-1] and T.get_workspace(key("c4"))["active"]=="t1")
ck("SESSION_RESUMED 로그", any(l["action"]=="SESSION_RESUMED" for l in au.list_audit(200)))

print("=== AC6: blocked 연속 2회 → 에스컬레이션 ===")
H=mk("c6")
def answer_pii(pii):
    """HR 3개 입력을 채우되 job_description에 PII 주입 → run→blocked. 마지막 응답 반환."""
    r=[""]
    for _ in range(6):
        ws=T.get_workspace(key("c6")); task=ws["tasks"][ws["active"]]
        if task["state"]!="dispatching": break
        item=task["plan"][task["cur"]] if task["cur"]<len(task["plan"]) else None
        if item and item.get("asking"):
            k=item["asking"]
            a=pii if k=="job_description" else ("Python 5년" if k=="must_have_requirements" else "5-10 years")
            r=H(a)
        else: r=H("계속")
    return r
H("이력서 스크리닝"); H("승인")
r=answer_pii("백엔드 개발, 나이 35세 이하 우대")   # blocked #1
H("반려: 다시")                                     # 재수집
r=answer_pii("경력 무관, 나이 40세 이상")           # blocked #2 → escalate
esc = any("에스컬레이션" in m for m in r)
ck("blocked 2회 → 에스컬레이션 메시지", esc, f"→ {r[-1][:50]}")
ck("ESCALATED 로그", any(l["action"]=="ESCALATED" for l in au.list_audit(300)))

print("=== AC7: 승인 동의어 4종 ===")
ALLOWED=["승인","확정","확인","오케이","ok","approve","진행해","진행"]
for w in ALLOWED:
    ck(f"'{w}' → approve", T.parse_task_command(w)[0]=="approve")
ck("승인 동의어는 정확히 8종", set(cfg.APPROVAL_WORDS)==set(ALLOWED), f"→ {sorted(cfg.APPROVAL_WORDS)}")
for w in ["발송","send","진행하자","고고","확인요망"]:   # 8종 외 → 승인 아님(누수 차단)
    ck(f"8종 외 '{w}' 승인 차단", T.parse_task_command(w)[0]!="approve", f"→ {T.parse_task_command(w)[0]}")
# e2e: 오케이로 확정
H=mk("c7"); H("부가세 대사"); H("오케이")   # 오케이=approve → dispatching
ws=T.get_workspace(key("c7"))
ck("'오케이' e2e 승인 동작", ws["tasks"]["t1"]["state"]=="dispatching", f"→ {ws['tasks']['t1']['state']}")

print("=== 정책: live 전 dry_run 강제 ===")
H=mk("c7b")
H("부가세 대사"); H("승인")
# required inputs 채우기
for _ in range(8):
    ws=T.get_workspace(key("c7b"))
    if not ws or not ws.get("active"):
        break
    task=ws["tasks"].get(ws["active"])
    if not task:
        break
    if task["state"] in ("awaiting_commit","blocked"):
        break
    item=task["plan"][task["cur"]] if task["cur"]<len(task["plan"]) else None
    if item and item.get("asking"):
        k=item["asking"]
        v={"period_from":"2026-04-01","period_to":"2026-06-30","company_code":"NHN01","amount_tolerance_pct":"0"}.get(k,"값")
        H(v)
    else:
        H("계속")
H("승인")
r=H("재실행 live")
ck("승인 후 live 직접 실행 차단(dry_run 선행 필요)", "dry_run" in r[-1] and "필요" in r[-1], f"→ {r[-1][:60]}")
r=H("재실행 dry_run")
ck("dry_run 성공", "미리보기" in r[-1], f"→ {r[-1][:60]}")
r=H("재실행 live")
ck("dry_run 후 live 허용", "완료" in r[-1] or "반영" in r[-1], f"→ {r[-1][:60]}")

print("=== AC9: 감사 신규 4종 + 필드 ===")
kinds={l["action"] for l in au.list_audit(500)}
ck("SWITCH_TASK/SESSION_EXPIRED/SESSION_RESUMED/ESCALATED 기록",
   {"SWITCH_TASK","SESSION_EXPIRED","SESSION_RESUMED","ESCALATED"}<=kinds, f"→ {sorted(kinds)}")
team_logs=[l for l in au.list_audit(500) if "[team]" in l.get("detail","")]
ck("필드 agent/task/result/reason 포함",
   all(all(k in l["detail"] for k in ("agent=","task=","result=","reason=")) for l in team_logs) and team_logs)

print("\n"+("ALL PASS ✅" if ok else "SOME FAIL ❌"))
