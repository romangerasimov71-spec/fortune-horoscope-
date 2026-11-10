/* Гадания и гороскоп — прототип мини-приложения.
 * Экраны: главный (#/), карта дня (#/card), да или нет (#/yesno),
 * гороскоп: сетка знаков (#/horo) и знак (#/horo/<id>).
 */
(function () {
  'use strict';

  var C = window.CONTENT, ART = window.ART;
  var app = document.getElementById('app');

  /* ---------- Хранилище (localStorage, а если недоступно — память) ---------- */
  var mem = {};
  var store = {
    get: function (k) {
      try {
        var v = window.localStorage.getItem('fh.' + k);
        if (v !== null) return JSON.parse(v);
      } catch (e) { /* нет доступа */ }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    set: function (k, v) {
      mem[k] = v;
      try { window.localStorage.setItem('fh.' + k, JSON.stringify(v)); } catch (e) { /* нет доступа */ }
    },
    del: function (k) {
      delete mem[k];
      try { window.localStorage.removeItem('fh.' + k); } catch (e) { /* нет доступа */ }
    }
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

  /* ---------- Поделиться ---------- */
  function appUrl() { return location.href.split('#')[0].split('?')[0]; }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); t.hidden = true; }, 4000);
  }
  function showCopyBox(text) {
    var box = document.getElementById('copybox'), ta = document.getElementById('copybox-text');
    ta.value = text;
    box.hidden = false;
    ta.focus();
    ta.select();
  }
  document.getElementById('copybox-close').addEventListener('click', function () {
    document.getElementById('copybox').hidden = true;
  });
  function legacyCopy(text) {
    var ta = document.createElement('textarea'), ok = false;
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    var done = function () { toast('Скопировано — вставьте в сообщение'); };
    var fail = function () { if (legacyCopy(text)) done(); else showCopyBox(text); };
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  }
  function share(text) {
    var full = text + '\n' + appUrl();
    if (navigator.share) {
      var p;
      try { p = navigator.share({ text: full }); } catch (e) { copyText(full); return; }
      if (p && p.catch) p.catch(function (e) { if (!e || e.name !== 'AbortError') copyText(full); });
    } else {
      copyText(full);
    }
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
    var parts = h.split('/').filter(Boolean);
    return parts;
  }
  function parentOf(parts) {
    if (parts[0] === 'horo' && parts[1]) return '#/horo';
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
  function render(moved) {
    clearTimers();
    var t = document.getElementById('toast');
    t.classList.remove('show'); t.hidden = true;
    document.getElementById('copybox').hidden = true;
    current = { share: null };
    var p = route();
    if (p[0] === 'card') renderCard();
    else if (p[0] === 'yesno') renderYesNo();
    else if (p[0] === 'horo' && p[1]) renderSign(p[1]);
    else if (p[0] === 'horo') renderHoro();
    else renderHome();
    app.setAttribute('data-hash', location.hash);
    if (moved) {
      window.scrollTo(0, 0);
      var h1 = app.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
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
    if (i === null) i = drawCard();
    showCard(i, true, false);
  }
  function showCard(i, animate, already) {
    var card = C.tarot[i], btn = document.getElementById('tarot');
    var front = document.getElementById('tarot-front');
    front.innerHTML =
      '<span class="tf-num">' + roman(card.n) + '</span>' +
      '<span class="tf-sym">' + ART.tarot(card.n) + '</span>' +
      '<span class="tf-name">' + esc(card.name) + '</span>';
    btn.removeEventListener('click', onDraw);
    btn.setAttribute('aria-label', 'Ваша карта дня: ' + card.name);
    btn.setAttribute('aria-disabled', 'true');
    btn.tabIndex = -1;
    if (!animate) btn.classList.add('no-anim');
    btn.classList.add('flipped');
    app.classList.add('revealed');

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
    };
    if (animate && !reducedMotion()) timers.push(setTimeout(put, 650)); else put();
    current.share = function () {
      share('Моя карта дня — ' + card.name + ' ✨\n«' + card.motto + '». ' + card.advice + '\nУзнай свою:');
    };
  }
  function updateNext() {
    var el = document.getElementById('next-card');
    if (el) el.textContent = 'Новая карта — завтра. Откроется через ' + untilMidnight(now()) + '.';
  }
  /* Если результат ниже края экрана — плавно подвинуть страницу, чтобы его было видно. */
  function revealIntoView(el) {
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
      '<input id="q" class="field" type="text" maxlength="140" autocomplete="off" enterkeyhint="go" placeholder="Например: ехать ли на дачу?">' +
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
    var i = pickAnswer(), a = C.yesno[i];
    timers.push(setTimeout(function () {
      ball.classList.remove('thinking');
      ball.classList.add('done');
      out.innerHTML =
        (question ? '<p class="your-q">Ваш вопрос: «' + esc(question) + '»</p>' : '') +
        '<p class="answer-title kind-' + a.kind + '">' + esc(a.title) + '</p>' +
        '<p class="answer-text">' + esc(a.text) + '</p>' +
        '<div class="actions">' + shareBtn() + '</div>';
      out.classList.add('appear');
      revealIntoView(out);
      btn.disabled = false;
      btn.textContent = 'Спросить ещё раз';
      asking = false;
      current.share = function () {
        share('Волшебный шар ответил мне: «' + a.title + '» 🔮\n' + a.text + '\nЗадай свой вопрос:');
      };
    }, reducedMotion() ? 400 : 1800));
  }

  /* ---------- Гороскоп ---------- */
  function mySignIdx() {
    var id = store.get('sign'), i;
    for (i = 0; i < C.zodiac.length; i++) if (C.zodiac[i].id === id) return i;
    return null;
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
    html += '<div class="signs">' + C.zodiac.map(function (s, i) {
      return '<button type="button" class="sign' + (i === my ? ' is-mine' : '') + '" data-go="#/horo/' + s.id + '">' +
        '<span class="sign-glyph">' + ART.zodiac(s.id) + '</span>' +
        '<span class="sign-name">' + s.name + '</span>' +
        '<span class="sign-dates">' + s.from + ' –<br>' + s.to + '</span></button>';
    }).join('') + '</div>';
    app.innerHTML = html;
  }
  function renderSign(id) {
    var idx = -1, i;
    for (i = 0; i < C.zodiac.length; i++) if (C.zodiac[i].id === id) idx = i;
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
      h.parts.map(function (p) {
        return '<section class="horo-part part-' + p.key + '"><h2>' + p.title + '</h2><p class="text">' + esc(p.text) + '</p></section>';
      }).join('') +
      '<div class="lucky">' +
      '<div class="lucky-item"><span class="lucky-label">Цвет дня</span><span class="lucky-val"><span class="swatch" style="background:' + h.color[1] + '"></span>' + h.color[0] + '</span></div>' +
      '<div class="lucky-item"><span class="lucky-label">Число дня</span><span class="lucky-val num">' + h.number + '</span></div>' +
      '</div>' +
      '<div class="actions">' + shareBtn() +
      '<button type="button" class="btn btn-outline" data-action="mine" aria-pressed="' + mine + '">' +
      (mine ? '★ Это мой знак' : '☆ Запомнить как мой знак') + '</button>' +
      '</div>' +
      '<button type="button" class="btn btn-outline btn-wide" data-action="back">Другие знаки</button>';
    var advice = h.parts[h.parts.length - 1].text;
    current.share = function () {
      share(s.name + ', гороскоп на ' + dateText(d) + ' ✨\nСовет дня: ' + advice + '\nУзнай свой:');
    };
  }
  function toggleMine(btn) {
    var p = route(), id = p[1];
    if (store.get('sign') === id) {
      store.del('sign');
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = '☆ Запомнить как мой знак';
      toast('Знак больше не отмечен');
    } else {
      store.set('sign', id);
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = '★ Это мой знак';
      toast('Запомнили! Ваш знак будет первым');
    }
  }

  /* ---------- Нажатия ---------- */
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go], [data-action]');
    if (!t || !app.contains(t)) return;
    var goTo = t.getAttribute('data-go');
    if (goTo) { go(goTo); return; }
    var a = t.getAttribute('data-action');
    if (a === 'back') back();
    else if (a === 'share' && current.share) current.share();
    else if (a === 'draw') onDraw();
    else if (a === 'ask') ask();
    else if (a === 'mine') toggleMine(t);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var box = document.getElementById('copybox');
      if (!box.hidden) { box.hidden = true; return; }
    }
  });

  window.addEventListener('popstate', function () { render(true); });
  window.addEventListener('hashchange', function () {
    /* Ручная правка адреса: страница уже показана через popstate, если он был. */
    if (app.getAttribute('data-hash') !== location.hash) render(true);
  });

  /* ---------- Старт ---------- */
  document.getElementById('sky').innerHTML = ART.sky();
  if (!history.state) history.replaceState({ depth: 0 }, '', location.hash || '#/');
  render(false);

  /* Для самопроверки (не используется интерфейсом). */
  window.__fh = { horoscopeFor: horoscopeFor, dayNumber: dayNumber, pickIndex: pickIndex };
})();
