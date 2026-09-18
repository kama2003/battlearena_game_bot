# BATTLE

> Соревнуйся. Приглашай. Побеждай.

**BATTLE** — Telegram Mini App: соревновательная tap-игра для подписчиков Telegram-канала.
Пользователь подтверждает подписку на канал, играет 10-секундный раунд, попадает в
дневной/недельный/сезонный рейтинг, приглашает друзей за бонусные попытки и бросает
вызов друзьям в дуэлях.

Это не прототип — production-ready фундамент с настоящей проверкой Telegram
initData, честным anti-cheat на игровых сессиях, атомарной защитой от повторного
начисления реферальных бонусов и рейтингом, спроектированным для десятков тысяч
пользователей (SQL window functions + отдельная таблица `SeasonScore`).

---

## 1. Архитектура

Монорепозиторий на pnpm workspaces:

```
battle/
├── apps/
│   ├── web/     React + TypeScript + Vite — сам Mini App (фронтенд)
│   ├── api/     Fastify + TypeScript + Prisma — backend/REST API
│   └── bot/     grammY — Telegram-бот (/start, проверка подписки, меню)
├── packages/
│   ├── ui/      Design system: Button, Card, LeaderboardRow, BottomNavigation…
│   ├── types/   Общие TypeScript-типы и Zod-схемы (frontend ⇄ backend contract)
│   └── config/  Игровой баланс по умолчанию + design tokens
└── README.md
```

**Почему так:** `packages/types` — единственный источник правды для формы
запросов/ответов API, поэтому фронтенд и бэкенд физически не могут разойтись в
типах. `packages/ui` — независимая от роутинга дизайн-система, которую Vite
подключает напрямую как TS-исходники (без отдельного шага сборки).

### Поток данных при входе

```
Telegram client
   │  initData (подписан HMAC-SHA256 секретом бота)
   ▼
apps/web  ──POST /api/auth/telegram──▶  apps/api
                                          │  verifyTelegramInitData()
                                          │  (проверка hash + auth_date)
                                          ▼
                                   находит/создаёт User, выдаёт JWT
   ◀── { token, user } ──────────────────┘
apps/web хранит JWT, дальше все запросы идут с Authorization: Bearer <jwt>
```

`BOT_TOKEN` существует только в `apps/api` (и `apps/bot`) — фронтенд никогда
его не видит и не может подделать `user_id`.

### Anti-cheat игровых раундов

1. `POST /api/game/start` — сервер создаёт `GameSession` с `startedAt`/`expiresAt`,
   отдаёт `gameSessionId`. Списывается попытка только если дневной бесплатный лимит
   уже исчерпан.
2. Клиент 10 секунд считает тапы локально — сервер этому не доверяет.
3. `POST /api/game/finish` — сервер проверяет:
   - сессия существует, принадлежит этому пользователю, ещё `ACTIVE`;
   - `gameSessionId` уникален (`@unique` в схеме) → повторно завершить нельзя;
   - прошло не меньше времени раунда (не пришли раньше, чем физически возможно);
   - сессия не просрочена;
   - итоговый счёт не может превышать `maxTapsPerSecond × duration`
     (см. `packages/config`) — превышение молча обрезается, а не отклоняется грубой
     ошибкой.

---

## 2. Технологии

| Слой | Стек |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, Framer Motion, Radix UI, Lucide |
| Backend | Node.js, TypeScript, Fastify 5, Zod, JWT, Prisma ORM |
| База данных | PostgreSQL |
| Bot | grammY |
| Тесты | Vitest |
| Линт/формат | ESLint (flat config, typescript-eslint), Prettier |

---

## 3. Требования

- Node.js ≥ 20
- pnpm (в репозитории закреплена версия через `packageManager`; `corepack enable`
  либо `npm i -g pnpm`)
- PostgreSQL ≥ 14 (локально, в Docker или в облаке)
- Telegram-бот, созданный через [@BotFather](https://t.me/BotFather)
- Публичный Telegram-канал, администратором которого станет бот

---

## 4. Установка

```bash
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

Заполните `.env` в корне (см. раздел 7), затем накатите схему БД и заполните её
тестовыми данными:

```bash
pnpm db:generate   # сгенерировать Prisma Client
pnpm db:migrate    # создать таблицы (development)
pnpm db:seed       # 50 фейковых игроков для непустого рейтинга
```

Запуск в разработке (три процесса, в отдельных терминалах):

```bash
pnpm dev:api     # http://localhost:4000
pnpm dev:web     # http://localhost:5173
pnpm dev:bot     # long polling
```

`apps/web` в обычном браузере (не внутри Telegram) отправляет специальный
`initData: "DEV_MODE"`, который backend принимает **только** если
`NODE_ENV !== production` и в `.env` задан `DEV_TELEGRAM_USER_ID`. В production
это ветвление недоступно в принципе — сборка не меняет поведение, за него отвечает
только `NODE_ENV`.

---

## 5. PostgreSQL

Быстрый вариант — Docker:

```bash
docker run --name battle-postgres -e POSTGRES_USER=battle \
  -e POSTGRES_PASSWORD=battle -e POSTGRES_DB=battle \
  -p 5432:5432 -d postgres:16
```

и в `.env`:

```
DATABASE_URL=postgresql://battle:battle@localhost:5432/battle?schema=public
```

Миграции для production (без интерактивных вопросов):

```bash
pnpm db:deploy
```

---

## 6. Создание Telegram-бота (BotFather)

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot`, задайте имя и
   `@username` (например `BattleGameBot`) — это и есть `BOT_USERNAME`.
2. Скопируйте выданный токен в `BOT_TOKEN`.
3. `/setmenubutton` → выберите бота → отправьте `Открыть BATTLE` как текст кнопки
   (URL зададим позже, когда будет публичный адрес фронтенда — см. ниже про Mini App).
4. Рекомендуется также `/setprivacy` → `Disable`, чтобы бот видел все команды в
   личных сообщениях (для канала это не требуется).

### Публичный канал и права бота

1. Создайте (или используйте существующий) публичный Telegram-канал.
2. Добавьте бота в канал и назначьте **администратором** — без этого
   `getChatMember` из Bot API не отдаёт статус пользователей для проверки подписки.
   Права можно оставить минимальные, но роль должна быть именно «администратор».
3. `CHANNEL_USERNAME` — `@username` канала без `@` (используется для ссылки
   «Подписаться» и для задачи в разделе «Задания»).
4. `CHANNEL_ID` — числовой id канала (обычно вида `-100xxxxxxxxxx`), который
   передаётся в `getChatMember`. Получить его проще всего, переслав любое
   сообщение из канала боту [@userinfobot](https://t.me/userinfobot) либо вызвав
   `getUpdates`/`getChat` через Bot API после того, как бот стал администратором.

---

## 7. Настройка Mini App (BotFather)

1. `/newapp` в BotFather → выберите вашего бота → укажите название, описание,
   иконку.
2. В качестве Web App URL укажите адрес, где задеплоен `apps/web`
   (например `https://battle.yourdomain.com`) — это же значение идёт в
   `MINI_APP_URL`.
3. Deep-links, которые уже реализованы в коде:
   - `https://t.me/<BOT_USERNAME>?startapp=<REFERRAL_CODE>` — открывает Mini App
     сразу с рефералом в `initDataUnsafe.start_param` (backend валидирует его
     через подписанный `initData`, а не доверяет клиенту напрямую).
   - `https://t.me/<BOT_USERNAME>?startapp=challenge_<id>` — открывает вызов на
     дуэль.

---

## 8. Переменные окружения

Полный список — в [`.env.example`](.env.example). Ключевые:

| Переменная | Назначение |
|---|---|
| `BOT_TOKEN` | Токен бота. Никогда не попадает во frontend. |
| `BOT_USERNAME` | `@username` бота без `@` — используется для реферальных ссылок. |
| `CHANNEL_ID` / `CHANNEL_USERNAME` | Канал, подписка на который проверяется через `getChatMember`. |
| `MINI_APP_URL` | Публичный URL фронтенда. |
| `DATABASE_URL` | Строка подключения PostgreSQL. |
| `JWT_SECRET` | Секрет для подписи сессионных JWT (`openssl rand -hex 32`). |
| `DAILY_FREE_ATTEMPTS`, `SEASON_DURATION_DAYS`, `REFERRAL_BONUS_ATTEMPTS`, `GAME_DURATION_SECONDS` | Игровой баланс — можно менять без деплоя кода. |
| `DEV_TELEGRAM_USER_ID` | Только для разработки вне Telegram, см. раздел 4. |

`apps/web/.env` отдельно хранит `VITE_API_URL` (адрес backend, доступный из
браузера/Telegram-клиента).

---

## 9. Тесты, линт, сборка

```bash
pnpm lint        # ESLint по всему монорепозиторию
pnpm typecheck   # tsc --noEmit во всех пакетах
pnpm test        # Vitest (apps/api: initData, подписка, рефералы, anti-cheat, рейтинг)
pnpm build       # typecheck + prisma generate + сборка web (Vite) и проверка api/bot
```

Тестами покрыты именно те места, где легко незаметно сломать безопасность или
экономику приложения:

- `verifyTelegramInitData` — подлинная подпись проходит, подделанная и просроченная — нет;
- `checkSubscription` — подтверждение реферала запускается только при `subscribed: true`;
- `confirmReferralIfEligible` — конкурентный повторный вызов не начисляет бонус дважды;
- `startGame`/`finishGame` — чужая/просроченная/уже завершённая сессия отклоняется,
  слишком быстрый раунд отклоняется, неправдоподобный счёт обрезается;
- `getLeaderboard` — ранжирование и пагинация сезонного рейтинга.

---

## 10. Production deployment

### 10.1 Frontend (apps/web) → GitHub Pages

Уже настроено: `.github/workflows/deploy-pages.yml` собирает `apps/web` и
деплоит на GitHub Pages при каждом пуше в `main`, который трогает
`apps/web`/`packages`. Один раз включите источник Pages на "GitHub Actions"
(Settings → Pages → Source), если ещё не включено.

`VITE_API_URL`, с которым соберётся фронтенд, берётся из **переменной
репозитория** (Settings → Secrets and variables → Actions → Variables →
`VITE_API_URL`) — пропишите туда публичный адрес `apps/api` (шаг 10.2) и
перезапустите workflow (`gh workflow run deploy-pages.yml` или любой пуш).
Без этого фронтенд по умолчанию соберётся с `http://localhost:4000`, что не
достучится ни до чего с телефона.

### 10.2 Backend (apps/api + PostgreSQL) и bot — Docker

В корне лежат `Dockerfile.api` и `Dockerfile.bot` — собираются с контекстом
**из корня репозитория** (им нужен весь pnpm-workspace, а не только
`apps/api`/`apps/bot`):

```bash
docker build -f Dockerfile.api -t battle-api .
docker build -f Dockerfile.bot -t battle-bot .
```

Подходит для любого Docker-хостинга — Render, Railway, Fly.io, обычный VPS.
Пример на **Render** (есть бесплатный тариф без карты на старте):

1. **New → PostgreSQL** — бесплатный тариф хранит базу **90 дней**, затем
   нужно перейти на платный план или экспортировать данные и пересоздать
   базу; для хобби-проекта на старте достаточно. Скопируйте **Internal
   Database URL**.
2. **New → Web Service → Build and deploy from a Git repository** → этот
   репозиторий. Runtime — **Docker**, **Dockerfile Path** = `Dockerfile.api`,
   **Docker Build Context** = `.` (корень репо). Instance Type — **Free**.
   Переменные окружения — как в `.env.example` (`BOT_TOKEN`, `BOT_USERNAME`,
   `CHANNEL_ID`, `CHANNEL_USERNAME`, `MINI_APP_URL`, `JWT_SECRET`,
   `NODE_ENV=production`) плюс `DATABASE_URL` из шага 1. `PORT` Render
   проставляет сам — ничего задавать не нужно, `apps/api` уже читает
   `process.env.PORT`. Публичный адрес сервиса (`https://<name>.onrender.com`)
   — это и есть URL для `VITE_API_URL` из шага 10.1. Миграции
   (`prisma migrate deploy`) применяются автоматически при старте контейнера.
3. Ещё один **Web Service** с тем же репозиторием, но **Dockerfile Path** =
   `Dockerfile.bot`, те же Telegram-переменные (без `DATABASE_URL`). Бот
   технически не веб-сервис (Telegram long polling, не HTTP), но у Render
   нет бесплатного тарифа для background worker'ов — поэтому
   `apps/bot/src/index.ts` поднимает рядом с polling'ом крошечный
   HTTP-сервер на `process.env.PORT`, только чтобы Render видел открытый порт.
4. **Free-тариф Render засыпает после ~15 минут без HTTP-запросов** — для
   `apps/api` это означает медленный первый запрос после простоя (30–50с),
   а для бота — что он перестанет отвечать в Telegram, пока не проснётся.
   Чтобы бот не засыпал, настройте внешний пингер на его URL каждые
   10 минут — например [UptimeRobot](https://uptimerobot.com) (бесплатно,
   HTTP-монитор на `https://<bot-service>.onrender.com/`).
5. В BotFather ничего дополнительно настраивать не нужно — `MINI_APP_URL`
   и меню бота бот прописывает себе сам через Bot API при старте
   (`setChatMenuButton`).
6. (Опционально) заполнить рейтинг тестовыми данными: выполните
   `pnpm db:seed` с `DATABASE_URL`, указывающим на продовую базу (Render
   даёт **External Database URL** для подключения снаружи) — так рейтинг
   не будет пустым на старте.

---

## 11. Что реализовано

- Полная проверка Telegram `initData` (HMAC-SHA256, `auth_date`, без доверия
  клиентскому `user_id`).
- Проверка подписки на канал через `getChatMember` — только на backend.
- Anti-cheat игровых сессий: серверные `GameSession`, невозможность повторной
  отправки результата, серверная проверка времени и правдоподобности счёта.
- Дневной/недельный/сезонный рейтинг с пагинацией, оптимизированный под большое
  количество игроков (SQL window function для day/week, отдельная агрегированная
  таблица `SeasonScore` для season).
- Автоматическая ротация сезонов с сохранением истории.
- Реферальная система с идемпотентным начислением бонуса (защита от гонки).
- Дуэли (challenges) с шарингом через Telegram.
- Задания с бонусными попытками.
- Профиль, достижения, пустые/ошибочные/skeleton-состояния везде.
- Design system («premium minimalism»): светлый минимализм, чёрные CTA, тёплый
  золотой акцент только для трофея/первого места/достижений.
- Bottom navigation, safe-area, mobile-first (360–430px), Framer Motion-анимации,
  Telegram HapticFeedback (умеренно — не на каждый тап).

## 12. Что стоит доделать перед реальным запуском

- Развернуть настоящий PostgreSQL и прогнать миграции — в этой среде разработки
  не было доступной БД, так что рантайм-проверка ограничилась build/lint/typecheck/
  unit-тестами и визуальной проверкой фронтенда (сборка Vite, экран ошибки при
  недоступном backend). Полный клик-тест игры/рейтинга/дуэлей нужно сделать с
  реальным ботом и БД.
- Указать реальные `BOT_TOKEN`/`CHANNEL_ID`/`MINI_APP_URL` и пройти онбординг в
  BotFather.
- По желанию: admin-панель поверх уже готовой конфигурации баланса
  (`packages/config`), CI-пайплайн, rate-limit тонкая настройка под реальную
  нагрузку, i18n (сейчас интерфейс на русском).
