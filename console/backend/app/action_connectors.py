"""외부 액션 커넥터 (스텁) — 승인된 산출물을 외부 시스템에 반영.

8블록 스키마의 ⑦External Action 실행 계층. 실제 커넥터(ERP·구글시트·Jira)는 조직별
설정·자격증명이 필요하므로, post_channel(Slack)만 실연동을 시도하고 나머지는 결정론적 스텁이다.

인터페이스 고정(공통 반환 계약):
  {ok, target, dry_run, mode, id?, message, error?(표준코드), items?, partial_success?, rolled_back?}
  - dry_run=True   : 외부 쓰기 없이 검증·프리뷰만. ok면 id=None.
  - dry_run=False  : 반영 후 결정론적 ref id 발급.
  - mode           : "stub"(현재) — 실 커넥터 배선 시 "live-real"로 전환.
  - error          : 표준 에러코드(아래 ERR_*). 상세 사유는 message.
  - simulate       : "fail"(권한/커넥터), "timeout", "partial"(create_ticket) — QA·롤백 검증.

인증 분리: 각 커넥터 자격증명은 ENV/Secret로 주입(예: ERP_API_KEY, GOOGLE_SA_JSON, JIRA_TOKEN).
운영 차단: BYR_CONNECTORS_LIVE 플래그가 켜지면 실 커넥터 경로를 요구 → 미배선이면 not_configured로 차단
(샌드박스 선연결 후 운영 활성화). 기본(플래그 off)은 안전한 스텁 반영.
"""
import os
import uuid

# ── 표준 에러코드 (input/output/error 인터페이스 고정) ──
ERR_VALIDATION = "validation_error"      # 페이로드 검증 실패
ERR_PERMISSION = "permission_denied"     # 권한 부족
ERR_TIMEOUT = "timeout"                  # 요청 시간 초과
ERR_CONNECTOR = "connector_error"        # 외부 시스템 오류(쓰기 실패 등)
ERR_NOT_CONFIGURED = "not_configured"    # 실 커넥터 미배선/자격증명 없음
ERR_UNKNOWN = "unknown"                  # 미분류 예외


def live_enabled() -> bool:
    """운영 실 커넥터 활성 플래그. 기본 off(스텁). 켜졌는데 미배선이면 호출측이 차단."""
    if "BYR_CONNECTORS_LIVE" not in os.environ:
        from . import sheets_client as sc  # ~/.hermes/.env 로더 재사용
        sc._load_hermes_env()
    return os.getenv("BYR_CONNECTORS_LIVE", "").lower() in ("1", "true", "on")


def _ref(prefix: str, ref: str) -> str:
    tail = (ref or uuid.uuid4().hex)[-6:]
    return f"{prefix}-{tail}"


def _err(target: str, dry_run: bool, code: str, msg: str, **extra) -> dict:
    return {"ok": False, "target": target, "dry_run": dry_run, "mode": "stub",
            "error": code, "message": msg, **extra}


def update_erp(payload: dict, dry_run: bool, ref: str, simulate: str = "ok") -> dict:
    T = "update_erp"
    entries = payload.get("entries")
    adjustments = payload.get("adjustments", 0)
    if not entries and entries != 0:
        return _err(T, dry_run, ERR_VALIDATION, "entries가 비어 ERP 반영 불가")
    if simulate == "timeout":
        return _err(T, dry_run, ERR_TIMEOUT, "ERP 응답 시간 초과 — 반영 없음", rolled_back=True)
    if simulate == "fail":
        return _err(T, dry_run, ERR_CONNECTOR, "ERP 반영 실패 — 원자적 롤백(부분 반영 없음)", rolled_back=True)
    if dry_run:
        return {"ok": True, "id": None, "target": T, "dry_run": True, "mode": "stub",
                "message": f"[DRY-RUN] ERP 반영 예정: 전표 {entries}건 · 조정 {adjustments}건"}
    doc = _ref("ERP", ref)
    return {"ok": True, "id": doc, "target": T, "dry_run": False, "mode": "stub",
            "message": f"ERP 반영 완료: 전표 {entries}건 · 조정 {adjustments}건 (전표번호 {doc})"}


def update_sheet(payload: dict, dry_run: bool, ref: str, simulate: str = "ok") -> dict:
    T = "update_sheet"
    rows = payload.get("shortlist_rows")
    if rows is None:
        rows = payload.get("entries")
    n = len(rows) if isinstance(rows, list) else int(rows or 0)
    if not n:
        return _err(T, dry_run, ERR_VALIDATION, "발행할 행이 없습니다.")
    if simulate == "timeout":
        return _err(T, dry_run, ERR_TIMEOUT, "시트 응답 시간 초과 — 반영 없음", rolled_back=True)
    if simulate == "fail":
        return _err(T, dry_run, ERR_CONNECTOR, "시트 반영 실패 — 원자적 롤백(부분 반영 없음)", rolled_back=True)
    if dry_run:
        return {"ok": True, "id": None, "target": T, "dry_run": True, "mode": "stub",
                "message": f"[DRY-RUN] 공유 시트 반영 예정: {n}행"}

    # 실 커넥터: 운영 플래그 ON + 시트 설정 완료 시 실제 구글 시트에 append
    from . import sheets_client as sc
    if live_enabled() and sc.configured():
        from datetime import datetime
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = payload.get("review_request_message", "")
        out_rows = []
        if isinstance(rows, list):  # HR 숏리스트 등: dict 행 → 셀 배열
            for row in rows:
                if isinstance(row, dict):
                    out_rows.append([ts, msg, str(row.get("name", "")),
                                     str(row.get("score", "")), str(row.get("decision", ""))])
                else:
                    out_rows.append([ts, msg, str(row)])
        else:
            out_rows.append([ts, msg, f"{n}행"])
        try:
            r = sc.append_rows(out_rows)
            return {"ok": True, "id": r["updated_range"], "target": T, "dry_run": False,
                    "mode": "live-real",
                    "message": f"'{r['title']}' 시트 반영 완료: {len(out_rows)}행 ({r['updated_range']})"}
        except Exception as e:  # noqa: BLE001
            m = str(e)
            if "PERMISSION_DENIED" in m or "caller does not have permission" in m:
                return _err(T, dry_run, ERR_PERMISSION,
                            "시트 접근 권한 없음 — 서비스계정을 편집자로 공유했는지 확인", rolled_back=True)
            if "has not been used" in m or "SERVICE_DISABLED" in m:
                return _err(T, dry_run, ERR_NOT_CONFIGURED, "Google Sheets API 미활성", rolled_back=True)
            if "not found" in m.lower() or "Requested entity was not found" in m:
                return _err(T, dry_run, ERR_VALIDATION, "시트 ID를 찾을 수 없음", rolled_back=True)
            return _err(T, dry_run, ERR_CONNECTOR, f"시트 반영 실패: {m[:120]}", rolled_back=True)

    sid = _ref("SHEET", ref)  # 스텁(플래그 off 또는 미설정)
    return {"ok": True, "id": sid, "target": T, "dry_run": False, "mode": "stub",
            "message": f"공유 시트 반영 완료(스텁): {n}행 (범위 {sid})"}


def post_channel(payload: dict, dry_run: bool, ref: str, simulate: str = "ok") -> dict:
    T = "post_channel"
    channel = payload.get("channel")
    msg = payload.get("review_request_message") or payload.get("release_note_draft") or "검토 요청"
    if simulate == "timeout":
        return _err(T, dry_run, ERR_TIMEOUT, "채널 응답 시간 초과")
    if simulate == "fail":
        return _err(T, dry_run, ERR_CONNECTOR, "채널 발행 실패")
    if dry_run:
        return {"ok": True, "id": None, "target": T, "dry_run": True, "mode": "stub",
                "message": f"[DRY-RUN] 채널 발행 예정: {msg[:40]}"}
    if channel:  # 채널 지정 시 실제 Slack 발행 시도(최선노력)
        try:
            from . import slack_provision as sp
            r = sp.notify_channel(channel, msg)
            if r.get("ok"):
                return {"ok": True, "id": r.get("channel_id"), "target": T, "dry_run": False,
                        "mode": "live-real", "message": f"채널 발행 완료: #{channel}"}
            return _err(T, dry_run, ERR_CONNECTOR, f"채널 발행 실패: {r.get('error')}")
        except Exception as e:  # noqa: BLE001
            return _err(T, dry_run, ERR_UNKNOWN, str(e))
    pid = _ref("MSG", ref)  # 채널 미지정 → 스텁
    return {"ok": True, "id": pid, "target": T, "dry_run": False, "mode": "stub",
            "message": f"채널 발행 완료(스텁): {msg[:40]} (id {pid})"}


def create_ticket(payload: dict, dry_run: bool, ref: str, simulate: str = "ok") -> dict:
    T = "create_ticket"
    summaries = payload.get("ticket_summaries") or []
    if not summaries:
        return _err(T, dry_run, ERR_VALIDATION, "생성할 티켓이 없습니다.")
    if simulate == "timeout":
        return _err(T, dry_run, ERR_TIMEOUT, "Jira 응답 시간 초과 — 생성 없음", rolled_back=True)
    if simulate == "fail":  # 권한부족 — 전체 실패(원자적 롤백)
        return _err(T, dry_run, ERR_PERMISSION, "티켓 생성 권한 부족 — 전체 실패(롤백)", rolled_back=True)
    if dry_run:
        return {"ok": True, "id": None, "target": T, "dry_run": True, "mode": "stub",
                "items": [{"summary": t.get("summary"), "status": "preview"} for t in summaries],
                "message": f"[DRY-RUN] 티켓 {len(summaries)}건 생성 예정"}

    # 실 커넥터: 운영 플래그 ON + Jira 설정 완료 시 실제 티켓 생성(부분 실패 시 성공분 유지)
    from . import jira_client as jc
    if live_enabled() and jc.configured():
        items = []
        for t in summaries:
            r = jc.create_issue(t.get("summary") or t.get("key") or "무제")
            if r.get("ok"):
                items.append({"summary": t.get("summary"), "status": "created",
                              "id": r["key"], "url": r["url"]})
            else:
                items.append({"summary": t.get("summary"), "status": "failed",
                              "error": r.get("error"), "message": r.get("message")})
        created = [x for x in items if x["status"] == "created"]
        partial = any(x["status"] == "failed" for x in items)
        return {"ok": len(created) > 0, "target": T, "dry_run": False, "mode": "live-real",
                "id": created[0]["id"] if created else None,
                "external_ids": [x["id"] for x in created],
                "url": created[0]["url"] if created else None,
                "items": items, "partial_success": partial,
                "message": f"Jira 티켓 {len(created)}/{len(summaries)}건 생성"
                           + (" (일부 실패 — 성공분 유지)" if partial else "")}

    items = []  # 스텁(플래그 off 또는 미설정)
    fail_at = len(summaries) - 1 if simulate == "partial" else -1  # 부분 실패: 마지막 1건
    for i, t in enumerate(summaries):
        if i == fail_at:
            items.append({"summary": t.get("summary"), "status": "failed", "error": ERR_TIMEOUT})
        else:
            items.append({"summary": t.get("summary"), "status": "created",
                          "id": _ref("PMX", (ref or "") + str(i))})
    created = [x for x in items if x["status"] == "created"]
    partial = any(x["status"] == "failed" for x in items)
    return {"ok": len(created) > 0, "target": T, "dry_run": False, "mode": "stub",
            "id": created[0]["id"] if created else None,
            "external_ids": [x["id"] for x in created],
            "items": items, "partial_success": partial,
            "message": f"티켓 {len(created)}/{len(summaries)}건 생성"
                       + (" (부분 실패 — 성공분 유지)" if partial else "")}


CONNECTORS = {
    "update_erp": update_erp,
    "update_sheet": update_sheet,
    "post_channel": post_channel,
    "create_ticket": create_ticket,
}
