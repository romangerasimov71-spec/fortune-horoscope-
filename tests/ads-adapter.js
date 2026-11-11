// Адаптер набора проверки рекламы (tests/ads-test) для «Гаданий и гороскопа».
//   python3 -m http.server 8765 --bind 127.0.0.1 &
//   NODE_PATH=/opt/node-tools/node_modules node tests/ads-test/run.js --url http://127.0.0.1:8765/index.html --adapter tests/ads-adapter.js
//
// Что здесь «награда»: гороскоп на завтра для знака (кнопка на экране знака, #/horo/leo).
// «Поле» (boardWorks): на экране знака — кнопка «Запомнить как мой знак» (нажать и вернуть),
// на главном — плитка «Да или нет» (открыть и вернуться). Нажимаем мышью по точке, поэтому
// если экран закрыт «Загружаем рекламу…», нажатие до кнопки не доходит — и это видно.
// «Попытка» — один заход на экран знака: опоздавшая реклама даёт награду, только если человек
// всё ещё на том же экране (вышел и зашёл снова или открыл другой знак — награды нет).
const started = (page) => page.waitForFunction(() => window.__fh && window.__fh.started(), null, { timeout: 15000 });

async function openSign(page, id) {
  await page.evaluate((h) => { location.hash = h; }, '#/horo/' + id);
  await page.waitForFunction((h) => document.getElementById('app').getAttribute('data-hash') === h, '#/horo/' + id);
  await page.waitForTimeout(150);
}
// Нажать мышью в середину элемента; вернуть false, если сверху его что-то закрывает.
async function clickIfFree(page, selector) {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, free: !!top && (top === el || el.contains(top)) };
  }, selector);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(150);
  return box.free;
}

module.exports = {
  name: 'Гадания и гороскоп',
  viewport: { width: 390, height: 844 },
  contextOptions: { locale: 'ru-RU' },
  rewardTimeoutMs: 10000,              // config.js: ads.rewardTimeoutMs
  interstitialSilentWaitMs: 3000,
  lateRewardGranted: true,             // опоздала, человек всё ещё на этом экране — гороскоп на завтра открываем

  async prepare(page, { kind }) {
    await started(page);
    if (kind === 'rewarded') {
      await openSign(page, 'leo');
      await page.waitForSelector('[data-action="tomorrow"]', { timeout: 5000 });
    } else {
      // межстраничная — сразу при возврате на главный (без 3 минут и 2 результатов)
      await page.evaluate(() => window.__fh.adsDebug({ gap: 0, results: 0 }));
    }
  },

  async clickRewarded(page) { await page.click('[data-action="tomorrow"]'); },

  async rewardCount(page) { return page.evaluate(() => window.__fh.tomorrowCount()); },

  async triggerInterstitial(page) {
    await page.click('[data-go="#/card"]');
    await page.waitForSelector('.screen-card');
    await page.click('.btn-back');                       // естественная пауза: возврат на главный
    await page.waitForFunction(() => window.__adsKit.calls.interstitial > 0, null, { timeout: 4000 }).catch(() => {});
    // дальше обычная частота, чтобы проверки «поле работает» не вызывали новых показов
    await page.evaluate(() => window.__fh.adsDebug({ gap: 1e9, results: 2 }));
  },

  // «Заново»: вышел с экрана знака и зашёл на тот же знак снова
  async restartLevel(page) {
    await page.click('.btn-back');
    await page.waitForSelector('.screen-horo');
    await page.click('.signs [data-go="#/horo/leo"]');
    await page.waitForSelector('.screen-sign');
  },
  // «Другой уровень»: открыл другой знак
  async switchLevel(page) {
    await page.click('.btn-back');
    await page.waitForSelector('.screen-horo');
    await page.click('.signs [data-go="#/horo/virgo"]');
    await page.waitForSelector('.screen-sign');
  },
  // «Победы» у приложения нет — случай rewarded-late-win будет SKIP.

  async isPaused(page) { return page.evaluate(() => window.__fh.isPaused()); },

  async boardWorks(page) {
    const screen = await page.evaluate(() => document.getElementById('app').className);
    if (screen.indexOf('screen-sign') >= 0) {
      const before = await page.getAttribute('[data-action="mine"]', 'aria-pressed');
      const free = await clickIfFree(page, '[data-action="mine"]');
      const after = await page.getAttribute('[data-action="mine"]', 'aria-pressed');
      if (after !== before) await clickIfFree(page, '[data-action="mine"]');   // вернуть как было
      return free && after !== before;
    }
    if (screen.indexOf('screen-home') >= 0) {
      const free = await clickIfFree(page, '[data-go="#/yesno"]');
      const opened = await page.evaluate(() => document.getElementById('app').className.indexOf('screen-yesno') >= 0);
      if (opened) { await page.click('.btn-back'); await page.waitForSelector('.screen-home'); }
      return free && opened;
    }
    return false;
  },

  async buttonsWork(page) {
    return page.evaluate(() => {
      const app = document.getElementById('app');
      if (app.hasAttribute('inert') || window.__fh.adWaiting()) return false;
      const b = app.querySelector('.btn-back') || app.querySelector('.tile');
      if (!b || b.disabled) return false;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === b || b.contains(top));
    });
  }
};
