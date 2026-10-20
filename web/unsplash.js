/* ── Unsplash 이미지 연결 (랜딩) ─────────────────────────────────
 * 공식 문서: https://unsplash.com/documentation
 *
 * 지켜야 하는 것(API Guidelines):
 *   1) 핫링크 — API 가 준 이미지 주소를 그대로 쓴다. 내려받아 두지 않는다.
 *   2) ixid 유지 — urls.raw 에 크기·품질만 덧붙이고 파라미터를 지우지 않는다.
 *   3) 출처 표기 — 사진가와 Unsplash 를 링크로 밝히고 UTM 을 붙인다.
 *   4) 다운로드 트래킹 — '내려받기' 기능이 있을 때만. 여기는 표시만 한다.
 *
 * 키는 config.local.js 에서 window.BYR_UNSPLASH_KEY 로 들어온다(커밋 제외).
 * 키가 없거나 한도(데모 50건/시간)를 넘기면 아무것도 하지 않는다 —
 * 마크업의 모노톤 썸네일이 그대로 남는다.
 * ---------------------------------------------------------------- */

(function () {
  var KEY = window.BYR_UNSPLASH_KEY;
  if (!KEY) return;

  var API = 'https://api.unsplash.com';
  var UTM = 'utm_source=byr&utm_medium=referral';

  function cacheKey(q, w) { return 'byr.unsplash.' + w + '.' + q; }

  function find(query, w) {
    var ck = cacheKey(query, w);
    try {
      var hit = sessionStorage.getItem(ck);
      if (hit) return Promise.resolve(JSON.parse(hit));
    } catch (e) { /* sessionStorage 를 못 쓰면 그냥 요청한다 */ }

    return fetch(
      API + '/search/photos?query=' + encodeURIComponent(query) +
      '&per_page=1&orientation=landscape&content_filter=high',
      { headers: { Authorization: 'Client-ID ' + KEY, 'Accept-Version': 'v1' } }
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var p = j && j.results && j.results[0];
        if (!p) return null;
        var shot = {
          // raw 에 이미 ixid 가 있다. 덧붙이기만 한다.
          url: p.urls.raw + '&w=' + w + '&q=80&fm=jpg&fit=crop',
          alt: p.alt_description || p.description || '',
          name: p.user.name,
          profileUrl: p.user.links.html + '?' + UTM,
          photoUrl: p.links.html + '?' + UTM
        };
        try { sessionStorage.setItem(ck, JSON.stringify(shot)); } catch (e) { /* 무시 */ }
        return shot;
      })
      .catch(function () { return null; });
  }


  function paint(card) {
    var query = card.getAttribute('data-photo');
    var thumb = card.querySelector('.s-post__thumb');
    if (!query || !thumb) return;

    find(query, 800).then(function (shot) {
      if (!shot) return;                 // 키 문제·한도 초과 → 모노톤 면 유지

      // 먼저 DOM 에 붙이고 src 를 준다. 화면 밖 lazy 이미지는 DOM 에 없으면
      // 로드가 시작되지 않아, 붙이기 전에 onload 를 기다리면 영영 안 뜬다.
      var img = document.createElement('img');
      img.className = 's-post__img';
      img.alt = shot.alt;
      img.loading = 'lazy';
      // 카드에는 출처를 붙이지 않는다 — 사진 출처는 상세 페이지 히어로 아래에만 둔다
      thumb.appendChild(img);
      img.onerror = function () { img.remove(); };
      img.src = shot.url;
    });
  }

  /* 직무 탭의 왼쪽 이미지 영역 — 탭이 바뀔 때마다 사진을 갈아끼운다.
     main.js 의 roleTabs 가 window.byrPhoto(figure) 로 받아서 쓴다.
     키가 없으면 이 함수 자체가 없고, 마크업의 배경 사진이 그대로 남는다. */
  window.byrPhoto = function (fig) {
    var img = fig.querySelector('.s-ph__img');
    if (!img) {
      img = document.createElement('img');
      img.className = 's-ph__img';
      img.alt = '';
      fig.insertBefore(img, fig.firstChild);
    }
    var seq = 0;
    return function (query) {
      if (!query) return;
      var me = ++seq;                        // 빠르게 탭을 넘기면 늦게 온 응답을 버린다
      find(query, 1200).then(function (shot) {
        if (!shot || me !== seq) return;
        var next = new Image();
        next.onload = function () {
          if (me !== seq) return;
          img.src = shot.url;
          img.alt = shot.alt;
          img.classList.add('is-in');
        };
        next.src = shot.url;                 // 다 받은 뒤에 바꿔야 깜빡이지 않는다
      });
    };
  };

  function run() {
    var cards = document.querySelectorAll('.s-post[data-photo]');
    for (var i = 0; i < cards.length; i++) paint(cards[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
