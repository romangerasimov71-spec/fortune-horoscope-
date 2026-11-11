# Шаблон мини-приложения ВК/ОК: как перенести основу в другое приложение

Основа «Гаданий и гороскопа» сделана так, чтобы её копировать в другие мини-приложения студии
(сонник, рецепты, викторины…), а не писать заново. Меняются содержание и оформление,
а площадка, сохранение, реклама, «поделиться» и статистика — те же файлы.

## Что копировать без правок

| Файл | Зачем |
|---|---|
| `playgama-bridge.js`, `playgama-bridge.LICENSE` | Playgama Bridge 2.4.1, локальная копия (одна сборка — ВК, ОК, Playgama) |
| `platform.js` | Вся работа с площадкой: запуск, сохранение, реклама, баннер, «поделиться» в ВК/ОК, пауза, пробная реклама `?fakeads=1` |
| `analytics.js` | События статистики через Bridge, без личных данных |
| `share.js` | Окно «Поделиться» + рисование открытки на canvas + копирование + плашка |
| `tests/ads-test/` | Набор проверки рекламы студии (из `game-studio/kits/ads-test/`) |

## Что поправить

1. **`config.js`** — название, `storagePrefix` (у каждого приложения свой: `fh`, `db`, `qt`…),
   `pagesUrl`, потом `vkAppId` / `okAppId`, частота рекламы (`ads`), баннер.
2. **`playgama-bridge-config.json`** — ссылки в `social`, `placements` рекламы (их имена = то, что
   приложение передаёт в `showRewarded('…')` / `showInterstitial('…')`).
3. **`index.html`** — порядок скриптов: Bridge **первым в `<head>`**, потом внизу
   `config.js`, `platform.js`, `analytics.js`, `share.js`, затем своё (тексты, графика, открытки, приложение).
   Элемент ожидания рекламы `#adwait` (см. index.html) — если есть реклама за награду.
4. **`style.css`** — скопировать блоки «Плашка и окно копирования», «Окно Поделиться (share.js)»,
   «Загрузка, ожидание рекламы, пауза». Они опираются на классы `.btn`, `.btn-gold`, `.btn-outline`
   и цвета `--gold`, `--panel-solid` — их задать в своей теме.
5. **Своё**: `postcards.js` (какие открытки рисовать), `app.js` (экраны), `content/` (тексты), `art.js` (графика).
6. **`tests/ads-adapter.js`** — написать заново по заготовке `tests/ads-test/adapter-template.js`
   (как дойти до кнопки награды, как посчитать награду). Пример — здесь.

## Как приложение пользуется основой

```js
// запуск: сначала площадка и сохранение, потом первый экран
Platform.init()
  .then(() => Platform.storage.load(['sign', 'history']))   // все ключи — одним вызовом
  .then(start, start);                                      // start() всё равно, даже если площадка молчит
function start() {
  render();
  Platform.ready();                                         // площадка убирает заставку
  Analytics.event('app_open', { platform: Platform.id, bridge: Platform.hasBridge });
}

// сохранение (сразу в память и localStorage, в фоне — на площадку)
Platform.storage.get('sign');            // null, если нет
Platform.storage.set('sign', 'leo');     // любое JSON-значение
Platform.storage.remove('sign');

// реклама за награду: кнопку показывать только если Platform.rewardedSupported()
showWaitScreen(true);                    // «Загружаем рекламу…», нажатия не проходят
Platform.showRewarded('bonus', {
  onLate: () => { /* реклама опоздала, но досмотрена: дать, если человек всё ещё здесь */ }
}).then((res) => {
  showWaitScreen(false);
  if (res === 'rewarded') giveBonus();   // ТОЛЬКО здесь
  else Share.toast(res === 'closed' ? 'Досмотрите рекламу до конца' : 'Реклама не загрузилась, попробуйте позже.');
});

// межстраничная: в естественной паузе, своя частота в app.js по config.ads
if (Platform.interstitialSupported()) Platform.showInterstitial('home');

// пауза площадки (реклама открыта, вкладка свернута)
Platform.onPause((paused) => document.body.classList.toggle('paused', paused));

// поделиться: окно с открыткой и кнопками под ВК / ОК / сайт
Share.open({
  what: 'dream', title: 'Поделиться толкованием', fileName: 'son',
  text: 'Мне приснилась вода — к переменам ✨\nУзнай, к чему твой сон:',
  hash: '#dream=voda',                                   // экран, куда ведёт ссылка
  draw: (pc) => { pc.background(); pc.frame(); pc.text('Вода', { y: 500, size: 100, color: pc.colors.gold }); pc.footer('Сонник'); },
  onAction: (how) => Analytics.event('share_sent', { what: 'dream', how })
});

// статистика
Analytics.event('dream_opened', { section: 'water' });   // без личных данных!
```

## Помощники открытки (`pc` в `draw`)

`pc.background()` — небо со звёздами; `pc.frame()` — золотая рамка; `pc.text(строка, { y, size, minSize,
font: 'serif'|'sans', weight, italic, color, maxWidth, maxLines, spacing, shadow })` — текст с переносом,
сам уменьшает шрифт, возвращает низ текста; `pc.svg(svgСтрока, x, y, w, h, цвет)` → Promise — рисунок
из SVG-строки (как в `art.js`); `pc.roundRect(...)`; `pc.footer(подпись)` — название приложения внизу.
Размер 1080×1350, `pc.colors` — золото и текст. Цвета неба — в начале `share.js` (`COLORS`).

## Параметры адреса для проверки (во всех приложениях одинаковые)

- `?fakeads=1` — пробная реклама на экране (5 с, можно закрыть раньше); `?fakeads=fail` / `?fakeads=silent`;
- `?simulate=vk` / `?simulate=ok` — окно «Поделиться» как в ВК/ОК, ничего не отправляет;
- `?nobridge=1` — как будто Bridge нет вовсе.

## Что важно не сломать

- Bridge — первым скриптом, без `async` (требование Bridge и модерации).
- Награда — только по ответу `'rewarded'`; «rewarded» без запроса или второй раз — ничего не даёт (уже в `platform.js`).
- Приложение обязано полностью работать без Bridge (GitHub Pages, файл не загрузился, площадка молчит 6 с).
- Ключи площадки: только буквы, цифры, `_` и `-` (ВК) — поэтому `fh_card`, а в localStorage `fh.card`.
- В статистику — никаких текстов, которые пишет человек.
