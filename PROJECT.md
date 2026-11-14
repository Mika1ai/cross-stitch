# Cross Stitch — актуальное состояние проекта

Живой документ: **как проект устроен сейчас** (функционал, данные, UI, отрисовка).  
Не changelog и не журнал по датам — при изменениях **переписываем** соответствующие разделы, устаревшее убираем.

Производительность (узкие места, идеи, решения): [PERFORMANCE.md](./PERFORMANCE.md).

---

## Правила работы

1. Проект — помощник для вышивки крестиком.
2. Стек: Vue 3 + TypeScript + Vite + pnpm; состояние — Pinia; роутер — `vue-router`; бэкенд — Supabase (Auth + Postgres + Storage).
3. UI-примитивы — свои в `src/components/ui/` (без внешней UI-библиотеки).
4. Стили:
   - `src/styles/variables.css` — дизайн-токены (`--border-width`, `--control-height`, `--opacity-ghost`, `--color-checker-*`, `--shadow-*`; цвета UI в hex; dark overrides)
   - цвета в сторе `scheme` — всегда `#RRGGBBAA` (непрозрачные с суффиксом `ff`)
   - `src/styles/reset.css` — reset
   - `src/styles/fonts.css` — `@font-face`
   - `src/styles/main.css` — вход, глобальное
   - стили фич — в самих `.vue`; толщина бордеров, focus `outline` и `outline-offset` — `var(--border-width)`
   - нативный скроллбар в `main.css` (если где-то останется): track прозрачный; размер `--scrollbar-size`
   - скролл в модалках: `UiScrollY` — нативный бар скрыт (ширина 0), поверх контента тонкий thumb только во время скролла
5. Автоимпорт (`unplugin-vue-components`, `directoryAsNamespace`): `ui/Button.vue` → `<UiButton>`, `icons/palette.svg` → `<IconsPalette>` (vite-svg-loader, `fill="currentColor"`).
5a. `UiColorPicker` (vue-color ChromePicker): токены `--vc-*` на панели мапятся на наши `--color-*`; шрифт/радиусы/бордеры через `:deep`.
6. Каталог схем и прогресс — Supabase (`schemes`, `user_progress`). Пайплайн: **картинка → схема** (palette/cells); рантайм читает схему с сервера.
7. UI-иконки — `src/assets/icons/`; шрифты — `src/assets/fonts/` (Roboto). Глифы FA на canvas — `src/data/fa-icon-map.json` (локально, не в Supabase): lookup `fas/far …` → unicode. **Временное** решение до переработки логики символов схем — не серебряная пуля, файл потом, скорее всего, уберём.
8. i18n: `vue-i18n`, локали `src/i18n/locales/{ru,en}.json`; `locale` и `darkTheme` — app-global (localStorage).
9. Секреты: `.env` из `.env.example` (`VITE_SUPABASE_*`).
10. Этот файл держим в актуальном состоянии; perf — в PERFORMANCE.md.

---

## Структура

| Путь | Назначение |
| --- | --- |
| `src/App.vue` | `<RouterView />` + boot |
| `src/router/` | Маршруты и auth-guards |
| `src/pages/` | Auth, галерея, страница схемы |
| `src/components/SchemeViewer.vue` | Canvas схемы, жесты, LOD |
| `src/components/scheme-viewer/` | `constants`, `types`, `routes`, `color`, `geometry` |
| `src/stores/auth.ts` | Сессия Supabase |
| `src/stores/scheme.ts` | Текущий шаблон + done/settings; LS-first sync → `user_progress` |
| `src/lib/progress-local.ts` | Ключи/fingerprint/dirty localStorage для прогресса |
| `src/lib/supabase.ts` | Клиент + URL превью |
| `src/types/scheme.ts` | Типы шаблона схемы (`SchemeData` / `SchemePaletteEntry`) |
| `src/types/database.ts` | Типы строк Supabase / `user_progress.settings` |
| `src/data/fa-icon-map.json` | Временный FA-lookup для canvas; уйдёт при переработке символов схем |

Зависимости: `@supabase/supabase-js`, `vue-router`, `vue-color`, `@fortawesome/fontawesome-free@5`.

---

## Auth и роуты

Гость → `/sign-in`. После входа → `/gallery`. Сборка → `/schemes/:schemeId`.

| Путь | Доступ |
| --- | --- |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/confirm-email` | гости |
| `/reset-password`, `/auth/callback` | callback / recovery |
| `/gallery`, `/schemes/:id` | authenticated |

Email+password, confirm email ON. Redirect URL: `/auth/callback`.

---

## Данные (Supabase)

- **`schemes`**: slug, title, `preview_path` (исходная пиксельная картинка + превью галереи), width/height, palette, cells. Bucket `scheme-previews` (public read).
- **`user_progress`**: `(user_id, scheme_id)` unique — `done[]`, `settings` (цвета/тулбар/hiddenCodes…), `last_done_index`. Lazy upsert при открытии схемы.
- Шаблон **не** копируется на пользователя. `locale` / `darkTheme` не в progress.
- **Image-first (будущее):** новые схемы — от картинки к `palette`/`cells`. Превью галереи — в Storage (`scheme-previews`); генерации превью в продукте нет.

### Sync прогресса (localStorage-first)

Черновик всегда на устройстве; сервер — редкий бэкап между сессиями/устройствами (лимиты free-tier).

| Правило | Поведение |
| --- | --- |
| Ключ LS | `cross-stitch.progress.{userId}.{schemeId}` — аккаунты на одном ПК не смешиваются |
| Правка progress | сразу в LS + флаг `dirty` (done, settings, lastDoneIndex, тулбар…) |
| Авто на сервер | каждые **10 мин**, только если `dirty` |
| Ручное | отдельной кнопки нет; save через confirm (уход / конфликт / sign out). Статус справа снизу: «Сохранено…» / «Есть несохранённые…» / «Сохранение…» |
| Конфликт при открытии | local ≠ server → модалка: оставить устройство (push) / взять сервер / решить позже |
| Уход в галерею | если `dirty` → confirm: сохранить / не сохранять / отмена |
| Sign out | если есть dirty-черновики пользователя → confirm + опциональный flush всех dirty |
| Вкладка | `visibilitychange` (hidden) → LS + попытка save; `beforeunload` если dirty |
| Cookies | не используем для прогресса |

Код: `src/lib/progress-local.ts`, persist в `src/stores/scheme.ts`, UI — `SchemePage` / `GalleryPage` + `UiConfirmDialog`.

---

## Деплой (GitHub Pages) — на паузе

Вернёмся позже. Заготовка уже есть (workflow, `VITE_BASE`, redirect URLs в Supabase), но секреты Actions / включение Pages / push деплоя **не делаем**, пока снова не решим публиковать.

Кратко, что уже подготовлено и что останется добить:

- Workflow: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) — build с `VITE_BASE=/cross-stitch/`, `404.html` для SPA.
- Локально `base` = `/` (без `VITE_BASE`).
- TODO позже: GitHub Secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), Pages Source = Actions, коммит/push; Site URL в Supabase при желании на `https://mika1ai.github.io/cross-stitch`.
- Redirect URLs в Supabase уже включают локалку и `mika1ai.github.io/cross-stitch`.

---

## Данные схемы

Формат строки `schemes` (типы в `src/types/scheme.ts`):

```ts
{
  width: number
  height: number
  palette: { color, code, symbol, icon }[]
  cells: number[]  // индексы в palette, длина width*height, порядок по строкам
}
```

- Шаблон грузится с сервера по `id`; `(0,0)` — слева сверху.
- Отдельного `palette.json` нет — ключ только из `palette` внутри схемы.
- Хелперы стора: `threadAt(index)`, `coordsAt(index)`.

---

## Галерея

`/gallery`: карточки схем (img из Storage + % progress). Клик открывает `/schemes/:id` (ensure progress). В хедере: настройки (`scope="general"` — только язык/тема) + logout (`IconsLogout`).

## Экран схемы

Карточка схемы на весь `100svh` (с паддингом страницы); chrome **поверх** холста (`pointer-events` только на островках). В покое через **3 с** скрывается (opacity); снова показывается при взаимодействии с канвасом (pointer/wheel). Пока открыт leave/conflict confirm — не прячется:

| Островок | Позиция | Состав |
| --- | --- | --- |
| Верх | один flex-ряд без wrap (`space-between`): режимы слева, nav справа; режимы → колонка, если горизонтально не влезают рядом с nav | палитра/сетка/навигатор/компас/прогресс · настройки + галерея |
| Sync | справа снизу | только статус sync (без кнопки save) |

**Выход из аккаунта только с галереи**, не со страницы схемы.

**Режимы:**

| Кнопка | Поведение |
| --- | --- |
| Палитра | Модалка с таблицей; `aria-pressed` + цвет `activeCodeColor`, если выбран код |
| Сетка | Toggle `showBlocks` (стор, default выкл.); цвет `gridColor` |
| Навигатор | Toggle `showNavigator` (стор); цвет `navigatorColor` |
| Компас | Toggle `showCompass` (стор); цвет `compassColor` |
| Прогресс | Toggle `showProgress`: done в `colorCanvas` → `progressColor`; вуаль/крест скрыты. Опция `autoProgressOnZoomOut` — вкл. ниже порога крестиков (12), выкл. выше |

`UiButton`: prop `color` задаёт акцент; виден при **hover** (только иконка/бордер) и при **`aria-pressed`** (ещё и фон `surface-hover`).

---

## Палитра

- Модалка на весь экран (`UiModal`: Teleport, Esc, scroll-lock, swipe-handle вниз).
- Поиск по коду (`code.includes`, pattern цифры/дефис), общий прогресс по **нескрытым** кодам.
- Таблица: символ поверх swatch цвета | код | radio «Активный» | checkbox «Исключить» (`hiddenCodes`).
- Скрытый код: не в общем прогрессе; уже в `done` остаются, но крестики/progress-bake не рисуются; цвет на canvas остаётся.
- Разделители строк с боковым inset (`--space-4`), как секции в настройках — не на всю ширину.
- `done` по цвету из стора (`doneCountByColor`).
- Radio / акцент выбора: `activeCodeColor`. Повторный выбор снимает `activeCode`.
- Long-press клетки на схеме (~1 с) — toggle того же кода в палитре; двойной тап — toggle «готово» (если компас выкл.).

---

## Схема (Canvas)

`SchemeViewer`: один canvas, мир в единицах `BASE_CELL = 8` (логич. px на клетку).

### Жесты

- Pan одним пальцем / мышью.
- Pinch-zoom; wheel-zoom на десктопе.
- Двойной тап → «готово»; одинарный тап → компас (если режим вкл.).
- Long-press → выбор цвета в палитре.
- Зум: min ≈ чтобы вдоль упорной оси влезало `1.25` схемы; max — `cellPx = 100`.
- Полоски ориентации (ghost, стиль как `UiScrollY`): справа и снизу показывают, где окно относительно холста; видны во время pan/zoom, гаснут через 750 мс. Не перетаскиваются.

### «Готово»

- Множество индексов клеток в сторе (`done`), `lastDoneIndex` для навигатора.
- Отрисовка только при `cellPx >= DONE_MARK_MIN_CELL_PX` (**12**): заливка `doneVeilColor` + белый крест (~75% диагонали). Ниже порога — **ничего** (ни вуаль, ни крест).
- Двойной тап ставит/снимает «готово» только когда крестики видны (`canMarkDone`); long-press выбора цвета от зума не зависит.
- Толщина креста — общая `accentStrokeWidth()` (см. ниже).

### Акцентные штрихи

- Одна формула на рамки, крестики, линии/плашки маршрута:  
  `accentStrokeWidth() = max(ACCENT_STROKE_CSS_PX / scale, ACCENT_STROKE_MIN)`  
  константы в `scheme-viewer/constants.ts` (CSS px **1.5**, min **0.35**).

### Активный код

- Видимые клетки с `activeCode`: подложка акцентом @ **25%** alpha + **общий периметр островов** (только рёбра без соседа того же кода; сосед по схеме, не по viewport).
- Nav/compass endpoints: полные рамки-клетки (батч по стилю) + та же подложка 25%; на активной клетке ring сдвинут наружу от периметра.

### Блок-сетка

- Шаг `gridSize` (default 10), цвет `gridColor`; включается кнопкой, **без** LOD-порога.

### Мелкая разлиновка

- Границы клеток, цвет `cellDividerColor` (alpha), только visible range, при `cellPx >= 24`.

### Символы

- Текст Roboto или FA через временный `fa-icon-map.json` (lookup по `palette.icon`); ink чёрный/белый по контрасту с цветом клетки после wash.
- При `cellPx >= 24`; ink кэшируется таблицей на палитру + строку wash.

### Zoom-wash

- Toggle `softenColorsOnZoom` (default вкл.), цвет `washColor`.
- Alpha: 0 при `cellPx = 12` → полный alpha на max zoom (линейно). Ниже 12 — wash нет.

### Focus-veil

- При активном навигаторе (есть маршрут) или компасе (есть from/to): полупрозрачный `veilColor` на весь viewport.
- Focus-клетки **не** вырезаются и не перерисовываются — остаются под veil; поверх — только рамки и маршруты.

### Навигатор

- От `lastDoneIndex` — ближайшая несделанная того же цвета; Г-путь (сначала вертикаль, потом горизонталь), подписи, стрелка на цели.
- Цвета: `navigatorColor` / `navigatorSecondaryColor`.
- Снятие отметки с последней клетки — путь пропадает, режим остаётся вкл.

### Компас

- Тап 1 и тап 2 — две клетки, Г-путь между ними.
- Пока компас вкл., тап не ставит «готово»; после пути следующий тап начинает новый замер.
- Цвета: `compassColor` / `compassSecondaryColor`.

---

## Порядок слоёв canvas (снизу вверх)

1. Фон viewport canvas — из CSS `.scheme-viewer` (`--color-surface-hover`)
2. Заливка схемы (`colorCanvas`)
3. Zoom-wash
4. Мелкая сетка (`>= 24`)
5. Блок-сетка (если вкл.)
6. Символы (`>= 24`)
7. Готовые: veil + крест (`>= 12`; ниже порога слой пуст)
8. Focus-veil (навигатор/компас)
9. Рамки: tint 25% + обводка (active — периметр островов; nav/compass — rect)
10. Маршруты (линия, стрелка, цифры)

---

## LOD (пороги)

`cellPx = BASE_CELL * scale` (`BASE_CELL = 8`).

| Что | Условие |
| --- | --- |
| Крестики «готово» | `cellPx >= 12` |
| Zoom-wash (старт → max) | с `12` до `100` |
| Мелкая сетка + символы | `cellPx >= 24` |
| Макс. зум | `cellPx = 100` |

Блок-сетка, рамки, маршруты, focus-veil — **не** по этим порогам (свои флаги режимов).

---

## Настройки (`SchemeSettings`)

Prop `scope`: `all` (схема) | `general` (галерея и др. вне схемы — только «Общее»).

Внешняя панель с бордером; внутри `UiScrollY`; секции разделены линиями (не отдельные карточки).

**Общее** — radio `locale` (`ru` / `en`); тёмная тема (default вкл.; toggle → `data-theme` на `<html>`). App-global, не в `user_progress`. Доступно и вне схемы.

**Отображение**

- Приглушение при зуме (toggle) + цвет приглушения (`washColor`, alpha)
- Цвет veil (`veilColor`, alpha)
- Цвет готовых (`doneVeilColor`, alpha)
- Цвет разделения (`cellDividerColor`, alpha)

**Активные клетки** — `activeCodeColor` (alpha)

**Сетка** — размер блока + `gridColor` (alpha)

**Навигатор / Компас** — основной цвет с alpha; вторичный (плашки) — без alpha

**Прогресс** — авто на zoom out (`autoProgressOnZoomOut`) + `progressColor` (alpha)

Внизу: **Сбросить по умолчанию** → `resetSettings()` (только поля настроек; done / моды / точки компаса не трогает).

---

## Стор `scheme` (кратко)

Патч полей — через `updateStore(partial)` (тулбар, настройки, компас).  
Отдельные действия с логикой: `toggleCell`, `toggleActiveCode`, `setCodeHidden`.

| Поле | Смысл |
| --- | --- |
| `done` / `lastDoneIndex` | Готовые клетки (last — старт навигатора) |
| `hiddenCodes` | Коды вне общего прогресса / без крестиков (Set не чистит `done`) |
| `locale` | Язык UI (`ru` / `en`); не входит в reset настроек схемы |
| `compassFrom` / `compassTo` | Точки компаса (в `settings`, переживают уход со схемы) |
| `activeCode` / `activeCodeColor` | Выбор нитки + цвет маркера |
| `gridSize` / `gridColor` | Блок-сетка |
| `cellDividerColor` | Мелкая разлиновка |
| `navigator*` / `compass*` | Цвета маршрутов и плашек |
| `darkTheme` | Тёмная тема UI |
| `softenColorsOnZoom` / `washColor` | Zoom-wash |
| `veilColor` | Focus-veil |
| `doneVeilColor` | Затемнение готовой клетки |
| `showBlocks` / `showNavigator` / `showCompass` | Моды тулбара (сетка / навигатор / компас) |
| `showProgress` / `progressColor` | Режим прогресса + цвет done |
| `autoProgressOnZoomOut` | Авто вкл/выкл прогресса на пороге крестиков (default выкл.) |
| `doneCountByColor` | Прогресс в палитре |

---

## Производительность

Актуальные оптимизации и открытые пункты — только в [PERFORMANCE.md](./PERFORMANCE.md). Сюда не дублируем разборы; при необходимости в разделах выше кратко фиксируем итоговое поведение (LOD, visible range, батч рамок и т.д.).
