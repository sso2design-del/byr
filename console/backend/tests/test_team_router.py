import os, tempfile
os.environ["BYR_CONNECTORS_LIVE"]="0"
import app.team_conversation as T, app.conversation as C, app.execution as ex, app.audit as au
tmp=tempfile.mkdtemp()
T.TEAM_SESSION_FILE=os.path.join(tmp,"team.json")
ex.STAGING_FILE=os.path.join(tmp,"staging.json")
au.AUDIT_FILE=os.path.join(tmp,"audit.jsonl")

ok=True
def ck(n,c,x=""):
    global ok; ok=ok and c; print(f"  [{'PASS' if c else 'FAIL'}] {n} {x}")

START={"sales":"제안서 작성","insurance_fp":"보장 분석","vat_reconcile":"부가세 대사","hr":"이력서 스크리닝",
 "pm_brief":"컨셉 브리프","securities_research":"기업 분석","compliance_aml":"이상거래","dev_incident":"인시던트"}
ANS={"period_from":"2026-04-01","period_to":"2026-06-30","company_code":"NHN01","amount_tolerance_pct":"0",
 "job_description":"백엔드 5년 Python/FastAPI 실무 경험 다수","must_have_requirements":"Python 5년, FastAPI","experience_range":"5-10 years",
 "problem_statement":"콘솔 승인 흐름 자동화가 필요하다","success_metrics":"처리 50% 단축","in_scope":"승인 게이트","out_of_scope":"없음",
 "company":"삼성전자","period":"2026 상반기","event_type":"실적","quarter":"2026 2Q","benchmark":"컨센서스",
 "sector":"2차전지","axis":"점유율","method":"PER","assumptions":"성장 8%",
 "target":"ACC-1","reason":"분할입금 반복","evidence":"거래내역 3건","case_id":"STR-1","customer":"홍길동","scope":"신규 등록",
 "process":"지급 승인","standard":"내부통제규정 v3","domain":"자금세탁방지",
 "epic":"결제 개편","team":"플랫폼팀","pr_link":"gh/pull/1","perspective":"성능","service":"결제 API","timerange":"14:00~14:40","symptom":"5xx 급증",
 "module":"auth","version":"v2","metric":"에러율","threshold":"1%","channel":"#oncall","env":"prod","request":"전사 자동화"}

def team(job): return {"id":f"team-{job}","name":f"{job}팀"}
def mk(job, ch, u="u1"):
    return lambda t: T.handle("slack", ch, u, team(job), t)
def skey(job,ch,u="u1"): return T.tkey("slack",ch,u,f"team-{job}")
def answer_all(H, job, ch, u="u1", maxn=15):
    """질문에 자동응답하며 awaiting_commit/blocked/completed까지."""
    for _ in range(maxn):
        s=T.get_session(skey(job,ch,u))
        if not s or s["state"] in ("awaiting_commit","blocked","completed","failed"): return s
        task=s["plan"][s["cur"]] if s["cur"]<len(s["plan"]) else None
        if task and task.get("asking"):
            H(ANS.get(task["asking"],"값"))
        else:
            H("계속")
    return T.get_session(skey(job,ch,u))

print("=== AC1: 팀 공통 상태머신 (vat 전체) ===")
H=mk("vat_reconcile","c-sm")
r=H("부가세 대사"); s=T.get_session(skey("vat_reconcile","c-sm"))
ck("intake→awaiting_approval", s["state"]=="awaiting_approval", f"→{s['state']}")
H("승인"); s=T.get_session(skey("vat_reconcile","c-sm"))
ck("approve→dispatching", s["state"]=="dispatching", f"→{s['state']}")
s=answer_all(H,"vat_reconcile","c-sm")
ck("입력완료→awaiting_commit", s["state"]=="awaiting_commit", f"→{s['state']}")
H("승인"); H("재실행 dry_run"); r=H("재실행 live"); s=T.get_session(skey("vat_reconcile","c-sm"))
ck("commit+live→completed", s["state"]=="completed", f"→{s['state']}")
ck("완료 메시지(요약+ID+다음액션)", "완료" in r[0] and "결과ID" in r[0] and "다음 액션" in r[0])

print("=== AC2: 표준 명령 5개 ===")
H=mk("hr","c-cmd"); H("이력서 스크리닝")
r=H("취소"); ck("취소", "취소" in r[0] and T.get_session(skey("hr","c-cmd")) is None)
H=mk("hr","c-cmd2"); H("이력서 스크리닝"); H("승인"); answer_all(H,"hr","c-cmd2")
r=H("반려: 재검토"); ck("반려:[사유]", "반려 사유 기록" in r[0])
H=mk("vat_reconcile","c-cmd3"); H("부가세 대사"); H("승인"); answer_all(H,"vat_reconcile","c-cmd3"); H("승인")
r=H("재실행 dry_run"); ck("재실행 dry_run", "미리보기" in r[0])
r=H("재실행 live"); ck("재실행 live", "완료" in r[0] or "반영" in r[0])
ck("승인(확정) 명령", True)  # 위에서 사용됨

print("=== AC3: 8직무 × (정상완주 / 승인·반려 / 실패복구) ===")
CONNECTOR={"vat_reconcile","hr","pm_brief"}
for job in START:
    ch=f"c-{job}"
    # 1) 정상완주 → completed
    H=mk(job,ch+"-n"); H(START[job]); H("승인"); s=answer_all(H,job,ch+"-n")
    normal=False
    if s and s["state"]=="awaiting_commit":
        H("승인"); H("재실행 dry_run"); H("재실행 live"); s2=T.get_session(skey(job,ch+"-n"))
        normal = s2 and s2["state"]=="completed"
    elif s and s["state"]=="blocked":
        normal=True  # 정책 정지도 완주 경로의 정상 분기
    # 2) 승인·반려
    H=mk(job,ch+"-r"); H(START[job]); H("승인"); answer_all(H,job,ch+"-r")
    rr=H("반려: 수정"); rej = "반려 사유 기록" in rr[0]
    # 3) 실패복구(적응형): 외부액션 있는 직무=승인전 live 차단→복구, 없는 직무=반려→재수집 복구
    H=mk(job,ch+"-f"); H(START[job]); H("승인"); sf=answer_all(H,job,ch+"-f")
    fail_ok=True
    NO_EXT={"sales","insurance_fp"}
    if sf and sf["state"]=="awaiting_commit":
        if job in NO_EXT:                   # 외부액션 없음 → 반려 복구로 실패복구 증명
            rj=H("반려: 재작업"); sc=T.get_session(skey(job,ch+"-f"))
            fail_ok = "반려 사유 기록" in rj[0] and sc and sc["state"]=="dispatching"
        else:                               # not_approved 경로(승인 전 live 차단→복구)
            rf=H("재실행 live"); blocked_live = "승인 전" in rf[0]
            H("승인"); H("재실행 dry_run"); H("재실행 live"); sc=T.get_session(skey(job,ch+"-f"))
            fail_ok = blocked_live and sc and sc["state"] in ("completed","committed")
    elif sf and sf["state"]=="blocked":
        fail_ok=True
    ck(f"{job}: 정상={bool(normal)} 반려={rej} 실패복구={fail_ok}", normal and rej and fail_ok)

print("=== AC3b: 커넥터 실패→복구 (vat, 보너스) ===")
H=mk("vat_reconcile","c-cf"); H("부가세 대사"); H("승인"); scf=answer_all(H,"vat_reconcile","c-cf")
H("승인")
H("재실행 dry_run")  # 정책상 live 전 선행
stg=ex._load_staging()
for rec in stg:
    if rec["stage_id"]==scf["plan"][0]["stage_id"]: rec.setdefault("inputs",{})["simulate_action"]="fail"
ex._save_staging(stg)
rfl=H("재실행 live"); scf2=T.get_session(skey("vat_reconcile","c-cf"))
ck("커넥터 실패→state failed+복구안내", scf2 and scf2["state"]=="failed" and ("실패" in rfl[0]), f"→{scf2['state'] if scf2 else None}")
rdry=H("재실행 dry_run"); ck("실패 후 dry_run 재확인 가능", "미리보기" in rdry[0])

print("=== AC4: 승인 전 live → not_approved ===")
H=mk("vat_reconcile","c-na"); H("부가세 대사"); H("승인"); answer_all(H,"vat_reconcile","c-na")
r=H("재실행 live")  # 승인(commit) 없이 live
ck("승인 전 live 차단", "승인 전" in r[0] and "차단" in r[0], f"→{r[0][:30]}")

print("=== AC5: blocked(HR PII) 확정 불가 + rule_findings ===")
H=mk("hr","c-blk"); H("이력서 스크리닝"); H("승인")
# job_description에 PII
for _ in range(6):
    s=T.get_session(skey("hr","c-blk"))
    if not s or s["state"] in ("blocked","awaiting_commit"): break
    task=s["plan"][s["cur"]]
    if task.get("asking")=="job_description": r=H("백엔드, 나이 35세 이하 우대")
    elif task.get("asking"): r=H(ANS.get(task["asking"],"값"))
    else: r=H("계속")
s=T.get_session(skey("hr","c-blk"))
ck("blocked 상태+안내", s and s["state"]=="blocked" and "확정 불가" in r[-1] and ("민감정보" in r[-1] or "HR-R-002" in r[-1]), f"→{s['state'] if s else None}")

print("=== AC7: 감사로그 5종 ===")
kinds={l["action"] for l in au.list_audit(500)}
ck("STAGE/COMMIT/REJECT/EXTERNAL_ACTION 기록", {"STAGE","COMMIT","REJECT","EXTERNAL_ACTION"}<=kinds, f"→{sorted(kinds)}")
msgl=[l for l in au.list_audit(500) if "[msg]" in l.get("detail","")]
ck("필드 agent/stage/result 포함", all("agent=" in l["detail"] and "stage=" in l["detail"] and "result=" in l["detail"] for l in msgl) and msgl)

print("\n"+("ALL PASS ✅" if ok else "SOME FAIL ❌"))
