/* Гадания и гороскоп — мини-приложение ВК и ОК.
 * Экраны: главный (#/), карта дня (#/card), да или нет (#/yesno),
 * гороскоп: сетка знаков (#/horo) и знак (#/horo/<id>),
 * совместимость: выбор пары (#/compat) и результат (#/compat/<id>/<id>).
 *
 * Площадка (реклама, сохранение, «поделиться» в ВК/ОК) — только через platform.js,
 * открытки — share.js + postcards.js, статистика — analytics.js.
 */
(function () {
  'use strict';

  var C = window.CONTENT, ART = window.ART, CFG = window.APP_CONFIG || {};
  var P = window.Platform, A = window.Analytics, S = window.Share, PC = window.Postcards;
  var ADS = CFG.ads || {};
  var app = document.getElementById('app');

  /* ---------- Хранилище: Bridge на площадке, запасом localStorage (platform.js) ---------- */
  var KEYS = ['card', 'sign', 'lastAnswer', 'tomorrow', 'compat'];
  var store = {
    get: function (k) { return P.storage.get(k); },
    set: function (k, v) { P.storage.set(k, v); },
    del: function (k) { P.storage.remove(k); }
  };

  /* ---------- Даты ---------- */
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  function now() { return new Date(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /* Номер дня по местному календарю: одинаков для всех, кто живёт в том же дне. */
  function dayNumber(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0); }
  function dateText(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function weekday(d) { return WEEKDAYS[d.getDay()]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function greeting(d) {
    var h = d.getHours();
    if (h >= 5 && h < 12) return 'Доброе утро!';
    if (h >= 12 && h < 18) return 'Добрый день!';
    if (h >= 18 && h < 23) return 'Добрый вечер!';
    return 'Доброй ночи!';
  }
  function untilMidnight(d) {
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
    var mins = Math.max(1, Math.ceil((next - d) / 60000));
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h === 0) return m + ' мин';
    if (m === 0) return h + ' ч';
    return h + ' ч ' + m + ' мин';
  }

  /* ---------- Предсказуемый «случай» для гороскопа ---------- */
  function hashStr(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(n, r) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }

  /* Для каждой части гороскопа: постоянная перестановка вариантов P, «место» каждого знака Q
   * и шаг k (взаимно простой с числом вариантов). Вариант = P[(день·k + Q[знак]) mod N].
   * Так в один день у 12 знаков варианты всегда разные, а у знака завтра — всегда другой,
   * и один и тот же вариант у знака возвращается не раньше чем через N дней. */
  var plans = {};
  function pickIndex(name, N, day, signIdx) {
    var key = name + '/' + N, p = plans[key];
    if (!p) {
      var r = rng(hashStr('fh-horo-' + name));
      var k;
      do { k = 1 + Math.floor(r() * (N - 1)); } while (N > 1 && gcd(k, N) !== 1);
      p = plans[key] = { P: shuffled(N, r), Q: shuffled(N, r), k: N > 1 ? k : 1 };
    }
    var pos = ((day * p.k + p.Q[signIdx % N]) % N + N) % N;
    return p.P[pos];
  }

  function horoscopeFor(signIdx, d) {
    var sign = C.zodiac[signIdx], day = dayNumber(d), H = C.horoscope;
    var parts = H.parts.map(function (part) {
      var i = pickIndex(part.key, part.items.length, day, signIdx);
      return { key: part.key, title: part.title, text: part.items[i].replace(/\{dat\}/g, sign.dat) };
    });
    var color = H.colors[pickIndex('color', H.colors.length, day, signIdx)];
    var number = 1 + pickIndex('number', H.numberMax, day, signIdx);
    return { sign: sign, parts: parts, color: color, number: number };
  }
  function signIndex(id) {
    for (var i = 0; i < C.zodiac.length; i++) if (C.zodiac[i].id === id) return i;
    return -1;
  }

  /* ---------- Гороскоп на завтра (за рекламу) ---------- */
  /* Хранится список знаков, у которых завтрашний гороскоп открыт сегодня: { d: 'сегодня', s: ['leo', …] }. */
  function tomorrowOpened() {
    var t = store.get('tomorrow');
    return t && t.d === dayKey(now()) && Array.isArray(t.s) ? t.s : [];
  }
  function openTomorrow(id) {
    var list = tomorrowOpened().slice();
    if (list.indexOf(id) < 0) list.push(id);
    store.set('tomorrow', { d: dayKey(now()), s: list });
  }

  /* ---------- Совместимость ---------- */
  var ELEMENT_ORDER = ['fire', 'earth', 'air', 'water'];
  function inElementIndex(id) {
    var el = C.compat.elements[id], n = 0;
    for (var i = 0; i < C.zodiac.length; i++) {
      if (C.zodiac[i].id === id) return n;
      if (C.compat.elements[C.zodiac[i].id] === el) n++;
    }
    return 0;
  }
  function compatLevel(n) {
    var L = C.compat.levels;
    for (var i = 0; i < L.length; i++) if (n >= L[i].from) return L[i].text;
    return L[L.length - 1].text;
  }
  /* Одинаково для пары в любом порядке. Варианты «любви» и «семьи» раздаются квадратом 3×3:
   * у одного знака с тремя знаками одной стихии все три варианта разные. */
  function compatFor(aId, bId) {
    var ia = signIndex(aId), ib = signIndex(bId);
    if (ia < 0 || ib < 0) return null;
    var first = ia <= ib ? aId : bId, second = ia <= ib ? bId : aId;
    var pr = C.compat.pairs[first + '+' + second];
    if (!pr) return null;
    var e1 = C.compat.elements[first], e2 = C.compat.elements[second];
    var x = first, y = second;
    if (ELEMENT_ORDER.indexOf(e1) > ELEMENT_ORDER.indexOf(e2)) { x = second; y = first; var t = e1; e1 = e2; e2 = t; }
    var block = C.compat.byElements[e1 + '+' + e2];
    var i = inElementIndex(x), j = inElementIndex(y), lv, fv;
    if (e1 === e2) { lv = (i + j) % 3; fv = (2 * i + 2 * j) % 3; }
    else { lv = (i + j) % 3; fv = (i + 2 * j + 1) % 3; }
    return {
      key: first + '+' + second, t: pr.t, n: pr.n, label: compatLevel(pr.n),
      intro: pr.p, love: block.love[lv], family: block.family[fv], advice: pr.a
    };
  }

  /* ---------- Карта дня ---------- */
  function todayCard() {
    var s = store.get('card');
    return s && s.d === dayKey(now()) && C.tarot[s.i] ? s.i : null;
  }
  function drawCard() {
    var prev = store.get('card'), last = prev ? prev.i : -1, i, n = C.tarot.length;
    do { i = Math.floor(Math.random() * n); } while (i === last && n > 1);
    store.set('card', { d: dayKey(now()), i: i });
    return i;
  }
  function longestWord(s) {
    return Math.max(8, Math.max.apply(null, s.split(/\s+/).map(function (w) { return w.length; })));
  }
  function roman(n) {
    if (n === 0) return '0';
    var map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], out = '';
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }

  /* ---------- Да или нет ---------- */
  function pickAnswer() {
    var list = C.yesno, last = store.get('lastAnswer');
    var kinds = ['yes', 'no', 'maybe'], i, guard = 0;
    do {
      var kind = kinds[Math.floor(Math.random() * kinds.length)];
      var pool = [];
      list.forEach(function (a, idx) { if (a.kind === kind) pool.push(idx); });
      i = pool[Math.floor(Math.random() * pool.length)];
      guard++;
    } while ((i === last || i === undefined) && guard < 50);
    store.set('lastAnswer', i);
    return i;
  }

  /* Вопрос о здоровье или жизни близких: шар не отвечает «да/нет», а поддерживает. */
  var CARE_SKIP = ['здорово', 'здоровать', 'здоровал', 'здороваю', 'здоровает'];
  function isCareQuestion(q) {
    var words = q.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z]+/);
    var roots = (C.careWords || []).map(function (w) { return w.replace(/ё/g, 'е'); });
    return words.some(function (w) {
      if (!w) return false;
      if (CARE_SKIP.some(function (x) { return w.indexOf(x) === 0; })) return false;
      return roots.some(function (r) { return w.indexOf(r) === 0; });
    });
  }
  var lastCare = -1;
  function pickCare() {
    var list = C.yesnoCare, i;
    do { i = Math.floor(Math.random() * list.length); } while (i === lastCare && list.length > 1);
    lastCare = i;
    return list[i];
  }

  /* ---------- Поделиться ---------- */
  function openShare(o) {
    A.event('share_clicked', { what: o.what });
    o.onAction = function (how) { A.event('share_sent', { what: o.what, how: how }); };
    S.open(o);
  }

  /* ---------- Межстраничная реклама: редко и только в паузе ----------
   * Не чаще раза в ads.interstitialMinGapSec (от запуска или прошлого показа) и только после
   * ads.interstitialMinResults просмотренных результатов. Показывается лишь при возврате на главный экран. */
  var interAds = {
    results: 0,
    last: Date.now(),
    gap: (ADS.interstitialMinGapSec || 180) * 1000,
    minResults: ADS.interstitialMinResults === undefined ? 2 : ADS.interstitialMinResults
  };
  function countResult() { interAds.results++; }
  function maybeInterstitial() {
    if (route()[0]) return;                       // уже ушли с главного
    if (interAds.results < interAds.minResults) return;
    if (Date.now() - interAds.last < interAds.gap) return;
    if (!P.interstitialSupported() || S.isOpen() || adWaiting) return;
    interAds.last = Date.now();
    interAds.results = 0;
    P.showInterstitial('home');
  }

  /* ---------- Мелочи разметки ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function backBar() {
    return '<div class="topbar"><button type="button" class="btn-back" data-action="back">' +
      '<span class="arrow" aria-hidden="true">←</span> Назад</button></div>';
  }
  var shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  function shareBtn() {
    return '<button type="button" class="btn btn-gold" data-action="share">' + shareIcon + ' Поделиться</button>';
  }

  /* ---------- Навигация ---------- */
  var timers = [];
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }

  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }
  function parentOf(parts) {
    if (parts[0] === 'horo' && parts[1]) return '#/horo';
    if (parts[0] === 'compat' && parts[1]) return '#/compat';
    return '#/';
  }
  function go(hash) {
    var depth = (history.state && history.state.depth) || 0;
    history.pushState({ depth: depth + 1 }, '', hash);
    render(true);
  }
  function back() {
    if (history.state && history.state.depth > 0) {
      history.back();
    } else {
      history.replaceState({ depth: 0 }, '', parentOf(route()));
      render(true);
    }
  }

  var current = { share: null };
  var renderedDay = null, lastScreen = null, screenToken = 0;
  function render(moved) {
    renderedDay = dayKey(now());
    clearTimers();
    screenToken++;
    S.hideToast();
    S.closeCopyBox();
    S.close();
    current = { share: null };
    var p = route(), screen;
    if (p[0] === 'card') { screen = 'card'; renderCard(); }
    else if (p[0] === 'yesno') { screen = 'yesno'; renderYesNo(); }
    else if (p[0] === 'horo' && p[1]) { screen = 'sign'; renderSign(p[1]); }
    else if (p[0] === 'horo') { screen = 'horo'; renderHoro(); }
    else if (p[0] === 'compat' && p[1]) { screen = 'compat_result'; renderCompatResult(p[1], p[2]); }
    else if (p[0] === 'compat') { screen = 'compat'; renderCompat(); }
    else { screen = 'home'; renderHome(); }
    app.setAttribute('data-hash', location.hash);
    if (moved) {
      window.scrollTo(0, 0);
      var h1 = app.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      if (screen !== lastScreen) A.event('screen', { name: screen });
      // естественная пауза: вернулись на главный экран
      if (screen === 'home' && lastScreen && lastScreen !== 'home') timers.push(setTimeout(maybeInterstitial, 500));
    }
    lastScreen = screen;
  }

  /* ---------- Главный экран ---------- */
  function renderHome() {
    var d = now(), ci = todayCard(), my = mySignIdx();
    document.title = 'Гадания и гороскоп';
    app.className = 'app screen-home';
    app.innerHTML =
      '<header class="hero">' + ART.moon() +
      '<h1 class="title">Гадания<br> и гороскоп</h1>' +
      '<p class="greet">' + greeting(d) + '</p>' +
      '<p class="today">Сегодня ' + weekday(d) + ', ' + dateText(d) + '</p>' +
      '</header>' +
      '<nav class="tiles" aria-label="Гадания">' +
      tile('#/card', ART.iconCard(), 'Карта дня', ci !== null ? 'Сегодня: ' + C.tarot[ci].name : 'Что подскажут карты сегодня') +
      tile('#/yesno', ART.iconBall(), 'Да или нет', 'Ответ на ваш вопрос') +
      tile('#/horo', ART.iconHoro(), 'Гороскоп на сегодня', my !== null ? 'Ваш знак: ' + C.zodiac[my].name : 'Для всех 12 знаков') +
      tile('#/compat', ART.iconCompat(), 'Совместимость', 'Любовь, дружба и семья по знакам') +
      '</nav>' +
      '<p class="footnote">Для развлечения</p>';
  }
  function tile(hash, icon, title, sub) {
    return '<button type="button" class="tile" data-go="' + hash + '">' +
      '<span class="tile-icon">' + icon + '</span>' +
      '<span class="tile-text"><span class="tile-title">' + title + '</span>' +
      '<span class="tile-sub">' + esc(sub) + '</span></span>' +
      '<span class="tile-arrow" aria-hidden="true">›</span></button>';
  }

  /* ---------- Карта дня ---------- */
  function renderCard() {
    var ci = todayCard();
    document.title = 'Карта дня — Гадания и гороскоп';
    app.className = 'app screen-card';
    app.innerHTML = backBar() +
      '<h1>Карта дня</h1>' +
      '<div class="card-layout">' +
      '<div class="tarot-stage">' +
      '<div class="deck-shadow" aria-hidden="true"></div><div class="deck-shadow s2" aria-hidden="true"></div>' +
      '<button type="button" class="tarot" id="tarot" aria-label="Открыть карту дня">' +
      '<span class="tarot-inner">' +
      '<span class="tarot-face tarot-back">' + ART.cardBack() + '</span>' +
      '<span class="tarot-face tarot-front" id="tarot-front"></span>' +
      '</span></button>' +
      '</div>' +
      '<div class="card-info" id="card-info" aria-live="polite"></div>' +
      '</div>';

    var btn = document.getElementById('tarot');
    if (ci !== null) {
      showCard(ci, false, true);
    } else {
      document.getElementById('card-info').innerHTML =
        '<p class="lead">Подумайте о предстоящем дне и нажмите на колоду.</p>' +
        '<button type="button" class="btn btn-gold" data-action="draw">Открыть карту</button>';
      btn.addEventListener('click', onDraw);
    }
  }
  function onDraw() {
    var btn = document.getElementById('tarot');
    if (!btn || btn.classList.contains('flipped')) return;
    var i = todayCard();
    if (i === null) {
      i = drawCard();
      A.event('card_drawn', { card: C.tarot[i].n });
    }
    showCard(i, true, false);
  }
  function showCard(i, animate, already) {
    var card = C.tarot[i], btn = document.getElementById('tarot');
    var front = document.getElementById('tarot-front');
    front.innerHTML =
      '<span class="tf-num">' + roman(card.n) + '</span>' +
      '<span class="tf-sym">' + ART.tarot(card.n) + '</span>' +
      '<span class="tf-name" style="--len:' + longestWord(card.name) + '">' + esc(card.name) + '</span>';
    btn.removeEventListener('click', onDraw);
    btn.setAttribute('aria-label', 'Ваша карта дня: ' + card.name);
    btn.setAttribute('aria-disabled', 'true');
    btn.tabIndex = -1;
    if (!animate) btn.classList.add('no-anim');
    btn.classList.add('flipped');
    app.classList.add('revealed');
    countResult();

    var info = document.getElementById('card-info');
    var html =
      (already ? '<p class="note">Ваша карта на сегодня уже открыта</p>' : '') +
      '<h2 class="card-name">' + esc(card.name) + '</h2>' +
      '<p class="card-sub">Аркан ' + roman(card.n) + ' · ' + esc(card.motto) + '</p>' +
      (card.oldName ? '<p class="card-old">В старых колодах — «' + esc(card.oldName) + '»</p>' : '') +
      '<p class="text">' + esc(card.text) + '</p>' +
      '<div class="advice"><span class="advice-label">Совет дня</span>' + esc(card.advice) + '</div>' +
      '<div class="actions">' + shareBtn() + '</div>' +
      '<p class="next" id="next-card"></p>';
    var put = function () {
      info.innerHTML = html;
      info.classList.add('appear');
      updateNext();
      timers.push(setInterval(updateNext, 30000));
      if (animate) showBelow(info, info.querySelector('.card-name'), app.querySelector('.card-layout'));
    };
    if (animate && !reducedMotion()) timers.push(setTimeout(put, 650)); else put();
    var d = now();
    current.share = function () {
      openShare({
        what: 'card', title: 'Поделиться картой дня', fileName: 'karta-dnya',
        text: 'Моя карта дня — ' + card.name + ' ✨\n«' + card.motto + '». ' + card.advice + '\nУзнай свою:',
        hash: '#/card',
        draw: PC.card(card, dateText(d))
      });
    };
  }
  function updateNext() {
    if (checkDay()) return;
    var el = document.getElementById('next-card');
    if (el) el.textContent = 'Новая карта — завтра. Откроется через ' + untilMidnight(now()) + '.';
  }
  /* Раскладка «картинка слева, текст справа» (альбом) — текст и так рядом, прокручивать не надо. */
  function sideBySide(layout) {
    return layout && window.getComputedStyle(layout).flexDirection === 'row';
  }
  /* Карта открылась, а текст ниже края экрана — плавно подвинуть страницу так,
   * чтобы название было в верхней части экрана и было видно, что дальше есть текст. */
  function showBelow(block, title, layout) {
    if (!block || !title || sideBySide(layout)) return;
    var vh = window.innerHeight, r = block.getBoundingClientRect();
    if (r.bottom <= vh) return;
    var t = title.getBoundingClientRect().top;
    var y = window.pageYOffset + t - Math.round(vh * 0.18);
    if (y > window.pageYOffset) window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  /* Если результат ниже края экрана — плавно подвинуть страницу, чтобы его было видно. */
  function revealIntoView(el, layout) {
    if (sideBySide(layout)) return;
    var r = el.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top > vh * 0.6 || r.bottom > vh) {
      var y = window.pageYOffset + r.top - Math.max(16, vh - r.height - 16);
      y = Math.min(y, window.pageYOffset + r.top - 16);
      window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Да или нет ---------- */
  var asking = false;
  function renderYesNo() {
    asking = false;
    document.title = 'Да или нет — Гадания и гороскоп';
    app.className = 'app screen-yesno';
    app.innerHTML = backBar() +
      '<h1>Да или нет</h1>' +
      '<div class="yn-layout">' +
      '<div class="ball" id="ball">' + ART.ball() + '</div>' +
      '<div class="yn-side">' +
      '<label class="field-label" for="q">Задайте вопрос мысленно или напишите его здесь <span class="opt">(необязательно)</span></label>' +
      '<input id="q" class="field" type="text" maxlength="140" autocomplete="off" enterkeyhint="go" placeholder="Например: затевать ли ремонт?" aria-describedby="q-hint">' +
      '<p class="field-hint" id="q-hint">Шар отвечает на житейские вопросы — о делах, планах и решениях.</p>' +
      '<button type="button" class="btn btn-gold btn-big" data-action="ask" id="ask">Узнать ответ</button>' +
      '<div class="answer" id="answer" aria-live="polite"></div>' +
      '</div></div>';
    document.getElementById('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); ask(); }
    });
  }
  function ask() {
    if (asking) return;
    asking = true;
    var btn = document.getElementById('ask'), ball = document.getElementById('ball');
    var out = document.getElementById('answer'), q = document.getElementById('q');
    var question = q.value.trim();
    q.blur();
    btn.disabled = true;
    btn.textContent = 'Шар думает…';
    out.innerHTML = '';
    out.classList.remove('appear');
    ball.classList.remove('done');
    ball.classList.add('thinking');
    var care = isCareQuestion(question);
    var a = care ? pickCare() : C.yesno[pickAnswer()];
    // сам вопрос в статистику не попадает — только вид ответа и был ли текст
    A.event('yesno_asked', { kind: care ? 'care' : a.kind, has_text: question.length > 0 });
    current.share = null;
    timers.push(setTimeout(function () {
      ball.classList.remove('thinking');
      ball.classList.add('done');
      out.innerHTML =
        (question ? '<p class="your-q">Ваш вопрос: «' + esc(question) + '»</p>' : '') +
        '<p class="answer-title kind-' + (care ? 'care' : a.kind) + '">' + esc(a.title) + '</p>' +
        '<p class="answer-text">' + esc(a.text) + '</p>' +
        (care ? '' : '<div class="actions">' + shareBtn() + '</div>');
      out.classList.add('appear');
      revealIntoView(out, app.querySelector('.yn-layout'));
      btn.disabled = false;
      btn.textContent = 'Спросить ещё раз';
      asking = false;
      countResult();
      current.share = care ? null : function () {
        openShare({
          what: 'yesno', title: 'Поделиться ответом шара', fileName: 'otvet-shara',
          text: 'Волшебный шар ответил мне: «' + a.title + '» 🔮\n' + a.text + '\nЗадай свой вопрос:',
          hash: '#/yesno',
          draw: PC.yesno(a)
        });
      };
    }, reducedMotion() ? 400 : 1800));
  }

  /* ---------- Гороскоп ---------- */
  function mySignIdx() {
    var i = signIndex(store.get('sign'));
    return i < 0 ? null : i;
  }
  function renderHoro() {
    var d = now(), my = mySignIdx();
    document.title = 'Гороскоп на сегодня — Гадания и гороскоп';
    app.className = 'app screen-horo';
    var html = backBar() +
      '<h1>Гороскоп на сегодня</h1>' +
      '<p class="lead">' + cap(weekday(d)) + ', ' + dateText(d) + '. Выберите свой знак.</p>';
    if (my !== null) {
      var s = C.zodiac[my];
      html += '<button type="button" class="my-sign" data-go="#/horo/' + s.id + '">' +
        '<span class="sign-glyph">' + ART.zodiac(s.id) + '</span>' +
        '<span class="my-sign-text"><span class="my-sign-label">Ваш знак</span><span class="my-sign-name">' + s.name + '</span></span>' +
        '<span class="tile-arrow" aria-hidden="true">›</span></button>' +
        '<p class="grid-title">Все знаки</p>';
    }
    html += signGrid(function (s, i) {
      return { attr: 'data-go="#/horo/' + s.id + '"', cls: i === my ? ' is-mine' : '' };
    });
    app.innerHTML = html;
  }
  function signGrid(fn) {
    return '<div class="signs">' + C.zodiac.map(function (s, i) {
      var o = fn(s, i);
      return '<button type="button" class="sign' + (o.cls || '') + '" ' + o.attr + '>' +
        '<span class="sign-glyph">' + ART.zodiac(s.id) + '</span>' +
        '<span class="sign-name">' + s.name + '</span>' +
        '<span class="sign-dates">' + s.from + ' –<br>' + s.to + '</span></button>';
    }).join('') + '</div>';
  }
  function horoParts(h, tag) {
    return h.parts.map(function (p) {
      return '<section class="horo-part part-' + p.key + '"><' + tag + ' class="part-title">' + p.title + '</' + tag + '><p class="text">' + esc(p.text) + '</p></section>';
    }).join('') +
      '<div class="lucky">' +
      '<div class="lucky-item"><span class="lucky-label">Цвет дня</span><span class="lucky-val"><span class="swatch" style="background:' + h.color[1] + '"></span>' + h.color[0] + '</span></div>' +
      '<div class="lucky-item"><span class="lucky-label">Число дня</span><span class="lucky-val num">' + h.number + '</span></div>' +
      '</div>';
  }
  function renderSign(id) {
    var idx = signIndex(id);
    if (idx < 0) { history.replaceState(history.state, '', '#/horo'); renderHoro(); return; }
    var d = now(), h = horoscopeFor(idx, d), s = h.sign, mine = mySignIdx() === idx;
    document.title = s.name + ' — гороскоп на сегодня';
    app.className = 'app screen-sign';
    app.innerHTML = backBar() +
      '<header class="sign-head">' +
      '<span class="sign-glyph big">' + ART.zodiac(s.id) + '</span>' +
      '<div><h1>' + s.name + '</h1><p class="sign-head-dates">' + s.from + ' – ' + s.to + '</p></div>' +
      '</header>' +
      '<p class="lead">Гороскоп на ' + dateText(d) + ', ' + weekday(d) + '</p>' +
      horoParts(h, 'h2') +
      '<div class="actions">' + shareBtn() +
      '<button type="button" class="btn btn-outline" data-action="mine" aria-pressed="' + mine + '">' +
      (mine ? '★ Это мой знак' : '☆ Запомнить как мой знак') + '</button>' +
      '</div>' +
      '<div id="tomorrow-box">' + tomorrowHtml(idx) + '</div>' +
      '<button type="button" class="btn btn-outline btn-wide" data-action="back">Другие знаки</button>';
    countResult();
    var advice = h.parts[h.parts.length - 1].text;
    current.share = function () {
      openShare({
        what: 'horo', title: 'Поделиться гороскопом', fileName: 'goroskop-' + s.id,
        text: s.name + ', гороскоп на ' + dateText(d) + ' ✨\nСовет дня: ' + advice + '\nУзнай свой:',
        hash: '#/horo/' + s.id,
        draw: PC.horo(s, dateText(d), advice)
      });
    };
  }
  /* Блок «Гороскоп на завтра»: открыт — текст; нет — кнопка за рекламу (если реклама есть). */
  function tomorrowHtml(idx) {
    var s = C.zodiac[idx];
    if (tomorrowOpened().indexOf(s.id) >= 0) {
      var t = addDays(now(), 1), h = horoscopeFor(idx, t);
      return '<section class="tomorrow is-open" id="tomorrow" aria-labelledby="tomorrow-title">' +
        '<h2 class="tomorrow-title" id="tomorrow-title">Гороскоп на завтра</h2>' +
        '<p class="lead">' + cap(weekday(t)) + ', ' + dateText(t) + '</p>' +
        horoParts(h, 'h3') + '</section>';
    }
    if (!P.rewardedSupported()) return '';
    return '<section class="tomorrow" id="tomorrow">' +
      '<p class="tomorrow-lead">Хотите заглянуть в завтрашний день?</p>' +
      '<button type="button" class="btn btn-gold btn-big btn-reward" data-action="tomorrow">' +
      '<span class="play" aria-hidden="true">▶</span> Гороскоп на завтра — посмотреть за рекламу</button>' +
      '</section>';
  }
  function updateTomorrow(id) {
    var p = route(), box = document.getElementById('tomorrow-box');
    if (!box || p[0] !== 'horo' || p[1] !== id) return false;
    box.innerHTML = tomorrowHtml(signIndex(id));
    return true;
  }

  /* Реклама за награду → гороскоп на завтра. */
  var adWaiting = false;
  function adWait(on) {
    adWaiting = on;
    var w = document.getElementById('adwait');
    if (w) w.hidden = !on;
    if (on) app.setAttribute('inert', ''); else app.removeAttribute('inert');
    app.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function grantTomorrow(id, late) {
    if (tomorrowOpened().indexOf(id) >= 0) return;   // уже открыт — второй раз не даём
    openTomorrow(id);
    A.event('reward_granted', { placement: 'tomorrow', sign: id, late: !!late });
    if (updateTomorrow(id)) {
      var sec = document.getElementById('tomorrow');
      if (sec) {
        sec.classList.add('appear');
        var r = sec.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.7 || r.top < 0) window.scrollTo({ top: window.pageYOffset + r.top - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }
    S.toast('Гороскоп на завтра открыт');
  }
  function askTomorrow() {
    var p = route(), id = p[1];
    if (adWaiting || p[0] !== 'horo' || signIndex(id) < 0) return;
    if (tomorrowOpened().indexOf(id) >= 0) { updateTomorrow(id); return; }
    var token = screenToken;
    A.event('reward_offered', { placement: 'tomorrow', sign: id });
    adWait(true);
    P.showRewarded('tomorrow', {
      // реклама открылась уже после того, как мы перестали ждать, и досмотрена:
      // даём награду, только если человек всё ещё на этом же экране
      onLate: function () {
        if (token === screenToken) grantTomorrow(id, true);
        else A.event('reward_failed', { placement: 'tomorrow', reason: 'late_left' });
      }
    }).then(function (res) {
      adWait(false);
      if (res === 'rewarded') { grantTomorrow(id, false); return; }
      A.event('reward_failed', { placement: 'tomorrow', reason: res });
      if (res === 'closed') S.toast('Гороскоп на завтра откроется, если досмотреть рекламу до конца.');
      else S.toast('Реклама не загрузилась, попробуйте позже.');
    });
  }

  function toggleMine(btn) {
    var p = route(), id = p[1];
    if (store.get('sign') === id) {
      store.del('sign');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '☆ Запомнить как мой знак';
      S.toast('Знак больше не отмечен');
    } else {
      store.set('sign', id);
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = '★ Это мой знак';
      S.toast('Запомнили! Ваш знак будет первым');
    }
  }

  /* ---------- Совместимость: выбор пары ---------- */
  var pick = null;   // { a: id|null, b: id|null, active: 'a'|'b' }
  function freshPick() {
    var my = mySignIdx(), last = store.get('compat');
    var a = my !== null ? C.zodiac[my].id : (last && signIndex(last.a) >= 0 ? last.a : null);
    return { a: a, b: null, active: a ? 'b' : 'a', mine: my !== null };
  }
  function renderCompat() {
    if (!pick) pick = freshPick();
    document.title = 'Совместимость знаков — Гадания и гороскоп';
    app.className = 'app screen-compat';
    app.innerHTML = backBar() +
      '<h1>Совместимость знаков</h1>' +
      '<p class="lead">Выберите два знака: свой и того, о ком думаете, — любимого, друга, родственника.</p>' +
      '<div class="pair-slots" id="pair-slots"></div>' +
      '<p class="pick-hint" id="pick-hint" aria-live="polite"></p>' +
      signGrid(function (s) { return { attr: 'data-pick="' + s.id + '"' }; });
    drawPick();
  }
  function slotHtml(which) {
    var id = pick[which], i = signIndex(id), active = pick.active === which;
    var label = which === 'a' ? (pick.mine && id && i === mySignIdx() ? 'Ваш знак' : 'Первый знак') : 'Второй знак';
    return '<button type="button" class="slot' + (active ? ' is-active' : '') + (id ? ' is-filled' : '') + '" data-slot="' + which + '" aria-pressed="' + active + '">' +
      '<span class="slot-label">' + label + '</span>' +
      (id ? '<span class="sign-glyph">' + ART.zodiac(id) + '</span><span class="slot-name">' + C.zodiac[i].name + '</span>'
        : '<span class="slot-empty" aria-hidden="true">?</span><span class="slot-name muted">' + (active ? 'выберите ниже' : 'не выбран') + '</span>') +
      '</button>';
  }
  function drawPick() {
    var slots = document.getElementById('pair-slots');
    if (!slots) return;
    slots.innerHTML = slotHtml('a') + '<span class="slot-plus" aria-hidden="true">' + ART.heart() + '</span>' + slotHtml('b');
    document.getElementById('pick-hint').textContent = pick.active === 'a'
      ? (pick.a ? 'Выберите знак ниже, чтобы заменить первый.' : 'Нажмите на первый знак ниже.')
      : 'Теперь нажмите на второй знак ниже.';
    app.querySelectorAll('[data-pick]').forEach(function (b) {
      var id = b.getAttribute('data-pick');
      b.classList.toggle('is-picked', id === pick.a || id === pick.b);
    });
  }
  function onPick(id) {
    pick[pick.active] = id;
    if (pick.active === 'a' && !pick.b) pick.active = 'b';
    else if (pick.active === 'b' && !pick.a) pick.active = 'a';
    drawPick();
    if (pick.a && pick.b) {
      var a = pick.a, b = pick.b;
      store.set('compat', { a: a, b: b });
      pick = null;
      timers.push(setTimeout(function () { go('#/compat/' + a + '/' + b); }, 250));
    }
  }

  /* ---------- Совместимость: результат ---------- */
  function renderCompatResult(aId, bId) {
    var res = compatFor(aId, bId);
    if (!res) { history.replaceState(history.state, '', '#/compat'); renderCompat(); return; }
    var a = C.zodiac[signIndex(aId)], b = C.zodiac[signIndex(bId)];
    var R = 54, L = 2 * Math.PI * R, off = L * (1 - res.n / 100);
    document.title = a.name + ' и ' + b.name + ' — совместимость';
    app.className = 'app screen-compat-result';
    app.innerHTML = backBar() +
      '<div class="pair-top">' +
      '<div class="pair-head">' +
      '<span class="sign-glyph big">' + ART.zodiac(a.id) + '</span>' +
      '<span class="pair-heart" aria-hidden="true">' + ART.heart() + '</span>' +
      '<span class="sign-glyph big">' + ART.zodiac(b.id) + '</span>' +
      '</div>' +
      '<div class="pair-sum">' +
      '<h1 class="pair-names">' + a.name + ' и ' + b.name + '</h1>' +
      '<div class="pct" role="img" aria-label="Совместимость ' + res.n + ' процентов">' +
      '<svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="' + R + '" class="pct-bg"/>' +
      '<circle cx="64" cy="64" r="' + R + '" class="pct-fg" style="stroke-dasharray:' + L.toFixed(1) + ';stroke-dashoffset:' + off.toFixed(1) + ';--full:' + L.toFixed(1) + '"/></svg>' +
      '<span class="pct-num">' + res.n + '%</span></div>' +
      '<p class="pct-label">' + res.label + '</p>' +
      '</div></div>' +
      '<h2 class="pair-title">«' + esc(res.t) + '»</h2>' +
      '<p class="text pair-intro">' + esc(res.intro) + '</p>' +
      '<section class="horo-part"><h2 class="part-title">В любви</h2><p class="text">' + esc(res.love) + '</p></section>' +
      '<section class="horo-part"><h2 class="part-title">В дружбе и семье</h2><p class="text">' + esc(res.family) + '</p></section>' +
      '<section class="horo-part part-advice"><h2 class="part-title">Совет паре</h2><p class="text">' + esc(res.advice) + '</p></section>' +
      '<div class="actions">' + shareBtn() +
      '<button type="button" class="btn btn-outline" data-action="new-pair">Другая пара</button></div>' +
      '<p class="footnote">Для развлечения</p>';
    countResult();
    A.event('compat_shown', { pair: res.key, pct: res.n });
    current.share = function () {
      openShare({
        what: 'compat', title: 'Поделиться совместимостью', fileName: 'sovmestimost-' + a.id + '-' + b.id,
        text: a.name + ' и ' + b.name + ': совместимость ' + res.n + '% 💞\n«' + res.t + '». ' + res.advice + '\nПроверь свою пару:',
        hash: '#/compat/' + a.id + '/' + b.id,
        draw: PC.compat(a, b, res)
      });
    };
  }

  /* ---------- Нажатия ---------- */
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go], [data-action], [data-pick], [data-slot]');
    if (!t || !app.contains(t) || adWaiting) return;
    var goTo = t.getAttribute('data-go');
    if (goTo) { go(goTo); return; }
    var pk = t.getAttribute('data-pick');
    if (pk) { onPick(pk); return; }
    var sl = t.getAttribute('data-slot');
    if (sl) { pick.active = sl; drawPick(); return; }
    var a = t.getAttribute('data-action');
    if (a === 'back') back();
    else if (a === 'share' && current.share) current.share();
    else if (a === 'draw') onDraw();
    else if (a === 'ask') ask();
    else if (a === 'mine') toggleMine(t);
    else if (a === 'tomorrow') askTomorrow();
    else if (a === 'new-pair') { pick = freshPick(); go('#/compat'); }
  });

  /* Смена дня, пока экран открыт (через полночь или вернулись на вкладку утром):
   * перерисовываем экран — на карте закрытая колода, в гороскопе новый текст, на главном новая дата.
   * «Да или нет» и совместимость не трогаем: там нет даты. Пока ждём рекламу — тоже не трогаем. */
  function checkDay() {
    if (!started || dayKey(now()) === renderedDay) return false;
    var r0 = route()[0];
    if (r0 === 'yesno' || r0 === 'compat' || adWaiting || S.isOpen()) { renderedDay = dayKey(now()); return false; }
    render(false);
    window.scrollTo(0, 0);
    return true;
  }

  /* Пауза площадки (реклама открыта, приложение свернуто): останавливаем мерцание и анимации. */
  P.onPause(function (paused) { document.body.classList.toggle('paused', paused); });

  /* ВК: ссылка vk.com/app…#horo/leo открывает нужный экран. */
  var ROUTE_RE = /^(card|yesno|horo|horo\/[a-z]+|compat|compat\/[a-z]+\/[a-z]+)$/;
  function applyPayload() {
    var pl = typeof P.payload === 'string' ? P.payload.replace(/^#?\/?/, '') : '';
    if (!pl || !ROUTE_RE.test(pl)) return;
    if (location.hash && location.hash !== '#/' && location.hash !== '#') return;
    history.replaceState({ depth: 0 }, '', '#/' + pl);
  }

  /* ---------- Старт ---------- */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    applyPayload();
    if (!history.state) history.replaceState({ depth: 0 }, '', location.hash || '#/');
    render(false);
    A.event('app_open', { platform: P.id, bridge: P.hasBridge });
    A.event('screen', { name: lastScreen });
    P.ready();
    setInterval(checkDay, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });
    window.addEventListener('focus', checkDay);
    window.addEventListener('pageshow', checkDay);
    window.addEventListener('popstate', function () { render(true); });
    window.addEventListener('hashchange', function () {
      /* Ручная правка адреса: страница уже показана через popstate, если он был. */
      if (app.getAttribute('data-hash') !== location.hash) render(true);
    });
  }

  document.getElementById('sky').innerHTML = ART.sky();
  P.init().then(function () { return P.storage.load(KEYS); }).then(start, start);

  /* Для самопроверки и набора проверки рекламы (не используется интерфейсом). */
  window.__fh = {
    horoscopeFor: horoscopeFor, dayNumber: dayNumber, pickAnswer: pickAnswer, isCareQuestion: isCareQuestion,
    compatFor: compatFor, tomorrowCount: function () { return tomorrowOpened().length; },
    isPaused: function () { return document.body.classList.contains('paused'); },
    adWaiting: function () { return adWaiting; },
    started: function () { return started; },
    /* Набор проверки рекламы: показать межстраничную сразу (без 3 минут и 2 результатов). */
    adsDebug: function (o) { if (o && o.gap !== undefined) { interAds.gap = o.gap; interAds.last = 0; } if (o && o.results !== undefined) interAds.minResults = o.results; },
    postcard: function (kind, a, b) {
      var d = now();
      if (kind === 'card') return S.render(PC.card(C.tarot[a || 0], dateText(d)));
      if (kind === 'horo') { var i = signIndex(a || 'leo'), h = horoscopeFor(i, d); return S.render(PC.horo(C.zodiac[i], dateText(d), h.parts[h.parts.length - 1].text)); }
      if (kind === 'compat') return S.render(PC.compat(C.zodiac[signIndex(a)], C.zodiac[signIndex(b)], compatFor(a, b)));
      if (kind === 'yesno') return S.render(PC.yesno(C.yesno[a || 0]));
      return Promise.reject(new Error('kind'));
    }
  };
})();
