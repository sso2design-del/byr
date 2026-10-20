"""스테이징 레코드 보존·정리 정책 (soft-delete → hard-delete 2단계).

정책
  - staged(승인 대기): 무기한 보존 — 실제 업무 대기건이므로 자동 삭제 안 함.
  - committed/reflected/sent/approved(완료): archive_after=30일 → delete_after=60일.
  - undone(되돌림): archive 14일 → delete 30일.
  - blocked(규칙 위반): archive 7일 → delete 14일(디버깅 보존).
  - 감사로그(audit.jsonl)는 이 정리와 분리 — staging을 지워도 추적 이력은 남는다.

2단계
  1) soft-delete: 활성 staging.json → staging_archive.json 이동(archived_at 기록, 복구 가능).
  2) hard-delete: archive에서도 delete_after 경과 시 영구 삭제.

실행: 매일 1회. 삭제 전 항상 건수 리포트. 기본 dry_run(미적용) — apply 시에만 파일 변경.
"""
import json
import os
from datetime import datetime, timedelta

_DIR = os.path.dirname(__file__)
STAGING_FILE = os.path.join(_DIR, "../data/staging.json")
ARCHIVE_FILE = os.path.join(_DIR, "../data/staging_archive.json")

# 상태별 보존(일). None = 무기한. {archive, delete} = soft→hard 임계.
RETENTION = {
    "staged":    None,
    "committed": {"archive": 30, "delete": 60},
    "reflected": {"archive": 30, "delete": 60},
    "sent":      {"archive": 30, "delete": 60},
    "approved":  {"archive": 30, "delete": 60},
    "undone":    {"archive": 14, "delete": 30},
    "blocked":   {"archive": 7,  "delete": 14},
}

# 레코드 나이 계산 기준 타임스탬프(우선순위)
_TS_FIELDS = ("reflected_at", "sent_at", "committed_at", "approved_at",
              "undone_at", "created_at")


def _load(path: str) -> list:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save(path: str, data: list):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _event_ts(rec: dict) -> datetime | None:
    for k in _TS_FIELDS:
        v = rec.get(k)
        if v:
            try:
                return datetime.fromisoformat(v)
            except ValueError:
                continue
    return None


def _decide(rec: dict, now: datetime) -> str:
    """레코드 처분 결정: 'keep' | 'archive' | 'delete'."""
    status = rec.get("status", "")
    policy = RETENTION.get(status, "keep_unknown")
    if policy is None:            # staged 등 무기한
        return "keep"
    if policy == "keep_unknown":  # 정책 미정 상태 → 안전측 보존
        return "keep"
    ts = _event_ts(rec)
    if ts is None:                # 타임스탬프 없음 → 판단 보류(보존)
        return "keep"
    age_days = (now - ts).total_seconds() / 86400
    if age_days >= policy["delete"]:
        return "delete"
    if age_days >= policy["archive"]:
        return "archive"
    return "keep"


def sweep(now: datetime | None = None, apply: bool = False) -> dict:
    """정리 1회 실행. apply=False면 리포트만(파일 미변경). 반환: 건수 리포트."""
    now = now or datetime.now()
    active = _load(STAGING_FILE)
    archived = _load(ARCHIVE_FILE)

    keep_active, to_archive = [], []
    report = {
        "ts": now.isoformat(), "apply": apply,
        "scanned": len(active) + len(archived),
        "active_in": len(active), "archive_in": len(archived),
        "archived": 0, "deleted": 0, "kept": 0,
        "by_status": {},
    }

    def bump(status, action):
        d = report["by_status"].setdefault(status, {"keep": 0, "archive": 0, "delete": 0})
        d[action] += 1

    # 1) 활성 레코드: keep / archive / delete
    for rec in active:
        action = _decide(rec, now)
        bump(rec.get("status", "?"), action)
        if action == "keep":
            keep_active.append(rec); report["kept"] += 1
        elif action == "archive":
            rec = {**rec, "archived_at": now.isoformat()}
            to_archive.append(rec); report["archived"] += 1
        else:  # delete (활성에서 바로 삭제 임계 초과)
            report["deleted"] += 1

    # 2) 기존 아카이브 레코드: delete 임계면 영구 삭제, 아니면 유지
    keep_archive = []
    for rec in archived:
        action = _decide(rec, now)
        if action == "delete":
            bump(rec.get("status", "?"), "delete"); report["deleted"] += 1
        else:
            keep_archive.append(rec)  # keep/archive 모두 아카이브에 잔류

    new_archive = keep_archive + to_archive
    report["active_out"] = len(keep_active)
    report["archive_out"] = len(new_archive)

    if apply:
        _save(STAGING_FILE, keep_active)
        _save(ARCHIVE_FILE, new_archive)
    return report


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="스테이징 보존 정리(2단계).")
    p.add_argument("--apply", action="store_true", help="실제 적용(미지정 시 dry-run 리포트만)")
    args = p.parse_args()
    rep = sweep(apply=args.apply)
    mode = "APPLIED" if args.apply else "DRY-RUN(미적용)"
    print(f"[retention {mode}] scanned={rep['scanned']} "
          f"→ kept={rep['kept']} archived={rep['archived']} deleted={rep['deleted']}")
    print(f"  active {rep['active_in']}→{rep['active_out']} · archive {rep['archive_in']}→{rep['archive_out']}")
    for st, c in rep["by_status"].items():
        print(f"  {st}: keep={c['keep']} archive={c['archive']} delete={c['delete']}")
