/* Открытки «Поделиться» именно этого приложения (рисует share.js, графика — из art.js).
 * Каждая функция возвращает draw(pc) для Share.open({ draw }). Размер 1080×1350.
 * В другом мини-приложении этот файл пишется заново (свои открытки), share.js остаётся тем же.
 */
(function () {
  'use strict';
  var ART = window.ART;
  var HEART = '<svg viewBox="0 0 100 100"><path d="M50 86 C20 64 12 40 28 30 C40 22 48 30 50 38 C52 30 60 22 72 30 C88 40 80 64 50 86 Z" fill="currentColor"/></svg>';

  function roman(n) {
    if (n === 0) return '0';
    var map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], out = '';
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }
  function topLabel(pc, text, y) {
    return pc.text(text.toUpperCase(), { y: y || 112, size: 40, font: 'sans', weight: 'bold', color: pc.colors.gold, spacing: 5, maxWidth: 900, minSize: 30, maxLines: 1 });
  }
  /* Круг со значком знака. */
  function glyphCircle(pc, id, cx, cy, r) {
    var ctx = pc.ctx;
    var g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(243,207,115,.32)'); g.addColorStop(1, 'rgba(10,6,40,.75)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pc.colors.gold; ctx.lineWidth = 5; ctx.stroke();
    var s = r * 1.15;
    return pc.svg(ART.zodiac(id), cx - s / 2, cy - s / 2, s, s, pc.colors.gold);
  }

  window.Postcards = {
    /* Карта дня: card — из content/tarot.js, date — «11 ноября». */
    card: function (card, date) {
      return function (pc) {
        var ctx = pc.ctx, cw = 400, ch = 640, cx = (pc.W - cw) / 2, cy = 180;
        pc.background(); pc.frame();
        topLabel(pc, 'Моя карта дня', 96);
        // сама карта
        ctx.save();
        ctx.shadowColor = 'rgba(243,207,115,.45)'; ctx.shadowBlur = 50;
        pc.roundRect(cx, cy, cw, ch, 26);
        var g = ctx.createLinearGradient(0, cy, 0, cy + ch);
        g.addColorStop(0, '#fff6dd'); g.addColorStop(1, '#f5e2b0');
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
        ctx.lineWidth = 12; ctx.strokeStyle = '#2a1d66';
        pc.roundRect(cx, cy, cw, ch, 26); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = pc.colors.gold;
        pc.roundRect(cx + 18, cy + 18, cw - 36, ch - 36, 16); ctx.stroke();
        pc.text(roman(card.n), { y: cy + 40, size: 54, weight: 'bold', color: '#6a3f0e' });
        pc.text(card.name, { y: cy + ch - 104, size: 46, minSize: 26, weight: 'bold', color: '#3a2470', maxWidth: cw - 70, maxLines: 1 });
        return pc.svg(ART.tarot(card.n), cx + 50, cy + 120, cw - 100, cw - 100, '#3a2470').then(function () {
          var y = pc.text(card.name, { y: cy + ch + (card.oldName ? 34 : 46), size: 84, minSize: 56, weight: 'bold', color: pc.colors.gold, maxLines: 1, maxWidth: 900, shadow: 'rgba(243,207,115,.4)' });
          // смягчённые названия: классическое имя мелко, как в приложении
          if (card.oldName) y = pc.text('в старых колодах — «' + card.oldName + '»', { y: y + 2, size: 32, font: 'sans', italic: true, color: pc.colors.text2, maxLines: 1 });
          pc.text('«' + card.motto + '»', { y: y + (card.oldName ? 12 : 16), size: 50, minSize: 40, italic: true, color: pc.colors.text, maxLines: 2, maxWidth: 880 });
          pc.footer(date);
        });
      };
    },
    /* Гороскоп знака: sign — из content/zodiac.js, date — «11 ноября», advice — совет дня. */
    horo: function (sign, date, advice) {
      return function (pc) {
        pc.background(); pc.frame();
        topLabel(pc, 'Гороскоп на ' + date, 104);
        return glyphCircle(pc, sign.id, pc.W / 2, 370, 170).then(function () {
          var y = pc.text(sign.name, { y: 572, size: 104, minSize: 70, weight: 'bold', color: pc.colors.gold, maxLines: 1, shadow: 'rgba(243,207,115,.4)' });
          y = pc.text(sign.from + ' – ' + sign.to, { y: y + 4, size: 38, font: 'sans', color: pc.colors.text2 });
          y = pc.text('СОВЕТ ДНЯ', { y: y + 46, size: 34, font: 'sans', weight: 'bold', color: pc.colors.gold, spacing: 4 });
          // совет — по центру свободного места до подписи; короткий — крупнее
          var opt = { y: 0, size: advice.length < 70 ? 64 : 56, minSize: 38, color: pc.colors.text, maxLines: 4, maxWidth: 860, dry: true };
          var top = y + 18, room = pc.H - 220 - top, h = pc.text(advice, opt);
          opt.dry = false;
          opt.y = top + Math.max(0, (room - h) / 2);
          pc.text(advice, opt);
          pc.footer('Гороскоп на каждый день');
        });
      };
    },
    /* Совместимость: a, b — знаки, res — результат compatFor(). */
    compat: function (a, b, res) {
      return function (pc) {
        pc.background(); pc.frame();
        topLabel(pc, 'Совместимость знаков', 104);
        return glyphCircle(pc, a.id, 290, 350, 140).then(function () {
          return glyphCircle(pc, b.id, pc.W - 290, 350, 140);
        }).then(function () {
          return pc.svg(HEART, pc.W / 2 - 58, 292, 116, 116, '#ff9fb0');
        }).then(function () {
          var y = pc.text(a.name + ' + ' + b.name, { y: 530, size: 76, minSize: 50, weight: 'bold', color: pc.colors.text, maxLines: 1, maxWidth: 920 });
          y = pc.text(res.n + '%', { y: y + 10, size: 190, weight: 'bold', color: pc.colors.gold, shadow: 'rgba(243,207,115,.45)' });
          y = pc.text(res.label, { y: y - 6, size: 44, font: 'sans', weight: 'bold', color: pc.colors.text2 });
          pc.text('«' + res.t + '»', { y: y + 34, size: 60, minSize: 44, italic: true, color: pc.colors.text, maxLines: 2, maxWidth: 880 });
          pc.footer('Узнайте совместимость своих знаков');
        });
      };
    },
    /* Ответ шара: answer — из content/yesno.js (только обычные ответы, не «заботливые»). */
    yesno: function (answer) {
      var colors = { yes: '#9df0b4', no: '#ffb3a1', maybe: '#c9bcff' };
      return function (pc) {
        pc.background(); pc.frame();
        topLabel(pc, 'Волшебный шар ответил', 104);
        return pc.svg(ART.ball(), pc.W / 2 - 190, 180, 380, 418).then(function () {
          var y = pc.text(answer.title, { y: 650, size: 112, minSize: 70, weight: 'bold', color: colors[answer.kind] || pc.colors.gold, maxLines: 2, maxWidth: 900, lineHeight: 1.1, shadow: 'rgba(0,0,0,.35)' });
          pc.text(answer.text, { y: y + 30, size: 50, minSize: 40, color: pc.colors.text, maxLines: 3, maxWidth: 860 });
          pc.footer('Задайте свой вопрос');
        });
      };
    }
  };
})();
