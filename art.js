/* Вся графика приложения — кодом (SVG). Никаких картинок и внешних файлов. */
(function () {
  'use strict';

  var S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

  function f(n) { return Math.round(n * 10) / 10; }

  /* Звезда с n лучами: внешний радиус R, внутренний r. */
  function starPts(cx, cy, R, r, n, rot) {
    var pts = [], i, a;
    rot = rot || -Math.PI / 2;
    for (i = 0; i < n * 2; i++) {
      a = rot + i * Math.PI / n;
      var rad = i % 2 ? r : R;
      pts.push(f(cx + Math.cos(a) * rad) + ',' + f(cy + Math.sin(a) * rad));
    }
    return pts.join(' ');
  }
  function star(cx, cy, R, r, n, extra) {
    return '<polygon points="' + starPts(cx, cy, R, r, n) + '" ' + (extra || '') + '/>';
  }

  /* Лучи вокруг точки. */
  function rays(cx, cy, r1, r2, n, offset, alt) {
    var d = '', i, a, rr;
    for (i = 0; i < n; i++) {
      a = (offset || 0) + i * 2 * Math.PI / n;
      rr = alt && i % 2 ? r1 + (r2 - r1) * 0.55 : r2;
      d += 'M' + f(cx + Math.cos(a) * r1) + ' ' + f(cy + Math.sin(a) * r1) +
        'L' + f(cx + Math.cos(a) * rr) + ' ' + f(cy + Math.sin(a) * rr);
    }
    return '<path d="' + d + '"/>';
  }

  var heart = 'M50 80 C22 62 18 40 32 33 C41 29 48 35 50 41 C52 35 59 29 68 33 C82 40 78 62 50 80 Z';
  var lemn = function (cx, cy, w, h) {
    return '<path d="M' + cx + ' ' + cy +
      ' C' + (cx - w * 0.35) + ' ' + (cy - h) + ' ' + (cx - w) + ' ' + (cy - h) + ' ' + (cx - w) + ' ' + cy +
      ' C' + (cx - w) + ' ' + (cy + h) + ' ' + (cx - w * 0.35) + ' ' + (cy + h) + ' ' + cx + ' ' + cy +
      ' C' + (cx + w * 0.35) + ' ' + (cy - h) + ' ' + (cx + w) + ' ' + (cy - h) + ' ' + (cx + w) + ' ' + cy +
      ' C' + (cx + w) + ' ' + (cy + h) + ' ' + (cx + w * 0.35) + ' ' + (cy + h) + ' ' + cx + ' ' + cy + ' Z"/>';
  };
  var dot = function (cx, cy, r) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r || 2.5) + '" fill="currentColor" stroke="none"/>'; };

  /* Символы 22 старших арканов, поле 100×100. */
  var TAROT = [
    // 0 Шут: посох с узелком, солнце, цветок
    function () {
      return '<circle cx="24" cy="22" r="7"/>' + rays(24, 22, 11, 16, 8) +
        '<path d="M28 84 L60 32"/><circle cx="63" cy="28" r="7"/>' +
        '<path d="M12 88 H88"/><path d="M24 88 V76"/><circle cx="24" cy="71" r="5"/>' + dot(24, 71, 2);
    },
    // I Маг: знак бесконечности и жезл
    function () {
      return lemn(50, 26, 22, 12) + '<path d="M50 46 V86"/>' + dot(50, 46, 4) + dot(50, 86, 4) +
        '<path d="M24 70 H40 M60 70 H76"/>' + star(26, 54, 5, 2, 4, 'fill="currentColor" stroke="none"') + star(74, 54, 5, 2, 4, 'fill="currentColor" stroke="none"');
    },
    // II Жрица: месяц между двумя колоннами
    function () {
      return '<path d="M16 86 V20 M28 86 V20 M13 20 H31 M13 86 H31"/>' +
        '<path d="M72 86 V20 M84 86 V20 M69 20 H87 M69 86 H87"/>' +
        '<path d="M56 32 A17 17 0 1 0 56 64 A16 16 0 0 1 56 32 Z"/>' + dot(50, 78, 2.5);
    },
    // III Императрица: знак Венеры с короной
    function () {
      return '<path d="M36 20 L41 10 L50 18 L59 10 L64 20"/>' +
        '<circle cx="50" cy="42" r="16"/><path d="M50 58 V88 M38 74 H62"/>' + dot(50, 42, 3);
    },
    // IV Император: корона и трон
    function () {
      return '<path d="M28 46 V26 L39 36 L50 18 L61 36 L72 26 V46 Z"/>' + dot(50, 18, 3) +
        '<path d="M30 56 H70 V86 H30 Z M30 70 H70"/>';
    },
    // V Иерофант: два скрещённых ключа
    function () {
      var key = '<circle cx="50" cy="22" r="8"/><path d="M50 30 V84 M50 70 H59 M50 78 H59"/>';
      return '<g transform="rotate(35 50 52)">' + key + '</g><g transform="rotate(-35 50 52)">' + key + '</g>';
    },
    // VI Влюблённые: два сердца
    function () {
      return '<g transform="translate(-14 -8) scale(.85)"><path d="' + heart + '"/></g>' +
        '<g transform="translate(22 10) scale(.85)"><path d="' + heart + '"/></g>';
    },
    // VII Колесница: повозка, колёса, звезда
    function () {
      return star(50, 20, 9, 4, 5) + '<path d="M22 38 H78 L70 64 H30 Z M34 38 V30 H66 V38"/>' +
        '<circle cx="34" cy="72" r="10"/><circle cx="66" cy="72" r="10"/>' + dot(34, 72) + dot(66, 72);
    },
    // VIII Сила: голова льва и знак бесконечности
    function () {
      return lemn(50, 16, 14, 7) + '<circle cx="50" cy="58" r="15"/>' + rays(50, 58, 20, 29, 16, 0, true) +
        dot(44, 55, 2.5) + dot(56, 55, 2.5) + '<path d="M45 64 Q50 68 55 64"/>';
    },
    // IX Отшельник: фонарь со звездой
    function () {
      return '<path d="M50 10 V20 M36 30 L50 20 L64 30 Z M38 30 H62 V62 H38 Z M36 62 H64 L59 70 H41 Z"/>' +
        star(50, 46, 8, 3.2, 6, 'fill="currentColor" stroke="none"') +
        rays(50, 46, 24, 32, 6, Math.PI / 6);
    },
    // X Колесо Фортуны
    function () {
      return '<circle cx="50" cy="50" r="32"/><circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="7"/>' +
        rays(50, 50, 7, 24, 8) + rays(50, 50, 32, 38, 8, Math.PI / 8);
    },
    // XI Справедливость: весы
    function () {
      return '<path d="M50 16 V84 M36 84 H64 M20 28 H80"/>' + dot(50, 16, 3.5) +
        '<path d="M20 28 L11 52 M20 28 L29 52 M9 52 Q20 62 31 52 Z"/>' +
        '<path d="M80 28 L71 52 M80 28 L89 52 M69 52 Q80 62 91 52 Z"/>';
    },
    // XII Пауза: перекладина, перевёрнутый треугольник, сияние
    function () {
      return '<path d="M20 16 H80 M28 16 V24 M72 16 V24 M50 16 V34"/>' +
        '<path d="M36 36 H64 L50 60 Z"/><circle cx="50" cy="72" r="8"/>' + rays(50, 72, 12, 17, 10);
    },
    // XIII Перемены: роза и восходящее солнце
    function () {
      var p = '', i, a;
      for (i = 0; i < 5; i++) {
        a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        p += '<circle cx="' + f(50 + Math.cos(a) * 11) + '" cy="' + f(40 + Math.sin(a) * 11) + '" r="10"/>';
      }
      return p + '<circle cx="50" cy="40" r="5"/>' + dot(50, 40, 2.5) +
        '<path d="M50 56 V88 M50 74 Q38 70 34 62 Q46 62 50 70"/>' +
        '<path d="M14 88 H86"/>';
    },
    // XIV Умеренность: две чаши и струя
    function () {
      return '<path d="M18 30 H42 L38 50 H22 Z M30 50 V60 M23 60 H37"/>' +
        '<path d="M58 54 H82 L78 74 H62 Z M70 74 V84 M63 84 H77"/>' +
        '<path d="M42 32 C58 30 64 40 66 54" stroke-dasharray="2 5"/>' + star(50, 14, 6, 2.5, 4, 'fill="currentColor" stroke="none"');
    },
    // XV Искушение: цепь с раскрытым звеном
    function () {
      return '<g transform="rotate(-30 50 50)">' +
        '<rect x="12" y="42" width="28" height="16" rx="8"/>' +
        '<rect x="34" y="42" width="28" height="16" rx="8"/>' +
        '<path d="M60 44 A8 8 0 0 1 68 42 H76 A8 8 0 0 1 76 58 H68"/>' +
        '</g>' + star(78, 22, 6, 2.5, 4, 'fill="currentColor" stroke="none"');
    },
    // XVI Башня: башня и молния
    function () {
      return '<path d="M38 86 V38 H62 V86 Z M35 38 V28 H41 V33 H47 V28 H53 V33 H59 V28 H65 V38"/>' +
        '<path d="M46 86 V72 A4 4 0 0 1 54 72 V86 M46 50 H54 V58 H46 Z"/>' +
        '<path d="M82 8 L68 26 L76 28 L64 44" stroke-width="3.5"/>';
    },
    // XVII Звезда: большая звезда и малые звёзды
    function () {
      return star(50, 46, 26, 9, 8) + star(18, 18, 5, 2, 4, 'fill="currentColor" stroke="none"') +
        star(82, 20, 6, 2.4, 4, 'fill="currentColor" stroke="none"') + star(20, 80, 4, 1.6, 4, 'fill="currentColor" stroke="none"') +
        star(80, 82, 5, 2, 4, 'fill="currentColor" stroke="none"') + '<circle cx="50" cy="46" r="4"/>';
    },
    // XVIII Луна: большой месяц, капли, две башенки
    function () {
      return '<path d="M62 17.2 A24 24 0 1 0 62 58.8 A26 26 0 0 1 62 17.2 Z"/>' +
        '<path d="M74 34 q3 5 0 7 q-3 -2 0 -7 Z M80 48 q3 5 0 7 q-3 -2 0 -7 Z"/>' +
        '<path d="M14 88 V72 H24 V88 M76 88 V72 H86 V88 M10 88 H90"/>';
    },
    // XIX Солнце: солнце с лицом
    function () {
      return '<circle cx="50" cy="50" r="18"/>' + rays(50, 50, 23, 38, 16, 0, true) +
        dot(43, 46, 2.5) + dot(57, 46, 2.5) + '<path d="M42 56 Q50 62 58 56"/>';
    },
    // XX Суд: труба и лучи
    function () {
      return '<path d="M20 80 L58 42 M24 84 L62 46 M20 80 L24 84"/>' +
        '<path d="M56 40 L74 18 Q84 28 82 40 L64 48 Z"/>' + rays(78, 30, 18, 26, 5, -Math.PI / 2.4);
    },
    // XXI Мир: венок со звездой
    function () {
      var leaves = '', i, a, x, y;
      for (i = 0; i < 16; i++) {
        a = i * 2 * Math.PI / 16;
        x = 50 + Math.cos(a) * 22; y = 50 + Math.sin(a) * 33;
        leaves += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="3" ry="6" transform="rotate(' + f(a * 180 / Math.PI) + ' ' + f(x) + ' ' + f(y) + ')"/>';
      }
      return '<ellipse cx="50" cy="50" rx="22" ry="33"/>' + leaves + star(50, 50, 10, 4, 5, 'fill="currentColor" stroke="none"');
    }
  ];

  /* Значки 12 знаков зодиака, поле 48×48. */
  var ZODIAC = {
    aries: 'M8 20 A8 8 0 1 1 24 20 V42 M24 20 A8 8 0 1 1 40 20',
    taurus: 'M7 7 Q24 26 41 7 M13 31 A11 11 0 1 0 35 31 A11 11 0 1 0 13 31',
    gemini: 'M9 8 Q24 14 39 8 M9 40 Q24 34 39 40 M18 11 V37 M30 11 V37',
    cancer: 'M8 19 A5.5 5.5 0 1 0 19 19 A5.5 5.5 0 1 0 8 19 M13 13.5 C22 6 34 7 42 15 M29 29 A5.5 5.5 0 1 0 40 29 A5.5 5.5 0 1 0 29 29 M35 34.5 C26 42 14 41 6 33',
    leo: 'M20 32 A6 6 0 1 1 8 32 A6 6 0 1 1 20 32 C20 22 13 17 17 11 C21 5 33 6 33 14 C33 22 25 27 27 35 C29 42 37 43 42 37',
    virgo: 'M6 14 Q10 10 12 14 V38 M12 18 Q17 9 22 16 V38 M22 18 Q27 9 32 16 V31 C32 41 41 41 42 33 C43 26 34 26 32 32 C30 38 29 42 27 45',
    libra: 'M6 40 H42 M6 31 H16 A10 10 0 1 1 32 31 H42',
    scorpio: 'M5 14 Q9 10 11 14 V36 M11 18 Q16 9 21 16 V36 M21 18 Q26 9 31 16 V34 Q31 41 39 40 L44 36 M44 36 L37 34 M44 36 L42 43',
    sagittarius: 'M8 40 L40 8 M25 8 H40 V23 M14 22 L26 34',
    capricorn: 'M6 12 Q10 9 12 15 V36 M12 19 Q16 8 22 14 V31 C22 41 36 43 38 34 C40 26 30 24 28 31 C26 39 22 43 16 45',
    aquarius: 'M6 21 L13 15 L20 21 L27 15 L34 21 L41 15 M6 35 L13 29 L20 35 L27 29 L34 35 L41 29',
    pisces: 'M12 6 Q26 24 12 42 M36 6 Q22 24 36 42 M9 24 H39'
  };

  window.ART = {
    tarot: function (n) {
      return '<svg class="tarot-sym" viewBox="0 0 100 100" aria-hidden="true" ' + S + ' stroke-width="3">' + TAROT[n]() + '</svg>';
    },
    zodiac: function (id) {
      return '<svg class="zodiac-sym" viewBox="0 0 48 48" aria-hidden="true" ' + S + ' stroke-width="3.4"><path d="' + ZODIAC[id] + '"/></svg>';
    },
    /* Рубашка карты */
    cardBack: function () {
      return '<svg class="card-back-art" viewBox="0 0 120 200" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><pattern id="cbp" width="20" height="20" patternUnits="userSpaceOnUse">' +
        '<path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="#f3cf73" stroke-opacity=".22" stroke-width="1"/>' +
        '</pattern></defs>' +
        '<rect x="8" y="8" width="104" height="184" rx="8" fill="url(#cbp)" stroke="#f3cf73" stroke-width="2"/>' +
        '<rect x="14" y="14" width="92" height="172" rx="6" fill="none" stroke="#f3cf73" stroke-opacity=".6" stroke-width="1"/>' +
        '</svg>' +
        '<svg class="card-back-emblem" viewBox="0 0 100 100" aria-hidden="true" ' + S + ' stroke-width="2.5" style="color:#f3cf73">' +
        '<circle cx="50" cy="50" r="30"/>' + star(50, 50, 22, 8, 8, 'fill="currentColor" fill-opacity=".25"') +
        '<path d="M62 30 A16 16 0 1 0 62 58 A14 14 0 0 1 62 30 Z" fill="#1c1450"/>' +
        rays(50, 50, 34, 42, 16, 0, true) + '</svg>';
    },
    /* Значки плиток главного экрана */
    iconCard: function () {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" ' + S + ' stroke-width="2.6">' +
        '<rect x="10" y="12" width="26" height="40" rx="4" transform="rotate(-12 23 32)"/>' +
        '<rect x="26" y="10" width="28" height="44" rx="4" fill="#2a1f66"/>' +
        star(40, 32, 9, 3.6, 8, 'fill="currentColor" stroke="none"') + '</svg>';
    },
    iconBall: function () {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" ' + S + ' stroke-width="2.6">' +
        '<circle cx="32" cy="28" r="20"/><path d="M22 20 Q26 13 33 12"/>' +
        '<path d="M16 52 H48 L44 44 H20 Z"/>' + star(36, 30, 6, 2.4, 4, 'fill="currentColor" stroke="none"') + '</svg>';
    },
    iconHoro: function () {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" ' + S + ' stroke-width="2.6">' +
        '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="14"/>' + rays(32, 32, 14, 24, 12) +
        dot(32, 32, 4) + '</svg>';
    },
    iconCompat: function () {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" ' + S + ' stroke-width="2.6">' +
        '<circle cx="24" cy="39" r="13"/><circle cx="40" cy="39" r="13"/>' +
        '<path d="M32 15 C28.5 9.5 21 10.5 21.5 16 C22 20.5 32 26 32 26 C32 26 42 20.5 42.5 16 C43 10.5 35.5 9.5 32 15 Z" fill="currentColor" stroke="none"/>' +
        '</svg>';
    },
    heart: function () {
      return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 86 C20 64 12 40 28 30 C40 22 48 30 50 38 C52 30 60 22 72 30 C88 40 80 64 50 86 Z" fill="currentColor"/></svg>';
    },
    moon: function () {
      return '<svg class="moon" viewBox="0 0 100 100" aria-hidden="true">' +
        '<defs><radialGradient id="mg" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e9b949"/></radialGradient></defs>' +
        '<path d="M62 12 A40 40 0 1 0 62 88 A34 34 0 0 1 62 12 Z" fill="url(#mg)"/></svg>';
    },
    /* Хрустальный шар для «Да или нет» */
    ball: function () {
      return '<svg class="ball-svg" viewBox="0 0 200 220" aria-hidden="true">' +
        '<defs>' +
        '<radialGradient id="bg1" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#9f8cff"/><stop offset=".45" stop-color="#4a2fa8"/><stop offset="1" stop-color="#160c3e"/></radialGradient>' +
        '<radialGradient id="bg2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d77e"/><stop offset="1" stop-color="#a5741f"/></linearGradient>' +
        '</defs>' +
        '<circle class="ball-glow" cx="100" cy="92" r="92" fill="url(#bg2)" opacity=".25"/>' +
        '<circle cx="100" cy="92" r="78" fill="url(#bg1)" stroke="#f3cf73" stroke-width="3"/>' +
        '<g class="ball-mist" style="transform-origin:100px 92px">' +
        '<path d="M50 100 C70 70 110 120 140 86 C150 76 156 92 150 104 C130 130 80 120 50 100 Z" fill="#c9b8ff" opacity=".35"/>' +
        '<path d="M60 74 C90 60 120 90 146 70 C140 60 120 50 100 54 C82 56 66 64 60 74 Z" fill="#fff" opacity=".18"/>' +
        '</g>' +
        '<g class="ball-stars" fill="#fff4cf">' +
        '<polygon points="' + starPts(78, 70, 6, 2, 4) + '"/>' +
        '<polygon points="' + starPts(124, 112, 5, 1.8, 4) + '"/>' +
        '<polygon points="' + starPts(118, 64, 3.5, 1.3, 4) + '"/>' +
        '<polygon points="' + starPts(84, 120, 3.5, 1.3, 4) + '"/>' +
        '</g>' +
        '<path d="M58 60 Q70 38 96 34" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M44 196 H156 L142 166 H58 Z" fill="url(#bs)" stroke="#6b4a12" stroke-width="2"/>' +
        '<rect x="34" y="196" width="132" height="14" rx="6" fill="url(#bs)" stroke="#6b4a12" stroke-width="2"/>' +
        '</svg>';
    },
    /* Звёздное небо — фон */
    sky: function () {
      var seed = 7, i, out = '';
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
      for (i = 0; i < 140; i++) {
        var x = f(rnd() * 100), y = f(rnd() * 100), r = f(0.6 + rnd() * 1.4), o = f(0.35 + rnd() * 0.6);
        var tw = i % 9 === 0 ? ' class="tw" style="animation-delay:' + f(rnd() * 4) + 's"' : '';
        out += '<circle cx="' + x + '%" cy="' + y + '%" r="' + r + '" fill="#fff6dc" opacity="' + o + '"' + tw + '/>';
      }
      return '<svg width="100%" height="100%" aria-hidden="true">' + out + '</svg>';
    },
    starPts: starPts
  };
})();
