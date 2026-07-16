# 7. Статуси та UI states

## 7.1. Коли показувати повний блок

Для `reading`, `paused`, `finished`, `abandoned`/`dnf`, якщо є хоча б одна ознака даних:

- `currentPage > 0`;
- `startedAt`;
- `activeDaysCount > 0`;
- events;
- `finishedAt`, `pausedAt` або `abandonedAt`.

## 7.2. Not started / want to read

Якщо історії немає:

- не показувати великий порожній chart;
- зберегти наявний CTA початку читання/оновлення прогресу;
- показати compact neutral state.

UA:

```text
Історія прогресу з’явиться після першого оновлення сторінки.
```

EN:

```text
Progress history will appear after the first page update.
```

Рекомендація: full-history tab лишається доступною, щоб tabs не змінювали структуру залежно від status.

## 7.3. Legacy progress without events

Якщо current page є, а history порожня:

- summary/progress показати;
- chart і recent activity замінити повідомленням.

UA:

```text
Для цього прогресу ще немає детальної історії оновлень.
```

EN:

```text
Detailed update history is not available for this progress yet.
```

## 7.4. Status-specific visibility

### Reading

Показати progress, remaining, active stats, forecast, chart і recent activity.

### Paused

Показати progress, paused date, stop page, stats, chart і history. Forecast приховати. Neutral chip `На паузі` дозволений.

### Finished

Показати final progress, started/finished dates, calendar duration, stats, chart і history. Не показувати remaining або forecast.

### Abandoned / DNF

Показати stop progress/date, stats, chart і history. Не використовувати warning/error semantics.

## 7.5. Loading

### Initial compact load

Skeleton для:

- title;
- progress line/bar;
- 3 metrics;
- chart;
- 2–3 recent rows.

Без fullscreen loader.

### Range refetch

- попередня висота chart зберігається;
- subtle overlay або skeleton bars;
- header/summary не зникають;
- control disable лише за потреби.

### Pagination/sort

Loading лише в history section. Summary/chart не повинні блимати.

## 7.6. Errors

Local error card:

- UA `Не вдалося завантажити історію читання.`;
- EN `Reading history could not be loaded.`;
- retry button викликає `refetch`.

При refetch error не очищати previous data. Використати inline state або toast за conventions проєкту.

404/access errors обробляти загальною логікою деталей книги.

## 7.7. Empty states

### Немає історії взагалі

UA:

```text
Історія читання поки порожня
Онови поточну сторінку — тут з’являться активність і всі зміни прогресу.
```

EN:

```text
Reading history is empty
Update the current page to start building activity and progress history.
```

### Немає activity в range

UA:

```text
У вибраному періоді оновлень прогресу немає.
```

Для all із порожніми points:

```text
Історія активності поки порожня.
```

Це локальний state chart section, не empty state всієї сторінки.

Не генерувати новий asset. Використати існуючий лише якщо він уже є.
