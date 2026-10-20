"""팀에이전트 엔진 설정값 (Phase 2에서 상수 분리).

대표 승인 필요 항목(team-agent-messenger-conversation-design-v1.md §11)을 코드 상수로 노출.
운영 중 조정 가능하도록 한 곳에 모은다.
"""

# 승인 동의어 사전(E) — 대표 확인 범위
APPROVAL_WORDS = {"승인", "확정", "확인", "오케이", "ok", "approve", "진행해", "진행"}

# 세션 TTL(C) — 기본 24시간
SESSION_TTL_SEC = 24 * 60 * 60

# 지연 알림 임계(D) — awaiting_approval/dispatching이 이 시간 넘게 정체되면 리마인드
REMINDER_SEC = 60 * 60          # 1시간

# live 전 dry_run 강제(D) — 최초 live 실행 전에 dry_run 1회 성공 필요
REQUIRE_DRY_RUN_BEFORE_LIVE = True

# 에스컬레이션(D) — blocked 연속 N회면 대표 확인 요청
ESCALATE_BLOCKED_COUNT = 2

# 다중 에이전트 채널 우선순위(E) — 먼저 매칭되는 종류가 응답 주체
CHANNEL_PRIORITY = ("team", "agent")


def merge_routes_by_priority(by_kind, priority=None):
    """종류별 라우트({kind: {channel: info}})를 우선순위대로 병합.

    같은 채널이 여러 종류에 있으면 priority 앞 순서가 이긴다(먼저 등록된 것 유지).
    slack_bot._load_routes와 테스트가 공유하는 단일 규칙(정책값 기반).
    """
    order = [k for k in (priority or CHANNEL_PRIORITY) if k in by_kind]
    for k in by_kind:                 # 설정에 없는 종류는 뒤에 붙임
        if k not in order:
            order.append(k)
    routes = {}
    for kind in order:
        for channel, info in by_kind.get(kind, {}).items():
            routes.setdefault(channel, info)
    return routes
