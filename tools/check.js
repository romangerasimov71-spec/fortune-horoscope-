#!/usr/bin/env node
/* Самопроверка «Гаданий и гороскопа» в Chromium (Playwright).
 *
 *   python3 -m http.server 8765 --bind 127.0.0.1 &
 *   NODE_PATH=/opt/node-tools/node_modules node tools/check.js [--url http://127.0.0.1:8765/] [--shots]
 *
 * --shots — сохранить скриншоты и открытки в docs/screens/.
 * Проверяет: тексты совместимости (78 пар, симметрия, соседние пары не повторяются), гороскоп на завтра
 * совпадает с «сегодня» на следующий день, все экраны на 360×640, 640×360, 1280×800 (нет ошибок консоли,
 * нет горизонтальной прокрутки, текст ≥16px, кнопки ≥48px), работа без Bridge, пробная реклама
 * (досмотрена / закрыта / ошибка), редкая межстраничная, сохранение, окно «Поделиться» (сайт, ВК, ОК).
 * Код выхода 0 — всё хорошо.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const URL = (argv.indexOf('--url') >= 0 ? argv[argv.indexOf('--url') + 1] : 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const SHOTS = argv.includes('--shots');
const SHOT_DIR = path.join(__dirname, '..', 'docs', 'screens');
let fails = 0;
function ok(cond, what, extra) {
  if (!cond) fails++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + what + (extra ? '  (' + extra + ')' : ''));
}
const VIEWPORTS = [
  { name: 'telefon', width: 360, height: 640, mobile: true },
  { name: 'albom', width: 640, height: 360, mobile: true },
  { name: 'kompyuter', width: 1280, height: 800, mobile: false }
];
const NOON = new Date(2026, 10, 11, 12, 0, 0).getTime();   // 11 ноября 2026, полдень (местное время)

async function newPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: 1, locale: 'ru-RU', acceptDownloads: true
  });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.errs.push(m.type() + ': ' + m.text()); });
  if (opts.time) await page.clock.setFixedTime(opts.time);
  if (opts.blockBridge) await page.route('**/playgama-bridge.js', (r) => r.abort());
  await page.goto(URL + (opts.query || '') + (opts.hash || ''));
  await page.waitForFunction(() => window.__fh && window.__fh.started(), null, { timeout: 15000 });
  return { ctx, page };
}
// Видимый текст мельче 16px, низкие кнопки, горизонтальная прокрутка.
async function layoutIssues(page) {
  return page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('горизонтальная прокрутка ' + document.documentElement.scrollWidth);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('[hidden], svg, noscript, .fakead')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (parseFloat(cs.fontSize) < 15.9) out.push('мелкий текст ' + cs.fontSize + ': ' + n.textContent.trim().slice(0, 30));
    }
    document.querySelectorAll('button, input').forEach((b) => {
      if (b.closest('[hidden]')) return;
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (b.classList.contains('tarot')) return;
      if (r.height < 47.5) out.push('низкая кнопка ' + Math.round(r.height) + ': ' + (b.textContent || b.className).trim().slice(0, 30));
      if (r.width < 47.5) out.push('узкая кнопка ' + Math.round(r.width) + ': ' + (b.textContent || b.className).trim().slice(0, 30));
    });
    return out;
  });
}
async function shot(page, name) {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
}
async function hashIs(page, h) {
  await page.waitForFunction((x) => document.getElementById('app').getAttribute('data-hash') === x, h);
}

(async () => {
  const browser = await chromium.launch();
  if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

  /* ---------- 1. Тексты совместимости ---------- */
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON });
    const r = await page.evaluate(() => {
      const Z = window.CONTENT.zodiac.map((z) => z.id), C = window.CONTENT.compat, f = window.__fh.compatFor;
      const res = { pairs: Object.keys(C.pairs).length, asym: [], bad: [], titles: new Set(), latin: [], words: [] };
      Z.forEach((a) => Z.forEach((b) => {
        const x = f(a, b), y = f(b, a);
        if (!x || !y) { res.bad.push(a + '+' + b); return; }
        if (JSON.stringify(x) !== JSON.stringify(y)) res.asym.push(a + '+' + b);
        if (!(x.n >= 50 && x.n <= 97)) res.bad.push(a + '+' + b + ' ' + x.n);
        [x.t, x.intro, x.love, x.family, x.advice].forEach((t) => { if (!t || t.length < 5) res.bad.push(a + '+' + b + ' пусто'); });
        const all = [x.t, x.intro, x.love, x.family, x.advice].join(' ').toLowerCase();
        if (/несовмест|не подход|расстав|развод|разлук|болезн/.test(all)) res.words.push(a + '+' + b);
        res.titles.add(x.t);
      }));
      // у одного знака с тремя знаками одной стихии — три разных «любви» и три разных «семьи»
      Z.forEach((a) => ['fire', 'earth', 'air', 'water'].forEach((e) => {
        const partners = Z.filter((b) => C.elements[b] === e);
        const loves = new Set(partners.map((b) => f(a, b).love)), fams = new Set(partners.map((b) => f(a, b).family));
        if (loves.size !== 3 || fams.size !== 3) res.latin.push(a + '/' + e);
      }));
      res.titles = res.titles.size;
      return res;
    });
    ok(r.pairs === 78, 'совместимость: 78 пар в content/compat.js', r.pairs);
    ok(r.bad.length === 0, 'совместимость: у всех 144 сочетаний есть процент 50–97 и все тексты', r.bad.slice(0, 5).join(', '));
    ok(r.asym.length === 0, 'совместимость: Лев+Рыбы = Рыбы+Лев (для всех пар)', r.asym.slice(0, 5).join(', '));
    ok(r.titles === 78, 'совместимость: 78 разных заголовков', r.titles);
    ok(r.latin.length === 0, 'совместимость: у знака с тремя знаками одной стихии тексты «любовь» и «семья» не повторяются', r.latin.slice(0, 5).join(', '));
    ok(r.words.length === 0, 'совместимость: нет «несовместимы», «расставание», «развод», «болезнь»', r.words.slice(0, 5).join(', '));
    await ctx.close();
  }

  /* ---------- 2. Все экраны на трёх размерах ---------- */
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await newPage(browser, vp, { time: NOON });
    const issues = [];
    const check = async (name) => {
      const li = await layoutIssues(page);
      li.forEach((x) => issues.push(name + ': ' + x));
    };
    await check('главный'); await shot(page, vp.name + '-1-glavnyj');
    await page.click('[data-go="#/card"]'); await hashIs(page, '#/card');
    await check('карта (колода)');
    await page.click('[data-action="draw"]'); await page.waitForTimeout(1500);
    await check('карта открыта'); await shot(page, vp.name + '-2-karta-dnya');
    await page.click('[data-action="share"]'); await page.waitForSelector('.share-preview img', { timeout: 8000 });
    await check('окно поделиться'); await shot(page, vp.name + '-3-podelitsya');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => !window.Share.isOpen()), vp.name + ': Escape закрывает окно «Поделиться»');
    await page.click('.btn-back'); await hashIs(page, '#/');
    await page.click('[data-go="#/yesno"]'); await hashIs(page, '#/yesno');
    await page.fill('#q', 'Затевать ли ремонт?');
    await page.keyboard.press('Enter'); await page.waitForSelector('.answer-title', { timeout: 5000 }); await page.waitForTimeout(700);
    await check('да или нет'); await shot(page, vp.name + '-4-da-ili-net');
    await page.click('.btn-back'); await hashIs(page, '#/');
    await page.click('[data-go="#/horo"]'); await hashIs(page, '#/horo');
    await check('знаки');
    await page.click('[data-go="#/horo/scorpio"]'); await hashIs(page, '#/horo/scorpio');
    await check('знак'); await shot(page, vp.name + '-5-goroskop');
    ok(await page.evaluate(() => !document.querySelector('[data-action="tomorrow"]')), vp.name + ': вне площадки кнопки «на завтра за рекламу» нет');
    await page.click('[data-action="mine"]');
    await page.click('.btn-back'); await hashIs(page, '#/horo');
    await page.click('.btn-back'); await hashIs(page, '#/');
    await page.click('[data-go="#/compat"]'); await hashIs(page, '#/compat');
    const slotA = await page.textContent('[data-slot="a"]');
    ok(/Скорпион/.test(slotA), vp.name + ': совместимость — первым подставлен «мой знак»', slotA.trim());
    await check('совместимость: выбор'); await shot(page, vp.name + '-6-sovmestimost-vybor');
    await page.click('[data-pick="taurus"]');
    await hashIs(page, '#/compat/scorpio/taurus');
    await page.waitForTimeout(1300);
    await check('совместимость: итог'); await shot(page, vp.name + '-7-sovmestimost');
    await page.click('[data-action="new-pair"]'); await hashIs(page, '#/compat');
    await page.click('[data-slot="a"]'); await page.click('[data-pick="leo"]'); await page.click('[data-pick="pisces"]');
    await hashIs(page, '#/compat/leo/pisces');
    ok((await page.textContent('.pct-num')) === (await page.evaluate(() => window.__fh.compatFor('pisces', 'leo').n + '%')), vp.name + ': Лев+Рыбы показывает тот же процент, что Рыбы+Лев');
    ok(issues.length === 0, vp.name + ': текст ≥16px, кнопки ≥48px, нет горизонтальной прокрутки', issues.slice(0, 6).join(' | '));
    ok(page.errs.length === 0, vp.name + ': нет ошибок и предупреждений в консоли', page.errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  /* ---------- 3. Без Bridge ---------- */
  for (const opts of [{ blockBridge: true, label: 'файл Bridge не загрузился' }, { query: '?nobridge=1', label: '?nobridge=1' }]) {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], Object.assign({ time: NOON }, opts));
    const id = await page.evaluate(() => window.Platform.id);
    await page.click('[data-go="#/card"]'); await page.click('[data-action="draw"]'); await page.waitForTimeout(1300);
    await page.click('[data-action="share"]'); await page.waitForSelector('.share-preview img', { timeout: 8000 });
    const btns = await page.$$eval('.share-buttons button', (b) => b.map((x) => x.textContent));
    await page.keyboard.press('Escape');
    await page.goto(URL + (opts.query || '') + '#/'); await page.waitForFunction(() => window.__fh && window.__fh.started());
    const sub = await page.textContent('[data-go="#/card"] .tile-sub');
    const errs = page.errs.filter((e) => !/playgama-bridge|ERR_FAILED|Failed to load resource/.test(e));
    ok(id === 'web' && /Сегодня:/.test(sub) && btns.length >= 2 && errs.length === 0,
      'без Bridge (' + opts.label + '): всё работает, карта сохраняется, есть открытка', id + '; ' + btns.join(', ') + (errs.length ? '; ' + errs[0] : ''));
    await ctx.close();
  }

  /* ---------- 4. Пробная реклама: гороскоп на завтра ---------- */
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON, query: '?fakeads=1', hash: '#/horo/leo' });
    await page.waitForSelector('[data-action="tomorrow"]');
    // закрыл раньше
    await page.click('[data-action="tomorrow"]');
    await page.waitForSelector('.fakead button');
    await page.click('.fakead button');
    await page.waitForSelector('.toast.show');
    const t1 = await page.textContent('.toast');
    ok((await page.evaluate(() => window.__fh.tomorrowCount())) === 0 && /досмотреть/.test(t1), 'реклама закрыта раньше → гороскопа на завтра нет, вежливая плашка', t1);
    // досмотрел
    await page.click('[data-action="tomorrow"]');
    await page.waitForSelector('.fakead button');
    await page.waitForFunction(() => /Закрыть$/.test(document.querySelector('.fakead button').textContent), null, { timeout: 8000 });
    await page.click('.fakead button');
    await page.waitForSelector('.tomorrow.is-open');
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('tomorrow').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(4200);
    await shot(page, 'telefon-8-goroskop-na-zavtra');
    const tomorrowText = await page.$$eval('.tomorrow .horo-part .text', (p) => p.map((x) => x.textContent));
    ok(tomorrowText.length === 5, 'досмотрел рекламу → открылся гороскоп на завтра (5 частей)');
    await page.reload(); await page.waitForFunction(() => window.__fh && window.__fh.started());
    ok(await page.isVisible('.tomorrow.is-open'), 'после перезахода в тот же день гороскоп на завтра открыт без рекламы');
    await page.goto(URL + '?fakeads=1#/horo/virgo'); await page.waitForFunction(() => window.__fh && window.__fh.started());
    ok(await page.isVisible('[data-action="tomorrow"]'), 'у другого знака «на завтра» — снова за рекламу');
    // на следующий день «сегодня» = вчерашнее «завтра»
    await page.clock.setFixedTime(NOON + 86400000);
    await page.goto(URL + '?fakeads=1#/horo/leo'); await page.waitForFunction(() => window.__fh && window.__fh.started());
    const todayText = await page.$$eval('.screen-sign > .horo-part .text', (p) => p.map((x) => window.__fh.toTomorrow(x.textContent)));
    ok(JSON.stringify(todayText) === JSON.stringify(tomorrowText), 'завтра «сегодня» совпадает со вчерашним «на завтра» (в нём «сегодня» сказано как «завтра»)');
    ok(await page.isVisible('[data-action="tomorrow"]'), 'на следующий день «на завтра» снова за рекламу');
    ok(page.errs.length === 0, 'пробная реклама: нет ошибок в консоли', page.errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  for (const mode of ['fail', 'silent']) {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON, query: '?fakeads=' + mode, hash: '#/horo/leo' });
    await page.click('[data-action="tomorrow"]');
    await page.waitForSelector('.toast.show', { timeout: 14000 });
    const t = await page.textContent('.toast');
    const works = await page.evaluate(() => !document.getElementById('app').hasAttribute('inert') && document.getElementById('adwait').hidden);
    ok(/не загрузилась/.test(t) && works && (await page.evaluate(() => window.__fh.tomorrowCount())) === 0,
      'реклама ' + (mode === 'fail' ? 'с ошибкой' : 'молчит') + ' → «Реклама не загрузилась, попробуйте позже», ничего не зависло', t);
    await ctx.close();
  }

  /* ---------- 5. Межстраничная: редко и только на главном ---------- */
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON, query: '?fakeads=1' });
    const shown = () => page.evaluate(() => !!document.querySelector('.fakead'));
    const visit = async (hash) => {
      await page.click('[data-go="' + hash + '"]'); await hashIs(page, hash);
      if (hash === '#/card') { const d = await page.$('[data-action="draw"]'); if (d) { await d.click(); await page.waitForTimeout(1200); } }
      await page.click('.btn-back'); await hashIs(page, '#/'); await page.waitForTimeout(900);
    };
    await visit('#/card');
    await page.click('[data-go="#/horo"]'); await hashIs(page, '#/horo');
    await page.click('[data-go="#/horo/leo"]'); await hashIs(page, '#/horo/leo');
    await page.click('.btn-back'); await hashIs(page, '#/horo');
    await page.click('.btn-back'); await hashIs(page, '#/'); await page.waitForTimeout(900);
    ok(!(await shown()), 'межстраничная: в первые 3 минуты не показывается');
    await page.clock.setFixedTime(NOON + 181000);
    await page.click('[data-go="#/horo"]'); await hashIs(page, '#/horo');
    await page.click('.btn-back'); await hashIs(page, '#/'); await page.waitForTimeout(900);
    ok(await shown(), 'межстраничная: через 3 минуты и после 2 результатов — при возврате на главный');
    await page.waitForFunction(() => /Закрыть$/.test((document.querySelector('.fakead button') || {}).textContent || ''), null, { timeout: 6000 });
    await page.click('.fakead button');
    await page.clock.setFixedTime(NOON + 240000);
    await visit('#/card'); await visit('#/horo');
    ok(!(await shown()), 'межстраничная: следующая — не раньше чем через 3 минуты');
    ok(page.errs.length === 0, 'межстраничная: нет ошибок в консоли', page.errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  /* ---------- 6. «Поделиться» в ВК и ОК (вид окна, ?simulate=) ---------- */
  for (const kind of ['vk', 'ok']) {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON, query: '?simulate=' + kind, hash: '#/compat/leo/pisces' });
    await page.click('[data-action="share"]');
    if (kind === 'vk') await page.waitForSelector('.share-preview img', { timeout: 8000 });
    else await page.waitForTimeout(1500);
    const btns = await page.$$eval('.share-buttons button', (b) => b.map((x) => x.textContent));
    await page.waitForTimeout(300);
    await shot(page, 'telefon-9-podelitsya-' + kind);
    await page.click('.share-buttons button');
    await page.waitForSelector('.toast.show');
    const t = await page.textContent('.toast');
    ok(kind === 'vk' ? btns[0] === 'В историю ВКонтакте' && btns.includes('Отправить ссылкой') : btns[0] === 'Опубликовать в ленте ОК',
      'поделиться в ' + kind.toUpperCase() + ': ' + btns.join(', '), t);
    await ctx.close();
  }

  /* ---------- 7. Открытки ---------- */
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0], { time: NOON });
    const list = [['karta-dnya', ['card', 17]], ['goroskop', ['horo', 'scorpio']], ['sovmestimost', ['compat', 'leo', 'pisces']], ['otvet-shara', ['yesno', 2]]];
    for (const [name, args] of list) {
      const data = await page.evaluate((a) => window.__fh.postcard(a[0], a[1], a[2]).then((c) => ({ w: c.width, h: c.height, url: c.toDataURL('image/jpeg', 0.9) })), args);
      ok(data.w === 1080 && data.h === 1350 && data.url.length > 50000, 'открытка «' + name + '» рисуется (1080×1350)', Math.round(data.url.length / 1024) + ' КБ');
      if (SHOTS) fs.writeFileSync(path.join(SHOT_DIR, 'otkrytka-' + name + '.jpg'), Buffer.from(data.url.split(',')[1], 'base64'));
    }
    // «Сохранить картинку» скачивает файл
    await page.goto(URL + '#/horo/leo'); await page.waitForFunction(() => window.__fh && window.__fh.started());
    await page.click('[data-action="share"]');
    await page.waitForSelector('[data-how="save"]:not([disabled])', { timeout: 8000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-how="save"]')]);
    ok(/goroskop-leo\.jpg$/.test(dl.suggestedFilename()), '«Сохранить картинку» скачивает открытку', dl.suggestedFilename());
    // в статистику не уходит текст вопроса
    await page.goto(URL + '#/yesno'); await page.waitForFunction(() => window.__fh && window.__fh.started());
    await page.fill('#q', 'секретный вопрос про Марину'); await page.click('#ask'); await page.waitForSelector('.answer-title');
    const leak = await page.evaluate(() => JSON.stringify(window.__analyticsLog).indexOf('Марин') >= 0 || JSON.stringify(window.__analyticsLog).indexOf('секрет') >= 0);
    const names = await page.evaluate(() => [...new Set(window.__analyticsLog.map((e) => e.name))].join(','));
    ok(!leak, 'статистика: текст вопроса не отправляется', names);
    ok(page.errs.length === 0, 'открытки: нет ошибок в консоли', page.errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? '\nЕсть ошибки: ' + fails : '\nВсё хорошо');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
