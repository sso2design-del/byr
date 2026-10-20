import os, tempfile
os.environ["BYR_CONNECTORS_LIVE"]="0"
import app.conversation as C, app.execution as ex, app.audit as au
tmp=tempfile.mkdtemp()
C.SESSION_FILE=os.path.join(tmp,"sessions.json")
ex.STAGING_FILE=os.path.join(tmp,"staging.json")
au.AUDIT_FILE=os.path.join(tmp,"audit.jsonl")

ok=True
def ck(n,c,x=""):
    global ok; ok=ok and c; print(f"  [{'PASS' if c else 'FAIL'}] {n} {x}")
def A(job): return {"id":f"test-{job}","name":f"{job} 직원","job":job,"role":job}
JOBS=["sales","insurance_fp","vat_reconcile","hr","pm_brief","securities_research","compliance_aml","dev_incident"]
Q=lambda m: m.count(":speech_balloon:")

print("=== AC1: 8 job 온보딩 상이 ===")
onbs={j:C.onboarding_message(A(j)) for j in JOBS}
ck("8개 고유", len(set(onbs.values()))==8, f"→ {len(set(onbs.values()))}/8")

print("=== AC2: 템플릿 intent 라우팅 ===")
g=t=0
for tp in C.TEMPLATES:
    t+=1; r=C.route_intent(tp["job"], tp["intents"][0])
    if r.get("match",{}).get("key")==tp["key"]: g+=1
    else: print("   ✗", tp["key"], "→", r)
ck(f"라우팅 {g}/{t}", g==t)

print("=== AC3+4: 순차질문·세션누적·run→staged (vat) ===")
V=A("vat_reconcile"); H=lambda t: C.handle("slack","c-vat","u1",V,t)
r=H("부가세 대사"); ck("시작 후 질문 1개", Q(r[-1])==1)
kv=C.skey("slack","c-vat","u1","test-vat_reconcile")
for k,v in [("period_from","2026-04-01"),("period_to","2026-06-30"),("company_code","NHN01"),("amount_tolerance_pct","0")]:
    r=H(v)
coll=C.get_session(kv)["collected_inputs"]
ck("세션 누적 4건", all(x in coll for x in ["period_from","period_to","company_code","amount_tolerance_pct"]), f"→{list(coll)}")
ck("run→staged+요약+ID", "작업 초안 준비됨" in r[-1] and C.get_session(kv)["stage_id"])

print("=== AC5: 명령(승인/재실행 dry/live/취소) ===")
r=H("승인"); ck("승인→확정+미리보기", "승인 완료" in r[0])
r=H("재실행 dry_run"); ck("재실행 dry_run", "미리보기" in r[0])
r=H("재실행 live"); ck("재실행 live→완료", ("작업 완료" in r[0]) or ("반영" in r[0]))
r=H("취소"); ck("취소→종료", "취소" in r[0] and C.get_session(kv) is None)

print("=== AC5b: 반려:[사유] → 상태기록+다음입력 ===")
P=A("pm_brief"); HP=lambda t: C.handle("slack","c-pm","u2",P,t)
HP("컨셉 브리프")
for v in ["문제 정의 문장","지표1","범위A","없음"]: r=HP(v)
kp=C.skey("slack","c-pm","u2","test-pm_brief")
r=HP("반려: 지표 애매")
s=C.get_session(kp)
ck("반려 상태기록", s["last_status"]=="rejected" and "애매" in s["last_error"])
ck("반려 후 질문 재개", Q(r[-1])==1)

print("=== AC6: 승인 전 live → not_approved 차단 ===")
V2=A("vat_reconcile"); H2=lambda t: C.handle("slack","c-v6","u3",V2,t)
H2("부가세 대사")
for v in ["2026-04-01","2026-06-30","NHN01","0"]: H2(v)
r=H2("재실행 live")   # 승인 안 하고 바로 live
ck("승인 전 live 차단+안내", "승인 전" in r[0] and "차단" in r[0], f"→ {r[0][:40]}")

print("=== AC7: blocked(HR PII) → 확정불가 + rule_findings ===")
HR=A("hr"); HH=lambda t: C.handle("slack","c-hr","u4",HR,t)
HH("이력서 스크리닝")
# job_description에 PII(나이) 삽입
r=HH("백엔드 5년, 나이 35세 이하 우대")   # 첫 질문=job_description 가정
# 이후 남은 필수 채우기
for v in ["Python 5년, FastAPI","5-10 years"]:
    if "작업 초안" not in r[-1] and "확정 불가" not in r[-1]: r=HH(v)
staged_msg=r[-1]
ck("blocked 안내+규칙", "확정 불가(blocked)" in staged_msg and ("민감정보" in staged_msg or "HR-R-002" in staged_msg), f"→ {staged_msg[:60]}")
r=HH("승인")
ck("blocked 확정 거부", "규칙 위반" in r[0])

print("=== AC9: 감사로그(메시지 기반 액션) ===")
logs=au.list_audit(200)
kinds={l["action"] for l in logs}
msg_logs=[l for l in logs if "[msg]" in l.get("detail","")]
ck("STAGE/COMMIT/EXTERNAL_ACTION/REJECT 기록", {"STAGE","COMMIT","EXTERNAL_ACTION","REJECT"}<=kinds, f"→ {sorted(kinds)}")
ck("agent_id·stage·result 포함", all(("agent=" in l["detail"] and "stage=" in l["detail"] and "result=" in l["detail"]) for l in msg_logs) and len(msg_logs)>=5, f"→ {len(msg_logs)}건")
for l in msg_logs[:5]: print("     ", l["action"], "|", l["detail"][:60])

print("\n"+("ALL PASS ✅" if ok else "SOME FAIL ❌"))
