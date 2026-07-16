# Backend gaps for the series order check frontend

Стан на 2026-07-16. Backend модуль `apps/api/src/modules/series-order-check/` реалізований і задеплоєний на `dev.book-nest.net`.

## Що фактично є

| Flow                        | Endpoint                                                           | Generated hook                                 |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| List issues                 | `GET /api/reading-queue/series-order-issues?limit=3`               | `useSeriesOrderCheckControllerListIssues`      |
| Preview fix                 | `POST /api/reading-queue/series-order-issues/:fingerprint/preview` | `seriesOrderCheckControllerPreviewFix`         |
| Apply fix                   | `POST /api/reading-queue/series-order-issues/:fingerprint/apply`   | `seriesOrderCheckControllerApplyFix`           |
| Ignore issue                | `POST /api/reading-queue/series-order-issues/:fingerprint/ignore`  | `seriesOrderCheckControllerIgnoreIssue`        |
| Disable/enable series check | `PUT /api/series/:seriesId/order-check-preference`                 | `seriesOrderPreferenceControllerSetPreference` |

Контракт: `packages/shared/src/series-order-check.ts`. `queueVersion` — рядок (не число), як у `SeriesOrderIssuesViewSchema`.

## Gap 1 — немає читання series order-check preference

**Чого немає.** Стан `SeriesOrderDisabledSeries` (`apps/api/prisma/schema.prisma:538`) можна лише записати через `PUT /api/series/:seriesId/order-check-preference`. Немає ані `GET`, ані поля `orderCheckEnabled` у `SeriesViewSchema`, тому фронтенд не може прочитати поточне значення.

**Який UI flow блокує.** Пункт специфікації «додати toggle повторного ввімкнення у відповідне налаштування серії» (`prompts/CLAUDE-CODE-FRONTEND-PROMPT.md`, `frontend/02-frontend-fix-flows-and-modals.md` — «у налаштуваннях серії відобразити toggle для повторного ввімкнення»). Тогл без прочитаного стану був би або завжди-увімкнений, або локальний-оптимістичний — тобто збрехав би користувачу після reload.

**Що потрібно.**

```http
GET /api/series/:seriesId/order-check-preference
→ 200 { "enabled": boolean }
```

`PUT` уже повертає `{ enabled }`, а `SeriesOrderPreferenceViewSchema` уже існує — контракт узгоджений.

Альтернатива «додати `orderCheckEnabled` у `SeriesViewSchema`, щоб зекономити запит» розглянута й **відкинута**: модуль `series-order-check` уже монтує контролер на `@Controller("api/series")`, тож GET лягає поруч із наявним PUT і знання про `series_order_disabled_series` лишається в своєму модулі. Поле у `SeriesViewSchema` натомість змусило б репозиторій модуля `series` читати чужу таблицю — порушення межі модулів, що не варте зекономленого round-trip.

Готовий промпт для бекендера: [`BACKEND-PROMPT-order-check-preference.md`](./BACKEND-PROMPT-order-check-preference.md).

**Що можна зробити без цього.** Усе інше: sidebar-блок, картки всіх problem types, перегляд усіх issues, preview/apply для трьох стратегій, ignore, а також сам **disable** із confirmation (він лише пише). Недоступний тільки зворотний toggle у налаштуваннях серії.

## Не gap, але важливо для верифікації

`GET /api/reading-queue/series-order-issues` на поточному акаунті повертає `total: 0` — у реальних даних конфліктів порядку немає. Візуальна перевірка карток можлива лише зі стабом відповіді на рівні `fetch`; створювати конфліктні дані у спільній dev-базі не можна.
