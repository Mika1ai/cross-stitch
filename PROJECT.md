# Cross Stitch — актуальное состояние проекта

Живой документ: **как проект устроен сейчас** (функционал, данные, UI, отрисовка).  
Не changelog и не журнал по датам — при изменениях **переписываем** соответствующие разделы, устаревшее убираем.  
Открытый техдолг — в секции ниже; при закрытии пункта — вычёркиваем/убираем.

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
   - `src/styles/main.css` — вход, глобальное; на `body` — `-webkit-touch-callout: none` + `user-select: none` (исключения: `input` / `textarea` / `[contenteditable]`)
   - стили фич — в самих `.vue`; толщина бордеров, focus `outline` и `outline-offset` — `var(--border-width)`
   - `:hover`-стили UI — только в `@media (hover: hover) and (pointer: fine)` (Button / Radio / Checkbox / Toggle / ColorPicker / Input clear / gallery-card); на таче feedback через `:active` у Button
   - нативный скроллбар в `main.css` (если где-то останется): track прозрачный; размер `--scrollbar-size`
   - скролл в модалках: `UiScrollY` — нативный бар скрыт (ширина 0), поверх контента тонкий thumb только во время скролла
5. Автоимпорт (`unplugin-vue-components`, `directoryAsNamespace`): `ui/Button.vue` → `<UiButton>`, `icons/palette.svg` → `<IconsPalette>` (vite-svg-loader, `fill="currentColor"`).
5a. `UiColorPicker` (vue-color ChromePicker): токены `--vc-*` на панели мапятся на наши `--color-*`; шрифт/радиусы/бордеры через `:deep`.
5b. `UiLoading` — анимированный крестик (`src/components/ui/Loading.vue` + `assets/icons/loading.svg`); места: boot в `App.vue`, галерея, загрузка схемы.
6. Каталог схем и прогресс — Supabase (`schemes`, `user_progress`). Пайплайн: **картинка → схема** (palette/cells); рантайм читает схему с сервера.
7. UI-иконки — `src/assets/icons/`; шрифты — `src/assets/fonts/` (Roboto). Глифы FA на canvas — `src/data/fa-icon-map.json` (локально, не в Supabase): lookup `fas/far …` → unicode. **Временное** решение до переработки логики символов схем — не серебряная пуля, файл потом, скорее всего, уберём.
8. i18n: `vue-i18n`, локали `src/i18n/locales/{ru,en}.json`; `locale` / `darkTheme` / `markDoneOnSingleTap` — app-global в `user_settings` (стор `userSettings`), не localStorage.
9. Секреты: `.env` из `.env.example` (`VITE_SUPABASE_*`).
10. Этот файл держим в актуальном состоянии; техдолг — в секции «Технический долг».

---

## Структура

| Путь | Назначение |
| --- | --- |
| `src/App.vue` | `<RouterView />` + boot |
| `src/router/` | Маршруты и auth-guards |
| `src/pages/` | Auth, галерея, страница схемы |
| `src/components/SchemeViewer.vue` | Canvas схемы, жесты, LOD |
| `src/components/scheme-viewer/` | `constants`, `types`, `routes`, `color`, `geometry` |
| `src/components/ui/Loading.vue` | Спиннер загрузки (два крестика, приезд/уезд) |
| `src/stores/auth.ts` | Сессия Supabase |
| `src/stores/scheme.ts` | Текущий шаблон + done/settings; LS-first sync → `user_progress` |
| `src/stores/userSettings.ts` | App-global: locale / darkTheme / markDoneOnSingleTap → `user_settings` |
| `src/lib/user-settings.ts` | Fetch/upsert prefs + defaults/merge |
| `src/lib/progress-local.ts` | Ключи/fingerprint/dirty localStorage для прогресса |
| `src/lib/supabase.ts` | Клиент + URL превью |
| `src/types/scheme.ts` | Типы шаблона схемы (`SchemeData` / `SchemePaletteEntry`) |
| `src/types/database.ts` | Типы строк Supabase / `user_progress.settings` / `user_settings` |
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
- **`user_settings`**: `user_id` PK — `prefs` jsonb (`locale`, `darkTheme`, `markDoneOnSingleTap`). Одна строка на пользователя; RLS только свой `user_id`.
- Шаблон **не** копируется на пользователя. App-global prefs **не** в `user_progress` и **не** в localStorage.
- **Image-first (будущее):** новые схемы — от картинки к `palette`/`cells`. Превью галереи — в Storage (`scheme-previews`); генерации превью в продукте нет.

### `user_settings` (SQL для Dashboard)

```sql
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);
```

Дефолты prefs: `locale: "ru"`, `darkTheme: true`, `markDoneOnSingleTap: false`.  
Гость — только in-memory defaults (ни сервер, ни LS). После логина: fetch → стор; смена в «Общее» → upsert.

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

## Деплой (GitHub Pages)

- Сайт: `https://mika1ai.github.io/cross-stitch/`
- Workflow: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) — `VITE_BASE=/cross-stitch/`, SPA `404.html`
- Локально `base` = `/` (без `VITE_BASE`)
- Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### PWA (тестовые устройства)

Тестируем standalone PWA (Add to Home Screen) на двух устройствах:
- **iPhone 7** (iOS 15)
- **iPhone SE** (2-го поколения)

- `public/manifest.webmanifest` — `display: standalone`, относительные `start_url` / `scope` / icons (ок с `/cross-stitch/`)
- PNG: `public/icons/apple-touch-180.png`, `pwa-192.png`, `pwa-512.png` (перегенерация: `pnpm icons:pwa`)
- В `index.html`: apple-meta + `apple-touch-icon` + link на manifest; viewport с `maximum-scale=1.0, user-scalable=no` (pinch страницы vs canvas)
- На iPhone: Safari → Поделиться → **На экран «Домой»** → открыть иконку (без строки Safari)
- Service Worker пока не подключали — для Add to Home Screen на iOS не обязателен
- Превью в карточке галереи: квадрат через `padding-bottom: 100%` (не `aspect-ratio` — фикс схлопывания на iPhone 7 / iOS 15)

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

`/gallery`: карточки схем (img из Storage + % progress). Клик открывает `/schemes/:id` (ensure progress). В хедере только настройки (`SchemeSettings` `scope="general"`). Спиннер загрузки — по центру области под шапкой.

## Экран схемы

Карточка схемы на весь `100svh` (с паддингом страницы); chrome **поверх** холста (`pointer-events` только на островках). В покое через **3 с** скрывается (opacity); снова показывается при взаимодействии с канвасом (pointer/wheel). Пока открыт leave/conflict confirm — не прячется. Спиннер загрузки схемы — по центру `app-card`.

| Островок | Позиция | Состав |
| --- | --- | --- |
| Верх | один flex-ряд без wrap (`space-between`): режимы слева, nav справа; режимы → колонка, если горизонтально не влезают рядом с nav | палитра/сетка/навигатор/компас/прогресс · настройки + галерея |
| Sync | справа снизу | только статус sync (без кнопки save) |

**Выход из аккаунта** — в **Настройки → Общее** (кнопка видна при сессии; с галереи `scope="general"`, со схемы — в полной панели настроек). Confirm dirty (save / discard / cancel) как у leave.

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
- Таблица: символ поверх swatch цвета | код | radio «Активный» | checkbox «Исключить» (`hiddenCodes`). Без CSS `subgrid` (iOS 15): `thead`/`tbody`/`tr` → `display: contents`.
- Активный код в списке поднимается **первым** (остальной порядок как в схеме / после фильтра поиска).
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
- «Готово»: по умолчанию двойной тап; если `markDoneOnSingleTap` — один тап (Настройки → Общее, `user_settings.prefs`).
- Одинарный тап → компас (если режим компаса вкл.; тогда mark не ставится).
- Long-press → выбор цвета в палитре.
- Зум: min ≈ чтобы вдоль упорной оси влезало `1.25` схемы; max — `cellPx = 60` (`MAX_CELL_PX`).
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
- Alpha: 0 при `cellPx = 12` → полный alpha на max zoom (`cellPx = 60`) линейно. Ниже 12 — wash нет.

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

## LOD и кламп зума (под рукой)

`cellPx = BASE_CELL * scale` (`BASE_CELL = 8` в `scheme-viewer/constants.ts`).  
Все пороги ниже — в **CSS-пикселях клетки на экране**, не в логических единицах схемы.

| `cellPx` | Что происходит |
| --- | --- |
| **min** (`fit / 1.25`) | Нижняя граница зума: вдоль упорной оси влезает ~1.25 схемы |
| ниже **12** | Нет крестиков «готово», жест mark выкл.; wash нет. При `autoProgressOnZoomOut` — progress включается при переходе ниже 12 |
| **12** (`DONE_MARK_MIN_CELL_PX`) | Появляются крестики + вуаль done; double-tap mark; **старт** zoom-wash (alpha → 0) |
| **12…60** | Wash нарастает линейно: `t = (scale - 1.5) / (maxScale - 1.5)` |
| от **24** | Мелкая сетка клеток (`cellDivider`) + символы/иконки |
| **60** (`MAX_CELL_PX`) | Потолок зума; **апогей** wash (полная alpha из `washColor`) |

Старт при открытии: ~`fit * 0.98` (внутри `[min, max]`).

**Не зависят от этих порогов:** блок-сетка (`showBlocks`), рамки active/nav/compass, маршруты, focus-veil, long-press выбора кода.

---

## Настройки (`SchemeSettings`)

Prop `scope`: `all` (схема) | `general` (галерея и др. вне схемы — только «Общее»).

Внешняя панель с бордером; внутри `UiScrollY`; секции разделены линиями (не отдельные карточки).

**Общее** (стор `userSettings` → `user_settings.prefs`) — язык; тёмная тема; «отмечать одним нажатием»; **выйти** (если есть сессия). Default prefs: `ru` / dark / off. Доступно и вне схемы.

**Отображение**

- Приглушение при зуме (toggle) + цвет приглушения (`washColor`, alpha)
- Цвет veil (`veilColor`, alpha)
- Цвет готовых (`doneVeilColor`, alpha)
- Цвет разделения (`cellDividerColor`, alpha)

**Активные клетки** — `activeCodeColor` (alpha)

**Сетка** — размер блока + `gridColor` (alpha)

**Навигатор / Компас** — основной цвет с alpha; вторичный (плашки) — без alpha

**Прогресс** — авто на zoom out (`autoProgressOnZoomOut`); `progressColor` (alpha)

Внизу: **Сбросить по умолчанию** → `resetSettings()` (только поля настроек; done / моды / точки компаса не трогает).

---

## Стор `scheme` (кратко)

Патч полей — через `updateStore(partial)` (тулбар, настройки, компас).  
Отдельные действия с логикой: `toggleCell`, `toggleActiveCode`, `setCodeHidden`.

| Поле | Смысл |
| --- | --- |
| `done` / `lastDoneIndex` | Готовые клетки (last — старт навигатора) |
| `hiddenCodes` | Коды вне общего прогресса / без крестиков (Set не чистит `done`) |
| `compassFrom` / `compassTo` | Точки компаса (в `settings`, переживают уход со схемы) |
| `activeCode` / `activeCodeColor` | Выбор нитки + цвет маркера |
| `gridSize` / `gridColor` | Блок-сетка |
| `cellDividerColor` | Мелкая разлиновка |
| `navigator*` / `compass*` | Цвета маршрутов и плашек |
| `softenColorsOnZoom` / `washColor` | Zoom-wash |
| `veilColor` | Focus-veil |
| `doneVeilColor` | Затемнение готовой клетки |
| `showBlocks` / `showNavigator` / `showCompass` | Моды тулбара (сетка / навигатор / компас) |
| `showProgress` / `progressColor` | Режим прогресса + цвет done |
| `autoProgressOnZoomOut` | Авто вкл/выкл прогресса на пороге крестиков (default выкл.) |
| `doneCountByColor` | Прогресс в палитре |

Стор `userSettings`: `locale`, `darkTheme`, `markDoneOnSingleTap` — см. раздел данных выше.

---

## Технический долг

Проект в целом здоровый; большой rewrite не нужен. Ниже — горячие точки и пробелы, к которым можно вернуться позже.

### Горячие точки

- **`SchemeViewer.vue` (~1.4k строк)** — рисование canvas, жесты, rails в одном SFC. Хелперы уже в `scheme-viewer/`, но draw + pointer всё ещё внутри. Имеет смысл постепенно вынести в модули/composables без смены поведения.
- **`scheme.ts` (~760 строк)** — UI-состояние схемы + sync / dirty / conflict / discard в одном сторе. Плотный, но связный; позже можно отделить session UI от sync/draft при том же публичном API.

### Пробелы (не поломки)

- **Нет автотестов** — особенно жалко `progress-local`, conflict / discard / flush.
- **`fa-icon-map.json`** — временный FA-lookup на canvas; уйдёт при переработке символов схем (см. правила выше).
- **Perf на слабых устройствах** — ink-кэш (A) уже есть; при необходимости дальше: реже перерисовывать символы / отдельный слой (B), атлас глифов вместо `fillText` (C). Целевой контекст: iPhone 7 и pan/zoom при `cellPx >= 24`.

### Опциональный порядок (value / risk)

1. Точечные unit-тесты на sync/discard/conflict.
2. Нарезка draw/pointer из `SchemeViewer`.
3. Разделение UI vs sync в сторе `scheme`.
