/* share.js — «Поделиться»: открытка-картинка кодом (canvas) и окно с кнопками под площадку.
 *
 *   Share.open({
 *     what: 'card',                 // что делим — для статистики (card, horo, compat, yesno…)
 *     title: 'Поделиться картой дня',
 *     text: 'Моя карта дня — Звезда…',  // текст без ссылки
 *     hash: '#/horo/leo',           // куда ведёт ссылка (экран приложения)
 *     fileName: 'karta-dnya',       // имя файла картинки
 *     draw: function (pc) { … },    // рисует открытку (может вернуть Promise); нет — без картинки
 *     onAction: function (how) { …} // нажатая кнопка: vk_story, vk_link, ok_post, image, save, link, copy
 *   });
 *
 * Кнопки:
 *   ВК  — «В историю ВКонтакте» (картинка + ссылка), «Отправить ссылкой», «Скопировать текст»;
 *   ОК  — «Опубликовать в ленте» (текст + ссылка), «Скопировать текст»;
 *   вне площадки — «Отправить открытку» (системное окно с файлом, если телефон умеет),
 *         «Сохранить картинку», «Отправить ссылкой» (системное окно или копирование), «Скопировать текст».
 *
 * Помощники открытки (pc): ctx, W, H, colors, background(), frame(), text(str, opt) → низ текста,
 *   svg(svgСтрока, x, y, w, h, цвет) → Promise, roundRect(x, y, w, h, r), footer(подпись, дата).
 * Также: Share.toast(текст), Share.copyText(текст), Share.shareText(текст, ссылка), Share.render(draw).
 * Переносится в другие мини-приложения без правок (нужны platform.js и analytics.js, оформление — блок
 * «Окно Поделиться» в style.css). См. docs/TEMPLATE.md.
 */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var W = 1080, H = 1350;
  var COLORS = { gold: '#f3cf73', gold2: '#e0a93a', text: '#fff8e8', text2: '#efe4c8', ink: '#3a2470', bg1: '#0d0a2b', bg2: '#1b1450', bg3: '#2b1d66' };
  var SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", "Noto Serif", serif';
  var SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Плашка и копирование ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('div', 'toast');
      toastEl.id = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.hidden = true;
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
    toastEl.hidden = true;
  }
  var copyBox = null;
  function showCopyBox(text) {
    if (!copyBox) {
      copyBox = el('div', 'copybox',
        '<div class="copybox-inner" role="dialog" aria-modal="true" aria-labelledby="copybox-title">' +
        '<p id="copybox-title" class="copybox-title">Скопируйте текст и вставьте в сообщение</p>' +
        '<textarea readonly rows="5"></textarea>' +
        '<button type="button" class="btn btn-gold">Готово</button></div>');
      copyBox.id = 'copybox';
      copyBox.hidden = true;
      document.body.appendChild(copyBox);
      copyBox.querySelector('button').addEventListener('click', function () { copyBox.hidden = true; });
    }
    var ta = copyBox.querySelector('textarea');
    ta.value = text;
    copyBox.hidden = false;
    ta.focus();
    ta.select();
  }
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
  /* Текст со ссылкой: системное окно «Поделиться», иначе копирование. */
  function shareText(text, url) {
    var full = text + '\n' + url;
    if (navigator.share) {
      var p;
      try { p = navigator.share({ text: full }); } catch (e) { copyText(full); return; }
      if (p && p.catch) p.catch(function (e) { if (!e || e.name !== 'AbortError') copyText(full); });
    } else {
      copyText(full);
    }
  }

  /* ---------- Открытка ---------- */
  function svgImage(svg, w, h, color) {
    var s = String(svg);
    if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace('<svg', '<svg width="' + w + '" height="' + h + '" style="color:' + (color || COLORS.gold) + '"');
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('svg')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  function makeHelpers(ctx) {
    var pc = { ctx: ctx, W: W, H: H, colors: COLORS, serif: SERIF, sans: SANS };
    pc.roundRect = function (x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    pc.background = function () {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, COLORS.bg1); g.addColorStop(0.55, COLORS.bg2); g.addColorStop(1, COLORS.bg3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var r1 = ctx.createRadialGradient(W * 0.82, 0, 0, W * 0.82, 0, W * 0.8);
      r1.addColorStop(0, 'rgba(120,80,220,.45)'); r1.addColorStop(1, 'rgba(120,80,220,0)');
      ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
      var r2 = ctx.createRadialGradient(0, H, 0, 0, H, W * 0.75);
      r2.addColorStop(0, 'rgba(200,120,60,.25)'); r2.addColorStop(1, 'rgba(200,120,60,0)');
      ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
      var seed = 11, i;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
      for (i = 0; i < 170; i++) {
        var x = rnd() * W, y = rnd() * H, r = 0.8 + rnd() * 2.6, o = 0.3 + rnd() * 0.6;
        ctx.globalAlpha = o;
        ctx.fillStyle = '#fff6dc';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    pc.frame = function () {
      ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 5;
      pc.roundRect(34, 34, W - 68, H - 68, 34); ctx.stroke();
      ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
      pc.roundRect(52, 52, W - 104, H - 104, 24); ctx.stroke();
      ctx.globalAlpha = 1;
    };
    /* Текст с переносом. opt: x, y (верх первой строки), size, minSize, font ('serif'|'sans'), weight,
     * italic, color, align ('center'|'left'), maxWidth, lineHeight (×size), maxLines, spacing (px),
     * dry (true — только посчитать высоту, не рисовать). Возвращает низ текста.
     * Короткие слова (в, с, и, на…) не остаются в конце строки, строка не начинается с тире. */
    pc.text = function (str, opt) {
      opt = opt || {};
      str = String(str).replace(/ — /g, '\u00a0— ');
      for (var k = 0; k < 2; k++) str = str.replace(/(^|[\s\u00a0(«])([а-яёА-ЯЁa-zA-Z]{1,2}) /g, '$1$2\u00a0');
      var size = opt.size || 48, minSize = opt.minSize || size, maxW = opt.maxWidth || (W - 200);
      var lines, family = opt.font === 'sans' ? SANS : SERIF;
      function setFont(sz) { ctx.font = (opt.italic ? 'italic ' : '') + (opt.weight || 'normal') + ' ' + sz + 'px ' + family; }
      function wrap() {
        var words = str.split(/[ \t\n]+/), out = [], cur = '';
        words.forEach(function (w) {
          var t = cur ? cur + ' ' + w : w;
          if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
        });
        if (cur) out.push(cur);
        return out;
      }
      for (;;) {
        setFont(size);
        lines = wrap();
        var widest = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
        if ((!opt.maxLines || lines.length <= opt.maxLines) && widest <= maxW) break;
        if (size <= minSize) break;
        size -= 2;
      }
      if (opt.maxLines && lines.length > opt.maxLines) {
        lines = lines.slice(0, opt.maxLines);
        lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s,.;:—-]*$/, '') + '…';
      }
      var lh = size * (opt.lineHeight || 1.25), x = opt.x === undefined ? W / 2 : opt.x, y = opt.y || 0;
      if (opt.dry) return y + lines.length * lh;
      ctx.fillStyle = opt.color || COLORS.text;
      ctx.textAlign = opt.align || 'center';
      ctx.textBaseline = 'top';
      if (opt.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = opt.spacing + 'px';
      if (opt.shadow) { ctx.shadowColor = opt.shadow; ctx.shadowBlur = 24; }
      lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      return y + lines.length * lh;
    };
    pc.svg = function (svg, x, y, w, h, color) {
      return svgImage(svg, w, h, color).then(function (img) { ctx.drawImage(img, x, y, w, h); });
    };
    /* Подпись внизу: название приложения и где его найти (config.js: findHint), ниже — sub (дата и т.п.). */
    pc.footer = function (sub) {
      ctx.strokeStyle = 'rgba(243,207,115,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 160, H - 190); ctx.lineTo(W / 2 + 160, H - 190); ctx.stroke();
      pc.text((CFG.name || '') + (CFG.findHint ? ' · ' + CFG.findHint : ''), { y: H - 165, size: 42, minSize: 30, weight: 'bold', color: COLORS.gold, maxLines: 1, maxWidth: 900 });
      if (sub) pc.text(sub, { y: H - 110, size: 32, font: 'sans', color: COLORS.text2 });
    };
    return pc;
  }
  /* Нарисовать открытку → Promise<canvas>. */
  function render(draw) {
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('no_canvas'));
    var pc = makeHelpers(ctx);
    return Promise.resolve().then(function () { return draw(pc); }).then(function () {
      canvas.toDataURL('image/jpeg', 0.5); // проверка: холст не «испорчен» (иначе здесь будет ошибка)
      return canvas;
    });
  }
  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('blob')); }, 'image/jpeg', 0.92);
      else reject(new Error('blob'));
    });
  }
  function canShareFiles() {
    try {
      if (!navigator.share || !navigator.canShare || typeof File !== 'function') return false;
      return navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] });
    } catch (e) { return false; }
  }

  /* ---------- Окно «Поделиться» ---------- */
  var sheet = null, opener = null, current = null;
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    current = null;
    document.removeEventListener('keydown', onKey, true);
    if (opener && document.body.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ } }
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    if (e.key === 'Tab' && sheet && !sheet.hidden) {
      var f = [].slice.call(sheet.querySelectorAll('button:not([disabled])'));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function open(o) {
    var P = window.Platform || {};
    var kind = P.shareKind ? P.shareKind() : 'web';
    var link = P.link ? P.link(o.hash) : location.href.split('#')[0] + (o.hash || '');
    var fullText = o.text + '\n' + link;
    var job = current = { canvas: null, dataUrl: null };
    opener = document.activeElement;

    if (!sheet) {
      sheet = el('div', 'share-sheet');
      sheet.id = 'share-sheet';
      sheet.hidden = true;
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
      document.body.appendChild(sheet);
    }
    var btns = [];
    // в ленту ОК картинку Bridge не отправляет — открытку там не показываем, чтобы не обещать её
    var img = !!o.draw && kind !== 'ok';
    if (kind === 'vk') {
      if (img) btns.push(['vk_story', 'В историю ВКонтакте', true, 'gold']);
      btns.push(['vk_link', 'Отправить ссылкой', false, img ? 'outline' : 'gold']);
    } else if (kind === 'ok') {
      btns.push(['ok_post', 'Опубликовать в ленте ОК', false, 'gold']);
    } else {
      if (img && canShareFiles()) btns.push(['image', 'Отправить открытку', true, 'gold']);
      if (img) btns.push(['save', 'Сохранить картинку', true, btns.length ? 'outline' : 'gold']);
      if (navigator.share) btns.push(['link', 'Отправить ссылкой', false, 'outline']);
    }
    btns.push(['copy', 'Скопировать текст', false, 'outline']);

    sheet.innerHTML =
      '<div class="share-inner" role="dialog" aria-modal="true" aria-labelledby="share-title">' +
      '<p class="share-title" id="share-title">' + esc(o.title || 'Поделиться') + '</p>' +
      (img ? '<div class="share-preview" id="share-preview"><p class="share-wait">Рисуем открытку…</p></div>' : '') +
      '<div class="share-buttons">' + btns.map(function (b) {
        return '<button type="button" class="btn btn-' + b[3] + '" data-how="' + b[0] + '"' + (b[2] ? ' disabled data-needs-image="1"' : '') + '>' + b[1] + '</button>';
      }).join('') + '</div>' +
      (kind === 'ok' ? '<p class="share-note">В ленту уйдёт текст со ссылкой на приложение.</p>' : '') +
      '<button type="button" class="btn btn-ghost share-close" data-how="close">Закрыть</button>' +
      '</div>';
    sheet.hidden = false;
    document.addEventListener('keydown', onKey, true);
    var firstBtn = sheet.querySelector('button:not([disabled])');
    if (firstBtn) firstBtn.focus({ preventScroll: true });

    sheet.querySelectorAll('button[data-how]').forEach(function (b) {
      b.addEventListener('click', function () { act(b.getAttribute('data-how'), o, job, link, fullText); });
    });

    if (img) {
      render(o.draw).then(function (canvas) {
        if (current !== job) return;
        job.canvas = canvas;
        job.dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        var pv = document.getElementById('share-preview');
        if (pv) pv.innerHTML = '<img src="' + job.dataUrl + '" alt="Открытка: ' + esc(o.title || '') + '">';
        sheet.querySelectorAll('[data-needs-image]').forEach(function (b) { b.disabled = false; });
      }).catch(function () {
        if (current !== job) return;
        var pv = document.getElementById('share-preview');
        if (pv) pv.parentNode.removeChild(pv);
        sheet.querySelectorAll('[data-needs-image]').forEach(function (b) { b.parentNode.removeChild(b); });
        var rest = sheet.querySelector('.share-buttons .btn');
        if (rest) rest.className = 'btn btn-gold';
      });
    }
  }
  function act(how, o, job, link, fullText) {
    if (how === 'close') { closeSheet(); return; }
    if (typeof o.onAction === 'function') { try { o.onAction(how); } catch (e) { /* статистика */ } }
    var P = window.Platform || {};
    var platformFail = function (e) {
      // человек сам закрыл окно площадки — молчим; иначе предлагаем скопировать
      var msg = e && (e.error_data || e.message || e);
      if (/cancel|denied|reject|closed|User/i.test(JSON.stringify(msg || ''))) return;
      toast('Не получилось открыть окно. Можно скопировать текст.');
    };
    var platformOk = function (r) {
      closeSheet();
      if (r === 'simulated') toast('Проверка: здесь откроется окно ' + (P.shareKind && P.shareKind() === 'ok' ? 'Одноклассников' : 'ВКонтакте'));
    };
    if (how === 'copy') { closeSheet(); copyText(fullText); return; }
    if (how === 'link') { closeSheet(); shareText(o.text, link); return; }
    if (how === 'vk_link') { P.vkShareLink(link).then(platformOk, platformFail); return; }
    if (how === 'ok_post') { P.okPost(o.text, link).then(platformOk, platformFail); return; }
    if (how === 'vk_story') {
      if (!job.dataUrl) return;
      P.vkStory(job.dataUrl, link).then(platformOk, platformFail);
      return;
    }
    if (how === 'save') {
      if (!job.canvas) return;
      toBlob(job.canvas).then(function (blob) {
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = (o.fileName || 'otkrytka') + '.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
        closeSheet();
        toast('Картинка сохранена — её можно отправить из галереи');
      }).catch(function () { toast('Не получилось сохранить картинку'); });
      return;
    }
    if (how === 'image') {
      if (!job.canvas) return;
      toBlob(job.canvas).then(function (blob) {
        var file = new File([blob], (o.fileName || 'otkrytka') + '.jpg', { type: 'image/jpeg' });
        return navigator.share({ files: [file], text: fullText });
      }).then(function () { closeSheet(); }, function (e) {
        if (e && e.name === 'AbortError') return;
        toast('Не получилось отправить картинку. Попробуйте «Сохранить картинку».');
      });
    }
  }

  window.Share = {
    open: open,
    close: closeSheet,
    isOpen: function () { return !!(sheet && !sheet.hidden); },
    render: render,
    toast: toast,
    hideToast: hideToast,
    copyText: copyText,
    shareText: shareText,
    closeCopyBox: function () { if (copyBox) copyBox.hidden = true; },
    copyBoxOpen: function () { return !!(copyBox && !copyBox.hidden); },
    size: { width: W, height: H }
  };
})();
