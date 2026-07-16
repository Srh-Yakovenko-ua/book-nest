# 9. Localization і форматування

## 9.1. Загальні правила

- Усі тексти винести в i18n.
- Не писати UA/EN рядки напряму в JSX.
- Використовувати pluralization для pages, active days, calendar days, updates і forecast days.
- Назви namespace адаптувати до поточної структури проєкту.

## 9.2. Рекомендовані keys

```text
bookDetails.readingProgress.title
bookDetails.readingProgress.summaryTitle
bookDetails.readingProgress.started
bookDetails.readingProgress.updated
bookDetails.readingProgress.finished
bookDetails.readingProgress.paused
bookDetails.readingProgress.abandoned
bookDetails.readingProgress.remaining
bookDetails.readingProgress.duration
bookDetails.readingProgress.activeDays
bookDetails.readingProgress.averagePerActiveDay
bookDetails.readingProgress.bestDay
bookDetails.readingProgress.estimatedDaysRemaining
bookDetails.readingProgress.incompleteHistory
bookDetails.readingProgress.incompleteHistoryHint
bookDetails.readingProgress.activityTitle
bookDetails.readingProgress.range7d
bookDetails.readingProgress.range14d
bookDetails.readingProgress.rangeAll
bookDetails.readingProgress.noActivityInRange
bookDetails.readingProgress.recentActivity
bookDetails.readingProgress.viewFullHistory

bookDetails.readingHistory.tab
bookDetails.readingHistory.title
bookDetails.readingHistory.subtitle
bookDetails.readingHistory.allUpdates
bookDetails.readingHistory.newestFirst
bookDetails.readingHistory.oldestFirst
bookDetails.readingHistory.toPage
bookDetails.readingHistory.fromPageToPage
bookDetails.readingHistory.recordedTimeHint
bookDetails.readingHistory.emptyTitle
bookDetails.readingHistory.emptySubtitle
bookDetails.readingHistory.loadError
bookDetails.readingHistory.retry
```

## 9.3. Dates

Calendar-only date:

- UA `12 бер. 2026`;
- EN `Mar 12, 2026`.

Не форматувати `YYYY-MM-DD` через uncontrolled `new Date(date)`, щоб timezone не змістив день. Використати date-only helper/parser проєкту.

`recordedAt` форматувати як datetime.

## 9.4. Time

Форматувати locale-aware, наприклад `10:20`.

Не називати `recordedAt` фактичним часом читання.

## 9.5. Numbers

Використати централізований helper або `Intl.NumberFormat`.

Не зберігати formatted strings у state.
