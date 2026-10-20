from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import os
import app.agents as ag
import app.execution as ex
import app.audit as au
import app.teams as tm

app = FastAPI(title="Byr 에이전트 운영 콘솔 — 프로토타입")


@app.on_event("startup")
def _start_messenger_bot():
    """배포 환경에서도 채널 메시지에 봇이 답하도록 Slack 소켓 연결을 함께 띄운다."""
    from . import slack_runtime
    slack_runtime.start()

# 네이버·카카오 소셜 로그인(OAuth 2.0) — app/social_login.py
from app.social_login import router as _social_router  # noqa: E402
app.include_router(_social_router)


def _norm_ch(ch: str) -> str:
    return (ch or "").lstrip("#").strip().lower()


def _welcome_text(agent: dict) -> str:
    """배치 시 봇이 보내는 온보딩 메시지 — 직무별 사용법 + 준비 상태."""
    name = agent.get("name", "에이전트")
    job = agent.get("job")
    if job == "sales":
        from . import proposal as pr, mailer
        has_src = pr.has_sources(agent.get("id", ""))
        mail_ok = mailer.creds_present()
        mail_addr = mailer.connected_address() if mail_ok else None
        # 준비 상태 줄
        src_line = (":white_check_mark: 근거 소스 연결됨" if has_src
                    else ":warning: 근거 소스 *없음* → 콘솔에서 문서를 먼저 연결하세요")
        mail_line = (f":white_check_mark: 이메일 연결됨({mail_addr})" if mail_ok
                     else ":warning: 이메일 *미연결* → 콘솔에서 연결하면 승인 후 실제 발송돼요")
        ready = has_src and mail_ok
        head = (f":wave: 안녕하세요! *{name}*예요.\n"
                "이 채널에서 제가 *몇 가지만 여쭤보고* 제안서를 만들어 → 승인하면 이메일로 보내드려요.\n\n")
        status = f"{src_line}\n{mail_line}\n\n"
        cta = ("준비됐어요 — 채널에 *`제안서`* 라고 보내면 시작할게요. 제가 하나씩 여쭤볼게요. :blush:"
               if ready else "위 항목을 콘솔에서 먼저 연결하면 바로 시작할 수 있어요.")
        return head + status + cta
    # 그 외 직무 — 일반 안내
    return (f":wave: *{name}*가 이 채널에 배치됐어요.\n"
            "이 채널에서 바로 질문하거나 업무를 요청하세요. @멘션 없이 메시지만 보내도 제가 답합니다.\n"
            "_모든 답변·처리는 감사에 기록돼요._")


def _channel_in_use(channel: str) -> bool:
    """이 Slack 채널을 (아직 남아 있는) 다른 에이전트/팀이 쓰고 있는지.
    삭제 후 호출 → True면 채널을 아카이브하지 않는다(공유 채널 보호)."""
    key = _norm_ch(channel)
    if not key:
        return True
    for a in ag.list_agents():
        dep = a.get("deployment") or {}
        if _norm_ch(dep.get("channel", "")) == key:
            return True
    for t in tm.list_teams():
        for dep in (t.get("deployments") or []):
            if _norm_ch(dep.get("channel", "")) == key:
                return True
    return False

app.add_middleware(
    CORSMiddleware,
    # 배포 도메인은 CORS_ORIGINS 환경변수로 넘긴다(쉼표 구분)
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"]
    + [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/meta")
def meta():
    return {"platforms": ag.PLATFORMS, "mcp_catalog": ag.MCP_CATALOG, "templates": ag.TEMPLATES}

@app.get("/api/agents")
def list_agents():
    return ag.list_agents()

@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str):
    a = ag.get_agent(agent_id)
    if not a:
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    return a

@app.post("/api/agents")
def hire(payload: dict = Body(...)):
    a = ag.hire(
        payload.get("template", "blank"),
        payload.get("name", ""),
        payload.get("tone", []),
        payload.get("capabilities"),
        payload.get("mcp"),
        payload.get("icon"),
        payload.get("job"),
        payload.get("channels", []),
    )
    au.log("user", "HIRE", a["id"], f"직원 채용: {a['name']}")
    return a

@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: str, patch: dict = Body(...)):
    a = ag.update_agent(agent_id, patch)
    if not a:
        raise HTTPException(404)
    au.log("user", "UPDATE", agent_id, str(list(patch.keys())))
    return a

@app.delete("/api/agents/{agent_id}")
def delete_agent(agent_id: str):
    ok = ag.delete_agent(agent_id)
    if not ok:
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    au.log("user", "DELETE", agent_id, "에이전트 삭제")
    # 배치됐던 Slack 채널은 그대로 둔다(보관하지 않음 — 사용자 혼동 방지)
    # 업로드한 근거 문서만 정리
    try:
        import shutil
        from . import proposal as pr
        d = pr._agent_dir(agent_id)
        if d.exists():
            shutil.rmtree(d)
    except Exception:
        pass
    return {"ok": True}

@app.get("/api/slack/channels")
def slack_channels():
    """'기존 채널 선택'용 실제 Slack 채널 목록."""
    from . import slack_provision as sp
    return sp.list_channels()


@app.get("/api/slack/status")
def slack_status():
    """Slack 봇 연결 점검(토큰 값 미노출) — 배치 안내가 안 갈 때 원인 확인용."""
    from . import slack_provision as sp, slack_runtime
    return {**sp.diagnose(), "bot_runtime": slack_runtime.STATE,
            "commit": (os.environ.get("RENDER_GIT_COMMIT") or "")[:7]}   # 배포 반영 확인용


@app.post("/api/agents/{agent_id}/deploy")
def deploy(agent_id: str, payload: dict = Body(...)):
    platform = payload.get("platform")
    channel = payload.get("channel", "")
    # 새 채널 만들기 + Slack이면 실제 채널 생성(스코프 필요)
    if platform == "slack" and payload.get("create"):
        from . import slack_provision as sp
        r = sp.create_channel(channel, private=bool(payload.get("private")), topic=payload.get("topic"))
        if not r["ok"]:
            raise HTTPException(400, r.get("message", "Slack 채널 생성 실패"))
        channel = "#" + r["channel_name"]
    elif platform == "slack" and channel:
        # 기존 채널 선택: 채널을 새로 만들지 않으므로 봇 참여+사용자 초대를 보장(라우팅 동작)
        from . import slack_provision as sp
        sp.ensure_channel(channel, topic=payload.get("topic"))
    # D-32 팀 우선 — 같은 채널에 이 에이전트를 멤버로 둔 팀이 이미 배치돼 있으면
    # 개별 배치를 막는다(한 채널에서 두 갈래로 응답하면 안 된다).
    owner = tm.team_of_member_on(agent_id, channel)
    if owner:
        raise HTTPException(409, f"{channel}에는 이미 '{owner['name']}'이 배치돼 있습니다. 한 채널에서는 팀 응답이 우선입니다.")

    a = ag.deploy_agent(agent_id, platform, channel)
    if not a:
        raise HTTPException(404)
    au.log("user", "DEPLOY", agent_id, f"{platform} {channel}")
    # 배치되면 봇이 온보딩 메시지를 채널에 보내 태스크로 유도(최선노력).
    # 보냈는지/못 보냈는지를 notice로 돌려줘 콘솔이 사용자에게 알려 준다.
    notice = {"sent": False, "channel": channel, "reason": "unsupported_platform"}
    if platform == "slack" and channel:
        try:
            from . import slack_provision as sp
            r = sp.notify_channel(channel, _welcome_text(a))
            notice = {"sent": bool(r.get("ok")), "channel": channel,
                      "reason": None if r.get("ok") else r.get("error", "unknown")}
        except Exception:
            notice = {"sent": False, "channel": channel, "reason": "error"}
    return {**a, "notice": notice}

@app.post("/api/agents/{agent_id}/undeploy")
def undeploy(agent_id: str, payload: dict = Body(default={})):
    """배치 해제. archive=True면 Slack 채널도 보관한다(삭제 대신 — 언제든 복구 가능).
    다른 에이전트/팀이 같은 채널을 쓰면 보관하지 않는다."""
    before = (ag.get_agent(agent_id) or {}).get("deployment") or {}
    channel, platform = before.get("channel", ""), before.get("platform")
    a = ag.undeploy_agent(agent_id)
    if not a:
        raise HTTPException(404)
    au.log("user", "UNDEPLOY", agent_id, f"배치 해제 {channel}".strip())
    notice = {"archived": False, "channel": channel, "platform": platform, "reason": None}
    if (payload or {}).get("archive"):
        if platform != "slack" or not channel:
            notice["reason"] = "unsupported_platform"
        elif _channel_in_use(channel):
            notice["reason"] = "channel_in_use"
        else:
            from . import slack_provision as sp
            r = sp.archive_channel(channel)
            notice["archived"] = bool(r.get("ok")) and not r.get("skipped")
            notice["reason"] = None if notice["archived"] else (r.get("error") or "already_archived")
            if notice["archived"]:
                au.log("user", "ARCHIVE", agent_id, f"채널 보관 {channel}")
    return {**a, "notice": notice}

@app.get("/api/agents/{agent_id}/plan")
def get_plan(agent_id: str):
    a = ag.get_agent(agent_id)
    if not a:
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    au.log("user", "READ", agent_id, "실행 계획 조회")
    return ex.get_plan(agent_id, a)

@app.post("/api/agents/{agent_id}/run")
def run(agent_id: str, payload: dict = Body(default={})):
    """직무별 실행. body = 실행 입력(스키마 required_inputs). 필수 누락 시 422 + 누락 필드."""
    a = ag.get_agent(agent_id)
    if not a:
        raise HTTPException(404)
    from . import job_runners as jr
    job = a.get("job")
    inputs = payload.get("inputs", payload) or {}
    template_key = inputs.get("_template_key") if isinstance(inputs, dict) else None
    if job in jr.JOB_RUNNERS:
        missing = jr.validate_inputs(job, inputs, template_key=template_key)
        if missing:
            labels = ", ".join(f"{m['label']}[{m['key']}]" for m in missing)
            raise HTTPException(422, {
                "error": "missing_inputs",
                "missing": missing,
                "message": f"필수 입력이 누락되었습니다: {labels}",
            })
    result = ex.run_and_stage(agent_id, a, inputs)
    au.log("agent", "STAGE", agent_id, f"실행·스테이징({job or '-'})")
    return result

@app.post("/api/staging/{stage_id}/commit")
def commit(stage_id: str, payload: dict = Body(default={})):
    dry_run = bool(payload.get("dry_run", True))   # 기본 미리보기 — 실반영은 dry_run:false 명시
    result = ex.commit(stage_id, dry_run=dry_run, actor="user")
    if not result:
        raise HTTPException(404, "스테이징 결과를 찾을 수 없습니다.")
    if result.get("error") == "blocked":            # 규칙 위반 — 확정/외부 실행 차단
        raise HTTPException(409, result)
    ear = result.get("external_action_result")
    detail = "확정"
    if ear is not None:
        mode = "dry_run" if dry_run else "live"
        outcome = f"ok:{ear.get('id')}" if ear.get("ok") else f"fail:{ear.get('error')}"
        detail = f"확정+외부반영({ear.get('target')}/{mode}/{outcome})"
    au.log("user", "COMMIT", stage_id, detail)
    return result

@app.post("/api/staging/{stage_id}/execute")
def execute_action(stage_id: str, payload: dict = Body(default={})):
    """⑦ 외부 액션 단독 실행(재실행/실반영). 승인 전에는 409로 차단."""
    dry_run = bool(payload.get("dry_run", False))
    result = ex.execute_external_action(stage_id, dry_run=dry_run, actor="user")
    if result.get("error") == "not_found":
        raise HTTPException(404, "스테이징 결과를 찾을 수 없습니다.")
    if result.get("error") in ("not_approved", "blocked", "already_reflected"):
        raise HTTPException(409, result)            # 승인 전·중복 외부 실행 차단
    mode = "dry_run" if dry_run else "live"
    outcome = f"ok:{result.get('id')}" if result.get("ok") else f"fail:{result.get('error')}"
    au.log("user", "EXTERNAL_ACTION", stage_id,
           f"{result.get('target')}/{mode}/{outcome}/req:{result.get('request_hash')}"
           f"/보낸값:{ex.payload_digest(result.get('payload') or result.get('sent'))}")
    return result

@app.post("/api/staging/{stage_id}/undo")
def undo(stage_id: str, payload: dict = Body(default={})):
    actor = payload.get("actor", "user")
    result = ex.undo(stage_id, actor=actor)
    if not result:
        raise HTTPException(404, "스테이징 결과를 찾을 수 없습니다.")
    if result.get("error") == "rollback_expired":
        raise HTTPException(409, result)     # 기간 외
    if result.get("error") == "not_approver":
        raise HTTPException(403, result)     # 비승인자
    au.log("user", "UNDO", stage_id, "되돌리기")
    return result

@app.get("/api/usage")
def usage(days: int = 30):
    """모델 사용량 — MODEL_CALL 감사 기록에서 집계. 화면이 붙기 전에도 확인 가능."""
    return au.usage_summary(days)

@app.get("/api/agents/{agent_id}/activity")
def agent_activity(agent_id: str, limit: int = 50):
    """이 에이전트가 실제로 한 일 — 감사 기록 기반. 대화 안 했으면 생성·배치만,
    실행하면 모델 호출·외부 전송·승인이 쌓인다."""
    return {"items": au.agent_activity(agent_id, limit)}


@app.get("/api/audit")
def audit_log(limit: int = 50):
    return au.list_audit(limit)

@app.get("/api/admin/retention/preview")
def retention_preview():
    """정리 미리보기(dry-run) — 삭제 전 건수 리포트. 파일 변경 없음."""
    from . import retention as rt
    return rt.sweep(apply=False)

@app.post("/api/admin/retention/sweep")
def retention_sweep(payload: dict = Body(default={})):
    """정리 실행. body {dry_run:true}면 미적용 리포트만. 감사로그는 분리 보존."""
    from . import retention as rt
    dry_run = bool(payload.get("dry_run", False))
    rep = rt.sweep(apply=not dry_run)
    if not dry_run:
        au.log("system", "RETENTION_SWEEP", "staging",
               f"archived={rep['archived']} deleted={rep['deleted']} kept={rep['kept']}")
    return rep

# ── 제안서 초안(영업 첫 슬라이스) ──────────────────────────────────

@app.get("/api/sales/kb")
def sales_kb():
    """샘플(기본 제공) 근거 문서 목록."""
    from . import proposal as pr
    return pr.kb_docs()

@app.get("/api/agents/{agent_id}/kb")
def agent_kb(agent_id: str):
    """이 에이전트에 연결된 근거 문서(샘플 + 업로드)."""
    from . import proposal as pr
    return pr.kb_docs(agent_id)

@app.post("/api/agents/{agent_id}/kb")
def add_agent_kb(agent_id: str, payload: dict = Body(...)):
    """문서 업로드(텍스트). body: {filename, text}."""
    if not ag.get_agent(agent_id):
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    from . import proposal as pr
    r = pr.add_agent_doc(agent_id, payload.get("filename", "문서"), payload.get("text", ""))
    if not r.get("ok"):
        raise HTTPException(400, r.get("message", "업로드 실패"))
    au.log("user", "KB_ADD", agent_id, f"근거 문서 연결: {r.get('label')}")
    return r

@app.delete("/api/agents/{agent_id}/kb-file")
def delete_agent_kb_file(agent_id: str, filename: str):
    """파일명(경로 라벨)으로 연결된 소스 해제. 소스로 안 올라온 파일이면 조용히 무시."""
    from . import proposal as pr
    pr.remove_agent_doc_by_filename(agent_id, filename)
    au.log("user", "KB_REMOVE", agent_id, f"소스 해제: {filename}")
    return {"ok": True}

@app.delete("/api/agents/{agent_id}/kb/{doc_id:path}")
def delete_agent_kb(agent_id: str, doc_id: str):
    """업로드 문서 연결 해제(샘플은 불가)."""
    from . import proposal as pr
    ok = pr.remove_agent_doc(agent_id, doc_id)
    if not ok:
        raise HTTPException(400, "삭제할 수 없는 문서입니다(샘플은 해제 불가).")
    au.log("user", "KB_REMOVE", agent_id, f"근거 문서 해제: {doc_id}")
    return {"ok": True}

@app.post("/api/agents/{agent_id}/propose")
def propose(agent_id: str, payload: dict = Body(...)):
    """요청 → 근거 초안 + PDF 생성 → 승인 대기 스테이징.
    (기본 사용은 메신저. 이 엔드포인트는 콘솔·테스트용.)"""
    a = ag.get_agent(agent_id)
    if not a:
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    from . import proposal_task as pt
    if not pt.has_sources(agent_id):
        raise HTTPException(400, "연결된 소스가 없습니다. 근거 문서를 먼저 연결하세요.")
    customer = (payload.get("customer") or "").strip()
    request = (payload.get("request") or "").strip()
    recipient = (payload.get("recipient") or "").strip()
    record = pt.create(a, customer, request, recipient=recipient)
    engine = "LLM" if record.get("used_llm") else "템플릿(폴백)"
    au.log("agent", "PROPOSE", agent_id, f"제안서 작성({engine})·PDF · {customer or '고객사'}")
    return record

@app.post("/api/proposals/{stage_id}/approve")
def approve_proposal(stage_id: str):
    """제안서 승인 → 이메일 발송(PDF 첨부). 반환: 발송 결과 + 레코드."""
    from . import proposal_task as pt
    rec = ex.get_staging(stage_id)
    if not rec or rec.get("kind") != "proposal":
        raise HTTPException(404, "제안서를 찾을 수 없습니다.")
    send_result = pt.send(stage_id)
    updated = ex.get_staging(stage_id)
    ok = send_result.get("ok")
    au.log("user", "PROPOSE_SEND", rec.get("agent_id", ""),
           f"제안서 승인·{'발송' if ok else '발송대기'} · {rec.get('customer') or '고객사'} → {rec.get('recipient') or '미지정'}")
    # 배치 채널 통보(최선노력)
    a = ag.get_agent(rec.get("agent_id", ""))
    dep = (a or {}).get("deployment") or {}
    if dep.get("platform") == "slack" and dep.get("channel"):
        try:
            from . import slack_provision as sp
            msg = (f":white_check_mark: *{rec.get('customer') or '고객사'} 제안서* 발송 완료 → {rec.get('recipient')}"
                   if ok else f":hourglass: *{rec.get('customer') or '고객사'} 제안서* 승인됨 — {send_result.get('message','발송 대기')}")
            sp.notify_channel(dep["channel"], msg)
        except Exception:
            pass
    return {"send": send_result, "record": updated}

@app.get("/api/proposals/{stage_id}/pdf")
def proposal_pdf(stage_id: str):
    """생성된 제안서 PDF 다운로드(콘솔 미리보기용)."""
    from fastapi.responses import FileResponse
    rec = ex.get_staging(stage_id)
    path = (rec or {}).get("pdf_path", "")
    if not path or not os.path.exists(path):
        raise HTTPException(404, "PDF를 찾을 수 없습니다.")
    fname = f"{(rec.get('customer') or '고객사')}_Byr_제안서.pdf"
    return FileResponse(path, media_type="application/pdf", filename=fname)

@app.get("/api/agents/{agent_id}/proposals")
def list_proposals(agent_id: str):
    """이 에이전트의 제안서 이력(최신순)."""
    return [s for s in ex.list_staging(agent_id) if s.get("kind") == "proposal"]

@app.get("/api/mail/status")
def mail_status():
    """이메일 자격증명 연결 여부(발송 실제 가능 여부)."""
    from . import mailer
    return {"connected": mailer.creds_present()}

# ── 이메일 커넥터(인앱 연결) ───────────────────────────────────────

@app.get("/api/connectors/email/providers")
def email_providers():
    """지원하는 메일 provider 목록(Gmail·Outlook·네이버·다음·기타)."""
    from . import mailer
    return mailer.providers_public()

# ── Google OAuth(Gmail) 실제 로그인 플로우 ─────────────────────────

@app.get("/api/oauth/google/start")
def oauth_google_start():
    """Google 로그인·동의 페이지로 리디렉트(팝업이 이 URL을 연다)."""
    from fastapi.responses import RedirectResponse, HTMLResponse
    from . import google_oauth
    url = google_oauth.authorize_url(state="byr")
    if not url:
        return HTMLResponse("<p>Google OAuth 클라이언트가 설정되지 않았습니다(.env의 GOOGLE_OAUTH_CLIENT_ID/SECRET).</p>", status_code=400)
    return RedirectResponse(url)

@app.get("/api/oauth/google/callback")
def oauth_google_callback(code: str = "", error: str = ""):
    """Google 콜백 → 토큰 교환·저장 → 팝업 자동 종료."""
    from fastapi.responses import HTMLResponse
    from . import google_oauth, mailer

    def _close(msg: str, ok: bool):
        color = "#137333" if ok else "#c0392b"
        return HTMLResponse(
            f"<html><body style='font-family:sans-serif;text-align:center;padding:40px'>"
            f"<p style='color:{color};font-size:15px'>{msg}</p>"
            f"<p style='color:#888;font-size:13px'>이 창은 자동으로 닫힙니다.</p>"
            f"<script>try{{window.close()}}catch(e){{}} setTimeout(function(){{window.close()}},1200)</script>"
            f"</body></html>"
        )
    if error or not code:
        return _close(f"연결 취소/실패: {error or 'no code'}", False)
    r = google_oauth.exchange_code(code)
    if not r.get("ok"):
        return _close(r.get("message", "토큰 교환 실패"), False)
    saved = mailer.connect_oauth("gmail", r["email"], r.get("refresh_token"))
    if not saved.get("ok"):
        return _close(saved.get("message", "저장 실패 — 재동의가 필요할 수 있어요"), False)
    au.log("user", "CONNECT", "email", f"이메일 연결(Google OAuth): {r['email']}")
    return _close(f"{r['email']} 연결 완료 — Gmail로 발송할 수 있어요.", True)

@app.get("/api/connectors/email")
def get_email_connector():
    """연결 상태 + 주소·provider(비밀번호는 반환하지 않음)."""
    from . import mailer
    return {"connected": mailer.creds_present(), "address": mailer.connected_address(),
            "provider": mailer.connected_provider()}

@app.post("/api/connectors/email")
def connect_email(payload: dict = Body(...)):
    """콘솔에서 이메일 연결 — SMTP 로그인 검증 후 로컬 저장(.env 아님).
    body: {provider, address, password, host?, port?, secure?}."""
    from . import mailer
    r = mailer.connect_email(payload)
    if not r.get("ok"):
        raise HTTPException(400, r.get("message", "연결 실패"))
    au.log("user", "CONNECT", "email", f"이메일 연결({r.get('provider')}): {r.get('address')}")
    return {"connected": True, "address": r.get("address"), "provider": r.get("provider")}

@app.delete("/api/connectors/email")
def disconnect_email():
    from . import mailer
    mailer.disconnect_email()
    au.log("user", "DISCONNECT", "email", "이메일 연결 해제")
    return {"connected": False}

# ── 팀 에이전트 ────────────────────────────────────────────────────

@app.get("/api/teams")
def list_teams():
    return tm.list_teams()

@app.get("/api/teams/{team_id}")
def get_team(team_id: str):
    t = tm.get_team(team_id)
    if not t:
        raise HTTPException(404, "팀을 찾을 수 없습니다.")
    return t

@app.post("/api/teams")
def create_team(payload: dict = Body(...)):
    t = tm.create_team(
        payload.get("name", ""),
        payload.get("purpose", ""),
        payload.get("agents", []),
        payload.get("icon"),
    )
    au.log("user", "TEAM_CREATE", t["id"], f"팀 생성: {t['name']}")
    return t

@app.put("/api/teams/{team_id}")
def update_team(team_id: str, patch: dict = Body(...)):
    t = tm.update_team(team_id, patch)
    if not t:
        raise HTTPException(404)
    au.log("user", "TEAM_UPDATE", team_id, str(list(patch.keys())))
    return t

@app.delete("/api/teams/{team_id}")
def delete_team(team_id: str):
    ok = tm.delete_team(team_id)
    if not ok:
        raise HTTPException(404, "팀을 찾을 수 없습니다.")
    au.log("user", "TEAM_DELETE", team_id, "팀 삭제")
    # 배치됐던 Slack 채널은 그대로 둔다(보관하지 않음)
    return {"ok": True}

@app.get("/api/teams/{team_id}/members/{agent_id}/usage")
def member_usage(team_id: str, agent_id: str):
    """제거 전 확인용 — 이 멤버가 협업 흐름의 어느 단계에 쓰이는지."""
    return {"used_in": tm.member_flow_usage(team_id, agent_id)}


@app.post("/api/teams/{team_id}/members")
def add_team_member(team_id: str, payload: dict = Body(...)):
    agent_id = payload.get("agent_id", "")
    if not ag.get_agent(agent_id):
        raise HTTPException(404, "에이전트를 찾을 수 없습니다.")
    t, how = tm.add_member(team_id, agent_id)
    if not t:
        raise HTTPException(404, "팀을 찾을 수 없습니다.")
    if how == "added":
        au.log("user", "TEAM_MEMBER_ADD", team_id, agent_id)
    return t


@app.delete("/api/teams/{team_id}/members/{agent_id}")
def remove_team_member(team_id: str, agent_id: str):
    t, how = tm.remove_member(team_id, agent_id)
    if not t:
        raise HTTPException(404, "팀 또는 멤버를 찾을 수 없습니다." )
    au.log("user", "TEAM_MEMBER_REMOVE", team_id, f"{agent_id}/{how}")
    return t


@app.post("/api/teams/{team_id}/flows")
def create_flow(team_id: str, payload: dict = Body(...)):
    t, flow = tm.create_flow(
        team_id,
        payload.get("name", ""),
        payload.get("description", ""),
        payload.get("trigger", {"type": "messenger", "config": ""}),
        payload.get("steps", []),
    )
    if not t:
        raise HTTPException(404, "팀을 찾을 수 없습니다.")
    au.log("user", "FLOW_CREATE", team_id, f"협업 흐름 생성: {flow['name']}")
    return t

@app.put("/api/teams/{team_id}/flows/{flow_id}")
def update_flow(team_id: str, flow_id: str, payload: dict = Body(...)):
    t, flow = tm.update_flow(
        team_id,
        flow_id,
        payload.get("name", ""),
        payload.get("description", ""),
        payload.get("trigger", {"type": "messenger", "config": ""}),
        payload.get("steps", []),
    )
    if not t:
        raise HTTPException(404, "협업 흐름을 찾을 수 없습니다.")
    au.log("user", "FLOW_UPDATE", team_id, f"협업 흐름 편집: {flow['name']}")
    return t

@app.post("/api/teams/{team_id}/deploy")
def deploy_team(team_id: str, payload: dict = Body(...)):
    platform = payload.get("platform")
    channel = payload.get("channel", "")
    if platform == "slack" and payload.get("create"):
        from . import slack_provision as sp
        r = sp.create_channel(channel, private=bool(payload.get("private")), topic=payload.get("topic"))
        if not r["ok"]:
            raise HTTPException(400, r.get("message", "Slack 채널 생성 실패"))
        channel = "#" + r["channel_name"]
    elif platform == "slack" and channel:
        from . import slack_provision as sp
        sp.ensure_channel(channel, topic=payload.get("topic"))
    # D-32 팀 우선 — 같은 채널에 개별 배치된 멤버가 있으면 조용히 해제한다.
    # 화면에 알리지 않는 이유: 그 채널은 팀이 대신 받으므로 사용자 체감 변화가 없다.
    # 다만 시스템이 사용자 설정을 바꾼 것이므로 감사에는 actor="system"으로 남긴다.
    auto_released = []
    for member_id in (tm.get_team(team_id) or {}).get("agents", []):
        m = ag.get_agent(member_id)
        dep = (m or {}).get("deployment") or {}
        if dep.get("status") == "배치됨" and dep.get("channel") == channel:
            ag.undeploy_agent(member_id)
            au.log("system", "AUTO_UNDEPLOY", member_id,
                   f"{channel} 팀 배치로 개별 배치 해제 (team={team_id})")
            auto_released.append(member_id)

    t = tm.deploy_team_channel(team_id, platform, channel)
    if not t:
        raise HTTPException(404)
    au.log("user", "TEAM_DEPLOY", team_id, f"{platform} {channel}")
    # 배치되면 팀 온보딩 메시지를 채널에 보낸다(개별 에이전트 배치와 동일).
    if platform == "slack" and channel:
        try:
            from . import slack_provision as sp, team_conversation as tc
            team_ctx = {"id": t.get("id"), "name": t.get("name", "팀에이전트"),
                        "purpose": t.get("purpose", ""),
                        "flows": [f.get("name") for f in (t.get("flows") or [])]}
            sp.notify_channel(channel, tc.onboarding_message(team_ctx)
                              + "\n\n어떤 작업이 필요한지 한 문장으로 알려주세요.")
        except Exception:
            pass
    return t

@app.post("/api/teams/{team_id}/undeploy")
def undeploy_team(team_id: str, payload: dict = Body(...)):
    t = tm.undeploy_team_channel(team_id, payload.get("channel", ""))
    if not t:
        raise HTTPException(404)
    au.log("user", "TEAM_UNDEPLOY", team_id, f"{payload.get('channel','')}")
    return t
