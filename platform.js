/* platform.js — одна маленькая обёртка над Playgama Bridge для мини-приложений студии.
 *
 * Всё, что приложение берёт у площадки (ВК, ОК, Playgama), идёт только через этот файл:
 *   Platform.init()                     — запуск Bridge (или работа без него);
 *   Platform.storage.load/get/set/remove — сохранение (Bridge, а запасом localStorage);
 *   Platform.rewardedSupported/showRewarded — реклама за награду;
 *   Platform.interstitialSupported/showInterstitial — межстраничная реклама;
 *   Platform.bannerSupported/showBanner/hideBanner — баннер (в config.js выключен);
 *   Platform.shareKind/vkStory/vkShareLink/okPost/link — «поделиться» на площадке;
 *   Platform.sendEvent — статистика (используется из analytics.js);
 *   Platform.onPause/isPaused, Platform.ready — пауза и «приложение готово».
 *
 * Без Bridge (страница открыта на GitHub Pages, файл Bridge не загрузился, площадка молчит)
 * приложение работает полностью: сохранение в localStorage, реклама скрыта, «поделиться» —
 * системное окно / картинка / копирование.
 *
 * Параметры адреса для проверки:
 *   ?nobridge=1        — не трогать Bridge вовсе (как будто его нет);
 *   ?fakeads=1         — пробная реклама на экране (досмотреть 5 с или закрыть раньше);
 *   ?fakeads=fail      — реклама всегда с ошибкой; ?fakeads=silent — реклама молчит;
 *   ?simulate=vk | ok  — показать окно «Поделиться» как в ВК / ОК (ничего не отправляет).
 *
 * Переносится в другие мини-приложения без правок (настройки — в config.js). См. docs/TEMPLATE.md.
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var ADS = CFG.ads || {};
  var noop = function () {};

  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  var useBridge = param('nobridge') === null;
  var fakeMode = param('fakeads');          // null | '1' | 'ok' | 'fail' | 'silent'
  var simulate = param('simulate');         // null | 'vk' | 'ok'
  if (simulate !== 'vk' && simulate !== 'ok') simulate = null;

  var B = null;                             // window.bridge, когда он успешно запущен
  var P = {
    id: 'web',                              // 'web' (без Bridge), 'mock' (Bridge вне площадки), 'vk', 'ok', 'playgama'…
    hasBridge: false,
    language: 'ru',
    payload: null                           // данные запуска (в ВК — то, что после # в ссылке vk.com/app…#…)
  };
  window.Platform = P;

  /* ---------- Запуск ---------- */
  var initPromise = null;
  P.init = function () {
    if (initPromise) return initPromise;
    initPromise = new Promise(function (resolve) {
      var b = useBridge ? window.bridge : null;
      if (!b || typeof b.initialize !== 'function') { resolve(P); return; }
      var settled = false;
      var timer = setTimeout(function () { if (!settled) { settled = true; resolve(P); } }, CFG.bridgeInitTimeoutMs || 3500);
      var r;
      try { r = b.initialize(); } catch (e) { r = Promise.reject(e); }
      Promise.resolve(r).then(function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { setupBridge(b); } catch (e) { B = null; P.hasBridge = false; }
        resolve(P);
      }, function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        resolve(P);
      });
    });
    return initPromise;
  };

  function setupBridge(b) {
    B = b;
    P.hasBridge = true;
    try { P.id = b.platform.id || 'mock'; } catch (e) { P.id = 'mock'; }
    try { P.language = b.platform.language || 'ru'; } catch (e) { /* по умолчанию ru */ }
    try { P.payload = b.platform.payload || null; } catch (e) { P.payload = null; }
    var EV = b.EVENT_NAME || {};
    try {
      b.platform.on(EV.PAUSE_STATE_CHANGED || 'pause_state_changed', function (p) { platformPaused = !!p; emitPause(); });
    } catch (e) { /* нет события паузы */ }
    try { b.advertisement.on(EV.REWARDED_STATE_CHANGED || 'rewarded_state_changed', onRewardedState); } catch (e) { /* нет рекламы */ }
    try { b.advertisement.on(EV.INTERSTITIAL_STATE_CHANGED || 'interstitial_state_changed', onInterstitialState); } catch (e) { /* нет рекламы */ }
    try { if (b.advertisement.interstitialState === 'opened') { adOpen.interstitial = true; emitPause(); } } catch (e) { /* нет рекламы */ }
  }

  /* На площадке ли мы (ВК, ОК, Playgama…), а не на обычном сайте. */
  P.onPlatform = function () { return P.hasBridge && P.id !== 'mock' && P.id !== 'web'; };

  /* «Приложение готово» — площадка убирает свою заставку. */
  P.ready = function () {
    if (!B) return;
    try { B.platform.sendMessage('game_ready'); } catch (e) { /* площадка не принимает сообщения */ }
  };

  /* ---------- Пауза (реклама открыта, вкладка свернута) ---------- */
  var platformPaused = false, lastPaused = false, pauseCbs = [];
  var adOpen = { rewarded: false, interstitial: false };
  function emitPause() {
    var p = P.isPaused();
    if (p === lastPaused) return;
    lastPaused = p;
    pauseCbs.forEach(function (cb) { try { cb(p); } catch (e) { /* обработчик приложения */ } });
  }
  P.isPaused = function () { return platformPaused || adOpen.rewarded || adOpen.interstitial; };
  P.onPause = function (cb) { pauseCbs.push(cb); };

  /* ---------- Сохранение ---------- */
  var prefix = CFG.storagePrefix || 'app';
  var LP = prefix + '.';                    // ключ в localStorage: fh.card
  var BP = prefix + '_';                    // ключ в хранилище площадки: fh_card (ВК разрешает только буквы, цифры, _ и -)
  var cache = {};
  function lsGet(k) {
    try { var v = window.localStorage.getItem(LP + k); return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
  }
  function lsSet(k, v) { try { window.localStorage.setItem(LP + k, JSON.stringify(v)); } catch (e) { /* нет доступа */ } }
  function lsDel(k) { try { window.localStorage.removeItem(LP + k); } catch (e) { /* нет доступа */ } }
  function parseVal(v) {
    if (v === null || v === undefined || v === '') return undefined;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return v; } }
    return v === null ? undefined : v;
  }
  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function bridgeStorage() { try { return B && B.storage; } catch (e) { return null; } }
  P.storage = {
    /* Прочитать все нужные ключи один раз при старте (так требует Bridge). */
    load: function (keys) {
      keys.forEach(function (k) { var v = lsGet(k); if (v !== undefined) cache[k] = v; });
      var st = bridgeStorage();
      if (!st) return Promise.resolve();
      return withTimeout(Promise.resolve().then(function () {
        return st.get(keys.map(function (k) { return BP + k; }));
      }), 4000).then(function (vals) {
        if (!vals) return;
        keys.forEach(function (k, i) {
          var v = parseVal(Array.isArray(vals) ? vals[i] : vals[BP + k]);
          if (v !== undefined) { cache[k] = v; lsSet(k, v); }
        });
      }).catch(noop);
    },
    get: function (k) { return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
    set: function (k, v) {
      cache[k] = v;
      lsSet(k, v);
      var st = bridgeStorage();
      if (st) { try { Promise.resolve(st.set([BP + k], [JSON.stringify(v)])).catch(noop); } catch (e) { /* площадка не сохранила — есть localStorage */ } }
    },
    remove: function (k) {
      delete cache[k];
      lsDel(k);
      var st = bridgeStorage();
      if (st) { try { Promise.resolve(st.delete([BP + k])).catch(noop); } catch (e) { /* не страшно */ } }
    }
  };

  /* ---------- Реклама за награду ----------
   * showRewarded(placement, { onLate }) → Promise с одним из ответов:
   *   'rewarded'    — досмотрена (давать награду только здесь);
   *   'closed'      — закрыта раньше;  'failed' — ошибка площадки;
   *   'timeout'     — реклама не открылась за ads.rewardTimeoutMs;
   *   'unsupported' — рекламы за награду здесь нет.
   * Если реклама открылась уже после 'timeout' и досмотрена — вызывается onLate()
   * (приложение само решает, положена ли ещё награда). Повторное «rewarded» за тот же показ
   * и «rewarded» без запроса ничего не дают. */
  var fakeActive = !!fakeMode;
  var req = null;
  P.rewardedSupported = function () {
    if (fakeActive) return true;
    try { return !!(B && B.advertisement && B.advertisement.isRewardedSupported); } catch (e) { return false; }
  };
  function finish(r, outcome) {
    if (r.done) return;
    r.done = true;
    clearTimeout(r.timer);
    r.resolve(outcome);
  }
  function onRewardedState(state) {
    if (state === 'opened') { adOpen.rewarded = true; emitPause(); }
    if (state === 'closed' || state === 'failed') { adOpen.rewarded = false; emitPause(); }
    var r = req;
    if (!r) return;
    if (state === 'opened') {
      r.opened = true;
      clearTimeout(r.timer);
    } else if (state === 'rewarded') {
      if (r.rewarded) return;
      r.rewarded = true;
      if (!r.done) finish(r, 'rewarded');
      else if (r.timedOut && typeof r.onLate === 'function') { try { r.onLate(); } catch (e) { /* обработчик приложения */ } }
    } else if (state === 'closed' || state === 'failed') {
      if (!r.done) finish(r, state === 'failed' ? 'failed' : (r.rewarded ? 'rewarded' : 'closed'));
      if (req === r) req = null;
    }
  }
  P.showRewarded = function (placement, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!P.rewardedSupported()) { resolve('unsupported'); return; }
      var r = { done: false, timedOut: false, opened: false, rewarded: false, onLate: opts.onLate, resolve: resolve };
      req = r;
      r.timer = setTimeout(function () {
        if (!r.done && !r.opened) { r.timedOut = true; finish(r, 'timeout'); }
      }, ADS.rewardTimeoutMs || 10000);
      try {
        if (fakeActive) fakeRewarded();
        else B.advertisement.showRewarded(placement);
      } catch (e) {
        finish(r, 'failed');
        if (req === r) req = null;
      }
    });
  };

  /* ---------- Межстраничная реклама ----------
   * showInterstitial(placement, { stillOk }) → Promise: 'closed' | 'failed' | 'timeout' | 'unsupported' | 'busy' | 'skipped'.
   * stillOk() — «показывать ещё можно» (человек всё на том же экране): проверяется перед вызовом площадки
   * и ещё раз в момент открытия пробной рекламы. Отменить уже запрошенную рекламу Bridge 2.4.1 не умеет.
   * Частоту решает приложение (config.js) и сам Bridge (minimumDelayBetweenInterstitial). */
  var ireq = null;
  P.interstitialSupported = function () {
    if (fakeActive) return true;
    try { return !!(B && B.advertisement && B.advertisement.isInterstitialSupported); } catch (e) { return false; }
  };
  function onInterstitialState(state) {
    if (state === 'opened') { adOpen.interstitial = true; emitPause(); }
    if (state === 'closed' || state === 'failed') {
      adOpen.interstitial = false; emitPause();
      if (ireq) { var f = ireq; ireq = null; clearTimeout(f.timer); f.resolve(state); }
    }
  }
  P.showInterstitial = function (placement, opts) {
    var stillOk = opts && typeof opts.stillOk === 'function' ? opts.stillOk : function () { return true; };
    return new Promise(function (resolve) {
      if (!P.interstitialSupported()) { resolve('unsupported'); return; }
      if (ireq) { resolve('busy'); return; }
      if (!stillOk()) { resolve('skipped'); return; }
      var f = ireq = { resolve: resolve };
      f.timer = setTimeout(function () {
        if (ireq === f && !adOpen.interstitial) { ireq = null; resolve('timeout'); }
      }, 8000);
      try {
        if (fakeActive) fakeInterstitial(stillOk);
        else B.advertisement.showInterstitial(placement);
      } catch (e) {
        if (ireq === f) { ireq = null; clearTimeout(f.timer); resolve('failed'); }
      }
    });
  };

  /* ---------- Баннер (включается в config.js: ads.banner) ---------- */
  P.bannerSupported = function () {
    try { return !!(ADS.banner && B && B.advertisement && B.advertisement.isBannerSupported); } catch (e) { return false; }
  };
  P.showBanner = function (position, placement) {
    if (!P.bannerSupported()) return false;
    try { B.advertisement.showBanner(position || 'bottom', placement); return true; } catch (e) { return false; }
  };
  P.hideBanner = function () {
    try { if (B && B.advertisement) B.advertisement.hideBanner(); } catch (e) { /* нет баннера */ }
  };

  /* ---------- Поделиться на площадке ---------- */
  /* 'vk' | 'ok' | 'web' — какие кнопки показывать в окне «Поделиться». */
  P.shareKind = function () {
    if (simulate) return simulate;
    if (P.id === 'vk') return 'vk';
    if (P.id === 'ok') return 'ok';
    return 'web';
  };
  /* Ссылка на приложение для друга. hash — экран, например '#/horo/leo'. */
  P.link = function (hash) {
    var h = String(hash || '').replace(/^#\/?/, '');
    var kind = P.shareKind();
    if (kind === 'vk' && CFG.vkAppId) return 'https://vk.com/app' + CFG.vkAppId + (h ? '#' + h : '');
    if (kind === 'ok' && CFG.okAppId) return 'https://ok.ru/game/' + CFG.okAppId;
    var here = location.href.split('#')[0].split('?')[0];
    var base = (/^https?:$/.test(location.protocol) && !P.onPlatform()) ? here : (CFG.pagesUrl || here);
    return base + (h ? '#/' + h : '');
  };
  function simulated(what) {
    try { console.info('[проверка] ' + what); } catch (e) { /* нет консоли */ }
    return new Promise(function (resolve) { setTimeout(function () { resolve('simulated'); }, 300); });
  }
  function vkSdk() {
    try { var s = B && B.platform && B.platform.sdk; return s && typeof s.send === 'function' ? s : null; } catch (e) { return null; }
  }
  /* История ВКонтакте с картинкой (dataUrl — 'data:image/jpeg;base64,…'). Через родной VK Bridge,
   * который Playgama Bridge сам загружает в ВК: у Playgama Bridge своей «истории» нет. */
  P.vkStoryAvailable = function () { return simulate === 'vk' || !!(P.id === 'vk' && vkSdk()); };
  P.vkStory = function (dataUrl, link) {
    if (simulate) return simulated('история ВК с картинкой, ссылка ' + link);
    var sdk = vkSdk();
    if (!sdk) return Promise.reject(new Error('no_vk'));
    return sdk.send('VKWebAppShowStoryBox', {
      background_type: 'image',
      blob: dataUrl,
      attachment: { text: 'go_to', type: 'url', url: link }
    });
  };
  /* «Поделиться ссылкой» в ВК (окно ВК: на стену, в сообщения, в историю). */
  P.vkShareLink = function (link) {
    if (simulate) return simulated('ссылка в ВК ' + link);
    try { if (B && B.social && B.social.isShareSupported) return Promise.resolve(B.social.share({ url: link })); } catch (e) { /* ниже — родной VK Bridge */ }
    var sdk = vkSdk();
    if (!sdk) return Promise.reject(new Error('no_vk'));
    return sdk.send('VKWebAppShare', { link: link });
  };
  /* Запись в ленте Одноклассников: текст + ссылка. */
  P.okPost = function (text, link) {
    if (simulate) return simulated('запись в ОК: ' + text + ' ' + link);
    try {
      if (B && B.social && B.social.isCreatePostSupported) return Promise.resolve(B.social.createPost({ text: text, url: link }));
    } catch (e) { /* ниже — отказ */ }
    return Promise.reject(new Error('no_ok'));
  };

  /* ---------- Статистика (зовётся из analytics.js) ---------- */
  P.sendEvent = function (name, data) {
    try {
      if (B && B.analytics && typeof B.analytics.send === 'function') { B.analytics.send(name, data); return true; }
    } catch (e) { /* статистика не важнее приложения */ }
    return false;
  };

  /* ---------- Пробная реклама (?fakeads=1) ---------- */
  var fakeCss = '.fakead{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:16px;background:rgba(3,2,12,.92);color:#fff8e8;font:19px/1.45 system-ui,sans-serif;text-align:center}' +
    '.fakead-box{width:100%;max-width:440px;padding:24px 20px;border-radius:18px;border:2px dashed #f3cf73;background:#1b1450}' +
    '.fakead-tag{margin:0 0 8px;color:#f3cf73;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:16px}' +
    '.fakead-title{margin:0 0 6px;font-size:22px;font-weight:700}.fakead-timer{margin:0 0 18px;font-size:19px}' +
    '.fakead button{min-height:56px;width:100%;border-radius:999px;border:2px solid #f3cf73;background:#f3cf73;color:#2a1a00;font:700 19px system-ui,sans-serif;cursor:pointer}' +
    '.fakead button.ghost{background:transparent;color:#f3cf73}';
  function fakeOverlay(title, seconds, canSkip, onEnd, onClose) {
    if (!document.getElementById('fakead-css')) {
      var st = document.createElement('style'); st.id = 'fakead-css'; st.textContent = fakeCss; document.head.appendChild(st);
    }
    var el = document.createElement('div');
    el.className = 'fakead';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Пробная реклама');
    el.innerHTML = '<div class="fakead-box"><p class="fakead-tag">Пробная реклама</p>' +
      '<p class="fakead-title">' + title + '</p><p class="fakead-timer"></p>' +
      '<button type="button" class="' + (canSkip ? 'ghost' : '') + '">' + (canSkip ? 'Закрыть рекламу' : 'Подождите…') + '</button></div>';
    document.body.appendChild(el);
    var btn = el.querySelector('button'), tm = el.querySelector('.fakead-timer'), left = seconds, ended = false;
    if (!canSkip) btn.disabled = true;
    function tick() {
      if (left > 0) { tm.textContent = 'Осталось ' + left + ' с'; left--; return; }
      clearInterval(iv);
      ended = true;
      tm.textContent = 'Реклама досмотрена';
      btn.disabled = false;
      btn.className = '';
      btn.textContent = 'Закрыть';
      onEnd();
    }
    var iv = setInterval(tick, 1000);
    tick();
    btn.focus();
    btn.addEventListener('click', function () {
      clearInterval(iv);
      if (el.parentNode) el.parentNode.removeChild(el);
      onClose(ended);
    });
  }
  function fakeRewarded() {
    var mode = fakeMode;
    setTimeout(function () { onRewardedState('loading'); }, 50);
    if (mode === 'silent') return;
    if (mode === 'fail') { setTimeout(function () { onRewardedState('failed'); }, 500); return; }
    setTimeout(function () {
      onRewardedState('opened');
      fakeOverlay('На площадке здесь будет реклама. Досмотрите до конца — откроется гороскоп на завтра.', 5, true,
        function () { onRewardedState('rewarded'); },
        function () { onRewardedState('closed'); });
    }, 300);
  }
  function fakeInterstitial(stillOk) {
    if (fakeMode === 'silent') return;
    if (fakeMode === 'fail') { setTimeout(function () { onInterstitialState('failed'); }, 400); return; }
    setTimeout(function () {
      if (!stillOk()) {                       // человек уже ушёл с экрана — этот раз пропускаем
        if (ireq) { var f = ireq; ireq = null; clearTimeout(f.timer); f.resolve('skipped'); }
        return;
      }
      onInterstitialState('opened');
      fakeOverlay('Межстраничная реклама (бывает не чаще раза в 3 минуты).', 3, false, noop,
        function () { onInterstitialState('closed'); });
    }, 600);
  }
})();
