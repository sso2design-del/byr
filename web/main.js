/* design-to-code study — 모션은 실측값 기반.
   히어로: superhuman.com 에서 잰 것 (반딧불이 = 커서 발생형, 상시 아님)
   본문:   sanalabs.com/products/sana/ 에서 잰 것
     탭 자동 순환  7.0초 — 실측 7021 · 7028 · 7063 · 7015 · 7050ms
     이징          easeOut cubic-bezier(.16,1,.3,1) · 버튼 easeInOut cubic-bezier(.83,0,.17,1) 0.2s
     스크롤 연동   없음 (sticky 0개, 배경 전환 없음) · 마퀴 없음 → 모션은 전부 시간축
   scrub.js 가 헤드라인 opacity 0→1 을 여러 스크롤 위치에서 잡았지만 그건 스크롤 연동이 아니다.
   7초마다 탭이 갈리는 동안 스크럽이 돌아서 찍힌 값이다 — 그래서 rAF 로 시간축을 따로 쟀다.

   2026-07-29 — 모션을 CSS @keyframes 에서 Motion(JS)으로 전량 이관했다.
   라이브러리는 vendor/motion.js 에 동봉한다 — 빌드 단계 없이 serve.py 만으로 돈다.
   다만 ES 모듈이라 file:// 로 직접 열면 안 되고 serve.py 로 띄워야 한다. */

import { animate, inView } from './vendor/motion.js';

const EASE = [.22, 1, .36, 1];         // 리빌 (nor.ma 실측)
const FX = [.16, 1, .3, 1];            // 목업 흐름 — sanalabs 실측 easeOut
const TAB_MS = 7000;                   // 탭·목록 자동 순환 — sanalabs 실측 7.0초

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --rvd(리빌 지연)는 상속된다. ms 로 적혀 있고 Motion 은 초를 쓴다. */
const varMs = (el, name) => (parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0) / 1000;

const revealed = new WeakSet();

function reveals() {
  inView('[data-rv]', el => {
    if (revealed.has(el)) return;
    revealed.add(el);
    animate(el,
      { opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'], y: [18, 0] },
      { duration: .7, ease: EASE, delay: varMs(el, '--rvd') });
  }, { amount: .05, margin: '0px 0px -12% 0px' });
}

/* ── 비디오: 화면 안에서만 재생 ──────────────────────── */
function videos() {
  inView('[data-vid]', v => {
    if (v.preload === 'none') v.preload = 'auto';
    v.play().catch(() => {});          // 자동재생이 막히면 포스터로 남는다
    return () => v.pause();
  }, { margin: '200px 0px' });
}

/* ── 히어로 반딧불이(fireflies) — superhuman 실측 ─────────
   마우스를 히어로에서 움직일 때만 커서 근처에 소수의 따뜻한 빛 점이 생겨
   살짝 떠오르며 페이드 인/아웃한다(상시 아님, 커서 발생형). 캔버스. */
function heroFireflies() {
  const hero = document.querySelector('.hero');
  const cv = document.querySelector('.hero__spark');
  if (!hero || !cv) return;
  const ctx = cv.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const S = 48, sprite = document.createElement('canvas'); sprite.width = sprite.height = S;
  { const c = sprite.getContext('2d'); const g = c.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.42, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(S/2, S/2, S/2, 0, 7); c.fill(); }
  const SIZES = [5, 8, 12];               // 흰색 원형 입자 3종 크기
  let W = 0, H = 0;
  function resize() {
    const r = hero.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W*DPR; cv.height = H*DPR; cv.style.width = W+'px'; cv.style.height = H+'px'; ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  const ff = []; let lastSpawn = 0;
  const spawn = (x, y) => {
    const ang = Math.random()*Math.PI*2, rad = Math.random()*58 + 6;
    ff.push({ x: x + Math.cos(ang)*rad, y: y + Math.sin(ang)*rad,
              vx: (Math.random()-.5)*0.10, vy: -(Math.random()*0.14 + 0.03),
              life: 0, max: 1700 + Math.random()*1600,          // 오래 살며 천천히 사라짐
              sz: SIZES[Math.random()*SIZES.length | 0],        // 3종 크기
              a: Math.random()*0.55 + 0.26 });                  // 투명도 다양
  };
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = performance.now();
    if (now - lastSpawn > 100 && ff.length < 22) { lastSpawn = now; spawn(x, y); if (Math.random() < 0.4) spawn(x, y); }
  }, { passive: true });
  let last = performance.now();
  function tick() {
    const now = performance.now(); const dt = Math.min(now - last, 50); last = now;
    ctx.clearRect(0, 0, W, H);
    for (let i = ff.length - 1; i >= 0; i--) {
      const p = ff[i]; p.life += dt;
      if (p.life >= p.max) { ff.splice(i, 1); continue; }
      p.x += p.vx * dt/16; p.y += p.vy * dt/16;
      const k = p.life / p.max;
      const fade = k < 0.16 ? k/0.16 : Math.pow(1 - (k-0.16)/0.84, 1.5);  // 빠른 등장 → 천천히 사라짐
      ctx.globalAlpha = Math.max(0, fade * p.a);
      ctx.drawImage(sprite, p.x - p.sz/2, p.y - p.sz/2, p.sz, p.sz);
    }
    ctx.globalAlpha = 1; requestAnimationFrame(tick);
  }
  resize(); addEventListener('resize', resize, { passive: true }); tick();
}

/* ── 목업 흐름 모션 ──────────────────────────────────────
   탭이 바뀔 때 화면만 갈아치우면 "단계"라는 말이 전달되지 않는다.
   각 탭은 그 단계에서 사용자가 실제로 겪는 순서대로 재생된다:
     ① 타이핑 → 전송 → 봇이 답 쓰는 중(점 3개) → 응답 → 상태 칩
     ② 봇 응답 → 자료 카드 → 건수가 실제로 세어진다
     ③ 결과 카드 → 불일치 항목이 하나씩 잡힌다
     ④ 승인 카드 → 승인 버튼이 눌리고 → 승인 완료 상태로 바뀐다
     ⑤ 이력이 시간순으로 한 줄씩 기록된다
   7초 사이클 안에서 3~4초에 끝난다. 남은 시간은 결과 화면으로 서 있는다 —
   루프로 계속 돌리면 읽는 동안 방해가 된다(모션 절제).

   원칙: 순번 등장은 100ms 내외 스태거 · 이징은 enter/exit 모두 easeOut ·
        상태 변화는 모션만으로 알리지 않고 라벨(승인 완료)·색으로도 남긴다.
   중간에 탭이 바뀌면 진행 중인 것을 전부 취소한다(끊기는 애니메이션). */
function flow(pane) {
  const kill = [];
  /* 시작 상태를 JS 가 직접 세운다. CSS(.fx-on)에만 맡겼더니 봇의 "입력 중" 점이
     타이핑 전부터 떠 있었다 — 순서가 거꾸로 읽힌다. 인라인으로 못 박으면 어긋날 수 없다. */
  for (const el of pane.querySelectorAll('[data-fx], [data-sent], [data-log], [data-dots], [data-caret]'))
    el.style.opacity = '0';
  const at = (ms, fn) => { const t = setTimeout(fn, ms); kill.push({ cancel: () => clearTimeout(t) }); };
  const go = (el, kf, opt = {}) => { if (!el) return; kill.push(animate(el, kf, { ease: FX, ...opt })); };
  const rise = (el, delay, d = .5) => go(el, { opacity: [0, 1], y: [10, 0] }, { duration: d, delay });
  const fx = n => pane.querySelector(`[data-fx="${n}"]`);
  const i = +pane.dataset.i;

  /* 숫자는 세어져야 "모았다"가 보인다. tabular-nums 라 자리수가 흔들리지 않는다. */
  const count = (el, delay) => {
    if (!el) return;
    const to = +el.dataset.count, suf = el.dataset.suffix || '';
    at(delay * 1000, () => {
      const t0 = performance.now(), dur = 520;
      let raf = 0;
      const tick = () => {
        const k = Math.min((performance.now() - t0) / dur, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf;   // easeOut
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      kill.push({ cancel: () => cancelAnimationFrame(raf) });
    });
  };

  if (i === 0) {
    const type = pane.querySelector('[data-type]');
    const caret = pane.querySelector('[data-caret]');
    const ph = pane.querySelector('.ph__ph');
    const sent = pane.querySelector('[data-sent]');
    const dots = pane.querySelector('[data-dots]');
    const send = pane.querySelector('[data-send]');
    const text = type?.dataset.type || '';

    /* 타이핑 — 글자를 하나씩. 커서는 타이핑하는 동안에만 존재한다.
       처음엔 깜빡임을 duration 1.1s × repeat 2 로 걸었는데, 그 애니메이션이
       전송 시점(1.19s)을 넘겨 3.5s 까지 살아 있으면서 인라인 opacity 를 1 로 되돌렸다.
       → 전송할 때 애니메이션을 명시적으로 취소하고 커서를 지운다. */
    const T = 280 + text.length * 52 + 180;          // 타이핑 끝 + 여유 = 전송 시점
    at(280, () => { if (ph) ph.style.opacity = '0'; });
    const blink = caret
      ? animate(caret, { opacity: [0, 1, 1, 0, 0, 1] },
          { duration: T / 1000 - .28, delay: .28, ease: 'linear' })
      : null;
    if (blink) kill.push(blink);
    let n = 0;
    const iv = setInterval(() => {
      if (!type) return;
      type.textContent = text.slice(0, ++n);
      if (n >= text.length) clearInterval(iv);
    }, 52);
    kill.push({ cancel: () => clearInterval(iv) });

    // 전송 — 입력칸이 비고, 보낸 말풍선이 올라온다. 보내기 버튼은 눌린 느낌만 준다
    go(send, { scale: [1, .96, 1] }, { duration: .22, delay: T / 1000 });
    at(T, () => {
      try { blink?.cancel(); } catch (e) {}
      if (type) type.textContent = '';
      if (caret) caret.style.opacity = '0';
      if (ph) ph.style.opacity = '';
    });
    rise(sent, T / 1000, .45);

    // 봇이 답을 쓰는 중 → 응답 → 상태 칩
    const D = T + 420;
    go(dots, { opacity: [0, 1] }, { duration: .3, delay: D / 1000 });
    for (const [k, d] of [...pane.querySelectorAll('.sl__tdot i')].entries())
      go(d, { opacity: [.3, 1, .3], y: [0, -3, 0] },
         { duration: .9, repeat: 2, delay: D / 1000 + k * .12, ease: 'linear' });
    /* 퇴장은 delay 로 미리 예약하면 안 된다. Motion 은 fill:both 로 걸기 때문에
       지연 구간 동안 첫 키프레임(opacity 1)을 거꾸로 채운다 —
       실제로 타이핑하는 동안 봇의 "입력 중" 점이 미리 떠 있었다.
       그래서 퇴장 애니메이션은 그 시점에 도달해서 만든다. (등장은 첫 키프레임이 0이라 무해) */
    const R = D + 1150;
    at(R, () => { if (dots) kill.push(animate(dots, { opacity: [1, 0] }, { duration: .25, ease: FX })); });
    at(R + 260, () => { if (dots) dots.style.display = 'none'; });
    rise(fx(2), (R + 220) / 1000, .5);
    rise(fx(3), (R + 420) / 1000, .4);
    rise(fx(4), (R + 520) / 1000, .4);
  }

  if (i === 1) {
    rise(fx(1), .2); rise(fx(2), .5);
    rise(fx(3), .74); rise(fx(4), .86); rise(fx(5), .98); rise(fx(6), 1.12);
    count(pane.querySelector('[data-count="42"]'), .8);
    count(pane.querySelector('[data-count="3"]'), .92);
  }

  if (i === 2) {
    rise(fx(1), .2); rise(fx(2), .44); rise(fx(3), .6);
    rise(fx(4), .78); rise(fx(5), .9); rise(fx(6), 1.02); rise(fx(7), 1.2);
    rise(fx(8), 1.34);                 // 스레드 링크 — Slack UI 로 바꿀 때 추가했는데 여기 빠져 있었다
    for (const el of pane.querySelectorAll('[data-count]'))
      count(el, .84 + [...pane.querySelectorAll('[data-count]')].indexOf(el) * .12);
  }

  if (i === 3) {
    rise(fx(1), .2); rise(fx(2), .44);
    rise(fx(3), .6); rise(fx(4), .72); rise(fx(5), .86); rise(fx(6), 1);
    // 승인이 눌린다 — press 는 0.96 (그 아래는 과장돼 보인다)
    const press = pane.querySelector('[data-press]');
    go(press, { scale: [1, .96, 1] }, { duration: .26, delay: 1.9 });
    // 눌린 뒤 상태 전환: 버튼 행은 부드럽게 빠지고(exit 는 enter 보다 약하게) 완료 행이 들어온다
    const after = pane.querySelector('[data-after]');
    at(2160, () => {
      for (const el of pane.querySelectorAll('[data-askrow]'))
        animate(el, { opacity: [1, 0], y: [0, -4] }, { duration: .32, ease: FX })
          .finished.then(() => { el.hidden = true; }).catch(() => {});
    });
    at(2420, () => {
      if (!after) return;
      after.hidden = false;
      animate(after, { opacity: [0, 1], y: [8, 0] }, { duration: .45, ease: FX });
    });
  }

  if (i === 4) {
    rise(fx(1), .2); rise(fx(2), .48);
    // 이력은 "지금 쌓이는" 것이라 간격을 넉넉히 둔다
    for (const el of pane.querySelectorAll('[data-log]'))
      rise(el, .72 + (+el.dataset.log - 1) * .62, .45);
  }

  return kill;
}

/* ── 동작 방식 탭 — sanalabs 실측 7.0초 자동 순환 ────────
   원본에는 원형 일시정지 토글(.toggle-autoplay)이 있다. 자동으로 움직이는 것은
   멈출 수 있어야 하므로 같이 옮겼다. 탭을 직접 누르면 타이머를 처음부터 다시 센다.
   화면 밖에서는 돌리지 않는다 — 안 보이는 걸 7초마다 갈아치울 이유가 없다. */
function tabs() {
  const sec = document.querySelector('.s-tabs');
  if (!sec) return;
  const tabs = Array.from(sec.querySelectorAll('.s-tab'));
  const panes = Array.from(sec.querySelectorAll('.s-pane'));
  const toggle = sec.querySelector('.s-auto');
  if (tabs.length !== panes.length || !tabs.length) return;

  let cur = 0, timer = null, playing = true, onScreen = false, running = [];

  /* 캡처용 링크 — ?step=1~5 면 그 단계 탭에서 시작하고 자동 넘김을 멈춘다.
     예) /?step=3#how  ·  &clean=1 이면 떠 있는 내비를 숨긴다(섹션이 가려지지 않게) */
  const q = new URLSearchParams(location.search);
  const pin = parseInt(q.get('step'), 10);
  if (pin >= 1 && pin <= panes.length) {
    cur = pin - 1; playing = false;
    toggle?.classList.remove('is-playing');
    toggle?.setAttribute('aria-pressed', 'true');
    toggle?.setAttribute('aria-label', '자동 넘김 재생');
  }
  if (q.get('clean') === '1') document.querySelector('.nav')?.style.setProperty('display', 'none');

  /* 흐름 모션은 DOM 을 만진다(타이핑·상태 전환). 다시 재생할 때 처음 상태로
     돌려놓아야 하므로 초기 HTML 을 들고 있는다 — 되돌리는 코드를 따로 쓰면 반드시 어긋난다. */
  const initial = panes.map(p => p.innerHTML);
  if (!reduce) sec.classList.add('fx-on');       // 시작 상태(투명)는 JS 가 돌 때만 건다

  const show = i => {
    for (const a of running) { try { a.cancel(); } catch (e) {} }
    running = [];
    cur = (i + panes.length) % panes.length;
    tabs.forEach((t, n) => { t.classList.toggle('is-on', n === cur); t.setAttribute('aria-selected', n === cur); });
    panes.forEach((p, n) => { p.hidden = n !== cur; p.classList.toggle('is-on', n === cur); });
    if (reduce) return;
    const pane = panes[cur];
    pane.innerHTML = initial[cur];               // 흐름을 처음부터 다시
    animate(pane.querySelector('.s-h'), { opacity: [0, 1], y: [14, 0] }, { duration: .6, ease: EASE });
    animate(pane.querySelector('.s-shot'), { opacity: [0, 1], y: [22, 0] }, { duration: .8, ease: EASE, delay: .08 });
    running = flow(pane);
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const run = () => { stop(); if (playing && onScreen && !reduce) timer = setInterval(() => show(cur + 1), TAB_MS); };

  tabs.forEach((t, i) => t.addEventListener('click', () => { show(i); run(); }));
  toggle?.addEventListener('click', () => {
    playing = !playing;
    toggle.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-pressed', String(!playing));
    toggle.setAttribute('aria-label', playing ? '자동 넘김 일시정지' : '자동 넘김 재생');
    run();
  });
  /* 처음 화면에 들어올 때도 흐름을 한 번 재생한다 — 안 하면 1번 탭이 정지 화면으로 서 있다 */
  inView(sec, () => {
    onScreen = true; show(cur); run();
    return () => { onScreen = false; stop(); for (const a of running) { try { a.cancel(); } catch (e) {} } running = []; };
  }, { amount: .2 });
}

/* ── 팀 운영 — 목록 5줄과 콘솔 화면 5개가 같이 움직인다 ────
   목록만 돌고 화면이 하나면 "무엇을 말하는 중인지"가 안 붙는다.
   줄을 직접 누를 수도 있어야 하므로 li 안을 button 으로 만들었다(탭과 같은 조작감).
   주기는 탭 섹션 실측값(7.0초)을 그대로 쓴다. */
function teamRotate() {
  const list = document.querySelector('.s-rot');
  const media = document.querySelector('.s-split__media');
  if (!list) return;
  const items = Array.from(list.children);
  const btns = items.map(li => li.querySelector('button'));
  const panes = media ? Array.from(media.querySelectorAll('.cs-pane')) : [];
  let cur = 0, timer = null, onScreen = false;

  const show = i => {
    cur = (i + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle('is-on', n === cur));
    btns.forEach((b, n) => b && b.setAttribute('aria-selected', String(n === cur)));
    panes.forEach((p, n) => { p.hidden = n !== cur; });
    const pane = panes[cur];
    if (pane && !reduce) animate(pane, { opacity: [0, 1], y: [10, 0] }, { duration: .5, ease: FX });
  };
  const run = () => { clearInterval(timer); if (onScreen && !reduce) timer = setInterval(() => show(cur + 1), TAB_MS); };

  btns.forEach((b, i) => b && b.addEventListener('click', () => { show(i); run(); }));
  inView(list, () => { onScreen = true; run(); return () => { onScreen = false; clearInterval(timer); }; }, { amount: .4 });
}


/* ── 내비 명암 전환 ──────────────────────────────────────
   내비는 어두운 히어로와 흰 본문 위를 모두 지나간다. 유리를 투명하게 두면
   한쪽에서는 반드시 글씨가 사라진다 — 히어로를 벗어나면 밝은 유리로 갈아탄다.
   모션이 아니라 상태라서 reduce 여부와 무관하게 건다. */
function navMode() {
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  if (!nav || !hero) return;
  inView(hero, () => {
    nav.classList.remove('is-light');
    return () => nav.classList.add('is-light');
  }, { amount: .12 });
}


/* ── 직무 탭 — 콘솔 「에이전트 만들기」의 직무 8종 ─────────
   탭을 누르면 그 직무의 템플릿 카드로 갈아탄다. 자동 순환은 걸지 않는다 —
   같은 화면에 이미 7초짜리 자동 전환이 둘(동작 방식 탭·팀 운영 목록) 있어서
   세 번째가 돌면 읽는 동안 계속 뭔가 움직인다. 여기는 누를 때만 바뀐다. */
/* ── 직무 탭 + 왼쪽 이미지 영역의 타이핑 ─────────────────
   참고 영상(sana-ref-video-01.mov, 1356×1084 · 60fps · 10.8초)을 30fps 로 풀어
   캐럿 x 좌표를 프레임마다 재서 뽑은 값이다:
     타이핑   0.00→2.60s 에 26자      ≈ 100ms/자
              7.33→10.63s 에 28자     ≈ 118ms/자   → 110ms 에 지터를 준다
     유지     2.60→4.63s              ≈ 2.0초
     삭제     4.63→6.80s 에 53자      ≈ 40ms/자
     빈 상태  6.80→7.33s              ≈ 0.5초
   탭을 바꾸면 그 탭의 요청으로 갈아탄다. 화면 밖이면 멈춘다(IntersectionObserver). */
const TYPE_MS = 110, TYPE_JIT = 35, SEND_MS = 420, IND_MS = 900, HOLD_MS = 2600;

/* 사진 위 슬랙 스레드 — 요청을 작성창에 치고 → 보내고 → 답장이 오고 → 승인까지.
   타이핑 속도(110ms/자)와 완료 후 유지(≈2초)는 참고 영상 실측값이다.
   흐름 문구는 index.html 의 <script id="ph-flows"> 에 있다(마크업에서 검토 가능). */
function composer(fig) {
  const textEl = fig.querySelector('.s-ph__text');
  const caret = fig.querySelector('.s-ph__caret');
  const comp = fig.querySelector('.s-ph__comp');
  const log = fig.querySelector('.s-ph__log');
  const ind = fig.querySelector('.s-ph__ind');
  if (!textEl || !log) return null;

  let raw = {};
  try { raw = JSON.parse(document.getElementById('ph-flows').textContent); } catch { return null; }

  let timer = null, run = 0, onScreen = true, current = '0';
  const stop = () => { clearTimeout(timer); timer = null; };
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const mention = f => '@' + f.who;                 /* 채널에서는 에이전트를 멘션해 부른다 */
  const line = f => mention(f) + ' ' + f.ask;       /* 작성창에 치는 원문 */

  function askRow(f) {
    return '<div class="sl__msg"><span class="sl__ava">김</span><div class="sl__in">' +
      '<div class="sl__meta"><b>김민지</b><em>오전 9:24</em></div>' +   // 목업 이름 — #how 섹션과 같은 사람
      '<p class="sl__txt"><span class="sl__mention">' + esc(mention(f)) + '</span> ' +
      esc(f.ask) + '</p></div></div>';
  }
  function replyRow(f) {
    const kind = f.approval ? ' sl__att--ask' : '';
    const foot = f.approval
      ? '<div class="sl__btns"><span class="sl__btn sl__btn--pri">승인</span>' +
        '<span class="sl__btn sl__btn--danger">반려</span></div>'
      : '<div class="sl__ok"><span class="sl__ok__ck"></span>완료<em>오전 9:25</em></div>';
    return '<div class="sl__msg"><span class="sl__ava sl__ava--b">B</span><div class="sl__in">' +
      '<div class="sl__meta"><b>Byr</b><span class="sl__app">앱</span><em>오전 9:25</em></div>' +
      '<div class="sl__att' + kind + '">' +
      '<p class="sl__att__ttl">' + esc(f.title) + '</p>' +
      '<p class="sl__att__row">' + esc(f.row) + '<em class="sl__em--on">' + esc(f.val) + '</em></p>' +
      '<p class="sl__att__ctx">' + esc(f.ctx) + '</p>' + foot +
      '</div></div></div>';
  }

  function play(list) {
    stop();
    const me = ++run;
    let fi = 0;
    const step = (fn, ms) => { timer = setTimeout(() => { if (me === run && onScreen) fn(); }, ms); };

    function reset() {
      log.innerHTML = '';
      textEl.textContent = '';
      comp.classList.remove('is-ready');
      caret.classList.add('is-blink');
      step(() => type(0), 500);
    }
    function type(i) {
      const f = list[fi];
      const full = line(f);
      if (i > full.length) { comp.classList.add('is-ready'); return step(send, SEND_MS); }
      textEl.textContent = full.slice(0, i);
      caret.classList.remove('is-blink');
      step(() => type(i + 1), TYPE_MS + (Math.random() * 2 - 1) * TYPE_JIT);
    }
    function send() {
      const f = list[fi];
      textEl.textContent = '';
      comp.classList.remove('is-ready');
      caret.classList.add('is-blink');
      log.insertAdjacentHTML('beforeend', askRow(f));
      if (!reduce) animate(log.lastElementChild, { opacity: [0, 1], y: [6, 0] }, { duration: .32, ease: FX });
      ind.hidden = false;
      step(reply, IND_MS);
    }
    function reply() {
      ind.hidden = true;
      log.insertAdjacentHTML('beforeend', replyRow(list[fi]));
      if (!reduce) animate(log.lastElementChild, { opacity: [0, 1], y: [6, 0] }, { duration: .36, ease: FX });
      step(() => { fi = (fi + 1) % list.length; reset(); }, HOLD_MS);
    }
    reset();
  }

  const chn = fig.querySelector('.s-ph__chn');
  const mem = fig.querySelector('.s-ph__mem');

  const api = {
    set(tab) {
      current = tab.dataset.i || '0';
      if (chn && tab.dataset.ch) chn.textContent = tab.dataset.ch;
      if (mem && tab.dataset.mem) mem.textContent = tab.dataset.mem;
      textEl.dataset.ph = (tab.dataset.ch || '') + '에 메시지 보내기';
      const list = raw[current];
      if (!list || !list.length) return;
      if (reduce) {                       // 모션을 줄이는 설정이면 결과 한 벌을 그대로 보여준다
        stop();
        log.innerHTML = askRow(list[0]) + replyRow(list[0]);
        textEl.textContent = '';
        ind.hidden = true;
        return;
      }
      play(list);
    },
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      onScreen = es[0].isIntersecting;
      if (onScreen) { const t = document.querySelector('.s-rtab.is-on'); if (t) api.set(t); }
      else stop();
    }, { threshold: .15 }).observe(fig);
  }
  return api;
}

function roleTabs() {
  const wrap = document.querySelector('.s-roles');
  if (!wrap) return;
  const tabs = Array.from(wrap.querySelectorAll('.s-rtab'));
  const panes = Array.from(wrap.querySelectorAll('.s-rpane'));
  if (tabs.length !== panes.length) return;

  const fig = document.querySelector('.s-ph');
  const comp = fig ? composer(fig) : null;
  const photo = fig && window.byrPhoto ? window.byrPhoto(fig) : null;   // unsplash.js 가 있을 때만

  const select = (i, first) => {
    tabs.forEach((x, n) => { x.classList.toggle('is-on', n === i); x.setAttribute('aria-selected', String(n === i)); });
    panes.forEach((p, n) => { p.hidden = n !== i; });
    if (comp) comp.set(tabs[i]);
    if (photo) photo(tabs[i].dataset.photo);
    if (!first && !reduce) animate(panes[i], { opacity: [0, 1], y: [8, 0] }, { duration: .45, ease: FX });
  };

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  select(tabs.findIndex(t => t.classList.contains('is-on')) || 0, true);
}


/* ── 요금 월간/연간 토글 ─────────────────────────────────
   가격 두 벌이 마크업에 다 있고 CSS 가 골라 보여준다. JS 는 상태만 바꾼다 —
   스크립트가 없거나 실패해도 월간 가격은 그대로 보인다. */
function priceToggle() {
  const sw = document.querySelector('.s-toggle__sw');
  const plans = document.querySelector('.s-plans');
  if (!sw || !plans) return;
  const labs = document.querySelectorAll('.s-toggle__lab');
  sw.addEventListener('click', () => {
    const annual = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(annual));
    plans.classList.toggle('is-annual', annual);
    labs.forEach(l => l.classList.toggle('is-on', (l.dataset.lab === 'y') === annual));
  });
}

/* ── 초기화 ──────────────────────────────────────────────
   reduce 일 때는 아무것도 돌리지 않는다. 끝난 상태로 세워 두는 건
   styles.css 의 prefers-reduced-motion 블록이 맡는다 — 한 곳에서만 정하게 둔다.
   단 탭은 예외다: reduce 라도 클릭으로는 넘길 수 있어야 하므로 붙이고, 자동만 끈다. */
function init() {
  videos();                            // 재생 자체는 모션이 아니다. reduce 와 무관하게 건다
  navMode();                           // 내비 명암 전환 — 상태라서 reduce 와 무관
  tabs();                              // 자동 순환은 tabs() 안에서 reduce 를 보고 끈다
  teamRotate();                        // 같은 이유로 클릭 전환은 reduce 에서도 살린다
  roleTabs();                          // 직무 탭 — 클릭 전용
  priceToggle();                       // 요금 월간/연간 — 상태만 바꾼다
  if (reduce) return;
  reveals();
  heroFireflies();                     // 히어로 반딧불이 — 커서 발생형 (reduce 시 생략)
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
else init();
