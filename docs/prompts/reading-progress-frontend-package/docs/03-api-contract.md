# 3. Очікуваний API-контракт

Фактичний generated client має пріоритет над прикладом нижче. Відмінності в назвах допустимі, якщо семантика повністю покрита.

## Request

```http
GET /api/books/:id/reading-history
```

```ts
{
  activityRange?: "7d" | "14d" | "all";
  page?: number;
  limit?: number;
  sort?: "asc" | "desc";
}
```

## Response

```ts
{
  summary: {
    status: ReadingStatus;

    currentPage: number;
    pagesCount: number | null;
    progressPercent: number | null;
    pagesRemaining: number | null;

    startedAt: string | null;
    finishedAt: string | null;
    pausedAt: string | null;
    abandonedAt: string | null;
    lastProgressUpdateAt: string | null;

    readingPeriod: {
      startDate: string | null;
      endDate: string | null;
      calendarDays: number | null;
    };

    activeDaysCount: number;
    updatesCount: number;
    trackedPagesRead: number;
    averagePagesPerActiveDay: number | null;

    bestDay: {
      date: string;
      pagesRead: number;
      updatesCount: number;
      finalPage: number | null;
    } | null;

    lastActivity: {
      date: string;
      pagesRead: number;
      updatesCount: number;
      finalPage: number | null;
    } | null;

    estimatedActiveDaysRemaining: number | null;

    historyCompleteness: {
      isComplete: boolean;
      untrackedPages: number;
    };
  };

  activity: {
    range: "7d" | "14d" | "all";
    from: string | null;
    to: string | null;

    summary: {
      activeDaysCount: number;
      pagesRead: number;
      updatesCount: number;
      averagePagesPerActiveDay: number | null;
      bestDay: {
        date: string;
        pagesRead: number;
        updatesCount: number;
        finalPage: number | null;
      } | null;
    };

    points: Array<{
      date: string;
      pagesRead: number;
      updatesCount: number;
      startPage: number | null;
      finalPage: number | null;
      hasActivity: boolean;
    }>;
  };

  history: {
    days: Array<{
      date: string;
      pagesRead: number;
      updatesCount: number;
      startPage: number;
      finalPage: number;

      events: Array<{
        id: string;
        date: string;
        page: number;
        pagesRead: number;
        recordedAt: string | null;
      }>;
    }>;

    pagination: {
      page: number;
      limit: number;
      totalDays: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

## Frontend може лише

- форматувати дати й числа;
- локалізувати тексти;
- керувати UI state;
- передавати query parameters;
- вибирати поля відповідно до статусу;
- відображати готові arrays.

## Frontend не може

- групувати events;
- рахувати summary або activity metrics;
- обчислювати percentage, remaining, duration, forecast чи completeness;
- реконструювати start/final page із сусідніх точок;
- додавати пропущені календарні дні;
- перевіряти повноту журналу власною математикою.
