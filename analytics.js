/* analytics.js — маленькие события статистики через Playgama Bridge (Platform.sendEvent).
 * Если Bridge их не принимает (страница вне площадки) — тихо ничего не делает.
 *
 *   Analytics.event('card_drawn', { card: 17 });
 *
 * Правила (docs/analytics.md):
 *   - имя события — короткое, snake_case, без чисел внутри; числа и слова — в данных;
 *   - данные — только строки (до 40 знаков), числа и да/нет; вложенных объектов нет;
 *   - никаких личных данных: текст вопроса, имя, id человека не отправлять никогда;
 *   - не дублировать то, что Bridge шлёт сам (запуск, сессии, реклама, game_ready).
 * Последние события видны в window.__analyticsLog (для проверки).
 * Переносится в другие мини-приложения без правок.
 */
(function () {
  'use strict';
  var started = Date.now();
  var log = window.__analyticsLog = [];
  var firstInput = false;

  function clean(data) {
    var out = {}, k, v;
    if (!data) return out;
    for (k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      v = data[k];
      if (typeof v === 'string') out[k] = v.slice(0, 40);
      else if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  var A = window.Analytics = {
    event: function (name, data) {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;
      var d = clean(data);
      var sent = false;
      try { sent = !!(window.Platform && window.Platform.sendEvent(name, d)); } catch (e) { sent = false; }
      log.push({ name: name, data: d, sent: sent, t: Math.round((Date.now() - started) / 100) / 10 });
      if (log.length > 200) log.shift();
    },
    /* Секунды от запуска — для first_input. */
    seconds: function () { return Math.round((Date.now() - started) / 100) / 10; }
  };

  /* Первое действие человека (нажатие или клавиша) — один раз. */
  function onFirst() {
    if (firstInput) return;
    firstInput = true;
    document.removeEventListener('pointerdown', onFirst, true);
    document.removeEventListener('keydown', onFirst, true);
    A.event('first_input', { sec: A.seconds() });
  }
  document.addEventListener('pointerdown', onFirst, true);
  document.addEventListener('keydown', onFirst, true);
})();
