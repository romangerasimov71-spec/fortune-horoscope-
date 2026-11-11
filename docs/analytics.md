# Статистика (analytics.js)

События уходят через Playgama Bridge (`bridge.analytics.send`). Вне площадки — тихо ничего
(последние события видны в консоли браузера: `window.__analyticsLog`).
Bridge сам отправляет запуск SDK, сессии, время, рекламу и `game_ready` — их не дублируем.

**Личных данных нет:** ни текста вопроса шару, ни имени, ни id человека. Строки — до 40 знаков.

| Событие | Когда | Данные |
|---|---|---|
| `app_open` | приложение запустилось | `platform` (`vk`, `ok`, `mock`, `web`…), `bridge` (да/нет) |
| `first_input` | первое нажатие или клавиша | `sec` — секунд от запуска |
| `screen` | открыт экран | `name`: `home`, `card`, `yesno`, `horo`, `sign`, `compat`, `compat_result` |
| `card_drawn` | открыта новая карта дня (раз в день) | `card` — номер аркана 0–21 |
| `yesno_asked` | нажато «Узнать ответ» | `kind`: `yes`, `no`, `maybe`, `care` (вопрос о здоровье); `has_text` — писал ли вопрос (сам текст не отправляется) |
| `compat_shown` | показан итог совместимости | `pair` (`leo+pisces`, в порядке зодиака), `pct` |
| `share_clicked` | нажато «Поделиться» | `what`: `card`, `yesno`, `horo`, `compat` |
| `share_sent` | в окне «Поделиться» нажата кнопка | `what`; `how`: `vk_story`, `vk_link`, `ok_post`, `image` (системное окно с картинкой), `save`, `link`, `copy` |
| `reward_offered` | нажато «Гороскоп на завтра — за рекламу» | `placement`: `tomorrow`; `sign` |
| `reward_granted` | реклама досмотрена, гороскоп на завтра открыт | `placement`, `sign`, `late` (реклама опоздала, но человек дождался) |
| `reward_failed` | награды нет | `placement`; `reason`: `closed` (закрыл раньше), `failed` (ошибка площадки), `timeout` (реклама не открылась за 10 с), `unsupported`, `late_left` (реклама опоздала, а человек ушёл с экрана) |

Что смотреть через 3–5 дней: доля `screen` по экранам (что открывают), `card_drawn` и `compat_shown`
на человека, `reward_offered` → `reward_granted` (сколько досматривают), причины `reward_failed`,
`share_clicked` → `share_sent` по `how` (какой способ «поделиться» работает).
