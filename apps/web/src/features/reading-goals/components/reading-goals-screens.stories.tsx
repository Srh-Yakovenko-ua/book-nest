import type {
  ReadingGoalBookReading,
  ReadingGoalBookView,
  ReadingGoalDetail,
  ReadingGoalListResponse,
} from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { getSettingsControllerGetSettingsUrl } from "@/shared/api/generated/endpoints/profile/profile";
import {
  getReadingGoalsControllerListUrl,
  getReadingGoalsControllerOverviewUrl,
} from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import {
  makeReadingGoalActivity,
  makeReadingGoalBook,
  makeReadingGoalCheckpoint,
  makeReadingGoalDetail,
  makeReadingGoalsOverview,
} from "../model/reading-goals.fixtures";
import { GoalDetailsView } from "./goal-details-view";
import { GoalsCatalog } from "./goals-catalog";

type CountedBookSeed = {
  book: ShelfBook;
  finishedAt: string;
  position: number;
  startedAt: string;
};

type GoalsPageFrameProps = {
  children: ReactNode;
  page: keyof typeof GOALS_PAGE_MAIN;
};

type RemainingBookSeed = {
  book: ShelfBook;
  position: number;
  progress?: ShelfProgress;
};

type ShelfBook = {
  author: string;
  id: string;
  pages: number;
  title: string;
};

type ShelfProgress = Omit<ReadingGoalBookReading, "pagesCount">;

const GOALS_PAGE_MAIN = {
  catalog: "mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12",
  detail: "mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12",
} as const;

const PROFILE_SETTINGS_STUB = {
  [getSettingsControllerGetSettingsUrl()]: defaultUserProfileSettings,
};

const UNREAD_PROGRESS = {
  currentPage: null,
  finishedAt: null,
  startedAt: null,
  status: "not_started",
} as const satisfies ShelfProgress;

const SHELF = {
  amadoka: {
    author: "Софія Андрухович",
    id: "book-amadoka",
    pages: 832,
    title: "Амадока",
  },
  chornyiVoron: {
    author: "Василь Шкляр",
    id: "book-chornyi-voron",
    pages: 400,
    title: "Чорний ворон",
  },
  dotsia: {
    author: "Тамара Горіха Зерня",
    id: "book-dotsia",
    pages: 320,
    title: "Доця",
  },
  felixAustria: {
    author: "Софія Андрухович",
    id: "book-felix-austria",
    pages: 288,
    title: "Felix Austria",
  },
  internat: {
    author: "Сергій Жадан",
    id: "book-internat",
    pages: 336,
    title: "Інтернат",
  },
  kaidashevaSimia: {
    author: "Іван Нечуй-Левицький",
    id: "book-kaidasheva-simia",
    pages: 192,
    title: "Кайдашева сімʼя",
  },
  khibaRevutVoly: {
    author: "Панас Мирний",
    id: "book-khiba-revut-voly",
    pages: 416,
    title: "Хіба ревуть воли, як ясла повні?",
  },
  maizheNikolyNeNavpaky: {
    author: "Марія Матіос",
    id: "book-maizhe-nikoly-ne-navpaky",
    pages: 240,
    title: "Майже ніколи не навпаки",
  },
  mesopotamiia: {
    author: "Сергій Жадан",
    id: "book-mesopotamiia",
    pages: 352,
    title: "Месопотамія",
  },
  misto: {
    author: "Валерʼян Підмогильний",
    id: "book-misto",
    pages: 288,
    title: "Місто",
  },
  muzeiPokynutykhSekretiv: {
    author: "Оксана Забужко",
    id: "book-muzei-pokynutykh-sekretiv",
    pages: 832,
    title: "Музей покинутих секретів",
  },
  neOzyraisiaIMovchy: {
    author: "Макс Кідрук",
    id: "book-ne-ozyraisia-i-movchy",
    pages: 512,
    title: "Не озирайся і мовчи",
  },
  rekreatsii: {
    author: "Юрій Андрухович",
    id: "book-rekreatsii",
    pages: 160,
    title: "Рекреації",
  },
  solodkaDarusia: {
    author: "Марія Матіос",
    id: "book-solodka-darusia",
    pages: 224,
    title: "Солодка Даруся",
  },
  soniachnaMashyna: {
    author: "Володимир Винниченко",
    id: "book-soniachna-mashyna",
    pages: 480,
    title: "Сонячна машина",
  },
  tanhoSmerti: {
    author: "Юрій Винничук",
    id: "book-tanho-smerti",
    pages: 384,
    title: "Танго смерті",
  },
  tiniZabutykhPredkiv: {
    author: "Михайло Коцюбинський",
    id: "book-tini-zabutykh-predkiv",
    pages: 128,
    title: "Тіні забутих предків",
  },
  tyhrolovy: {
    author: "Іван Багряний",
    id: "book-tyhrolovy",
    pages: 256,
    title: "Тигролови",
  },
  zapyskySamashedshoho: {
    author: "Ліна Костенко",
    id: "book-zapysky-samashedshoho",
    pages: 416,
    title: "Записки українського самашедшого",
  },
  zemlia: {
    author: "Ольга Кобилянська",
    id: "book-zemlia",
    pages: 304,
    title: "Земля",
  },
  zhovtyiKniaz: {
    author: "Василь Барка",
    id: "book-zhovtyi-kniaz",
    pages: 320,
    title: "Жовтий князь",
  },
} as const satisfies Record<string, ShelfBook>;

function bookRef({ id, title }: ShelfBook): Pick<ShelfBook, "id" | "title"> {
  return { id, title };
}

function countedBook({
  book,
  finishedAt,
  position,
  startedAt,
}: CountedBookSeed): ReadingGoalBookView {
  return makeReadingGoalBook({
    authors: [{ id: `author-${book.id}`, name: book.author }],
    countedFinishedAt: finishedAt,
    id: book.id,
    reading: {
      currentPage: null,
      finishedAt,
      pagesCount: book.pages,
      startedAt,
      status: "finished",
    },
    snapshotPosition: position,
    title: book.title,
  });
}

function GoalsPageFrame({ children, page }: GoalsPageFrameProps) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-background text-foreground">
      <main className={GOALS_PAGE_MAIN[page]}>{children}</main>
    </div>
  );
}

function jsonResponse({ body, status }: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeStoryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
  });
}

function remainingBook({
  book,
  position,
  progress = UNREAD_PROGRESS,
}: RemainingBookSeed): ReadingGoalBookView {
  return makeReadingGoalBook({
    authors: [{ id: `author-${book.id}`, name: book.author }],
    countedFinishedAt: null,
    id: book.id,
    qualifies: false,
    reading: { ...progress, pagesCount: book.pages },
    snapshotPosition: position,
    title: book.title,
  });
}

function requestPath(input: RequestInfo | URL): string {
  const url = input instanceof Request ? input.url : String(input);
  return new URL(url, globalThis.location.origin).pathname;
}

function StoryQueryClient({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeStoryQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function stubApi(routes: Record<string, unknown>): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const path = requestPath(input);
    if (path in routes) return jsonResponse({ body: routes[path], status: 200 });
    return jsonResponse({ body: { message: `No story stub for ${path}` }, status: 404 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

const SCREEN_GOALS = {
  archived: makeReadingGoalDetail({
    activityPreview: [
      makeReadingGoalActivity({
        book: null,
        createdAt: "2026-08-12T16:40:00.000Z",
        id: "activity-summer-6",
        metadata: { result: null },
        type: "goal_archived",
      }),
      makeReadingGoalActivity({
        book: null,
        createdAt: "2026-07-30T18:20:00.000Z",
        id: "activity-summer-5",
        metadata: { from: "2026-08-31", to: "2026-09-30" },
        type: "deadline_changed",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.solodkaDarusia),
        createdAt: "2026-07-28T20:15:00.000Z",
        id: "activity-summer-4",
        metadata: { completedCount: 3, finishedAt: "2026-07-28", targetCount: 8 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.felixAustria),
        createdAt: "2026-07-09T19:30:00.000Z",
        id: "activity-summer-3",
        metadata: { completedCount: 2, finishedAt: "2026-07-09", targetCount: 8 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.dotsia),
        createdAt: "2026-06-20T17:50:00.000Z",
        id: "activity-summer-2",
        metadata: { completedCount: 1, finishedAt: "2026-06-20", targetCount: 8 },
        type: "book_counted",
      }),
    ],
    actualBooksPerDay: 0.041,
    archivedAt: "2026-08-12T16:40:00.000Z",
    averageDaysPerBook: 24.3,
    checkpoints: [
      makeReadingGoalCheckpoint({
        achievedAt: "2026-07-09",
        currentCompletedCount: 3,
        dueDate: "2026-06-24",
        status: "missed",
        targetCount: 2,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-07-19",
        status: "missed",
        targetCount: 4,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-08-12",
        status: "missed",
        targetCount: 5,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-09-06",
        status: "missed",
        targetCount: 7,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 3,
        dueDate: "2026-09-30",
        status: "missed",
        targetCount: 8,
      }),
    ],
    completedAt: null,
    completedCount: 3,
    countedBooks: [
      countedBook({
        book: SHELF.dotsia,
        finishedAt: "2026-06-20",
        position: 0,
        startedAt: "2026-06-05",
      }),
      countedBook({
        book: SHELF.felixAustria,
        finishedAt: "2026-07-09",
        position: 1,
        startedAt: "2026-06-22",
      }),
      countedBook({
        book: SHELF.solodkaDarusia,
        finishedAt: "2026-07-28",
        position: 2,
        startedAt: "2026-07-15",
      }),
    ],
    createdAt: "2026-06-01T07:00:00.000Z",
    daysLeft: null,
    daysSinceLastCounted: null,
    deadline: "2026-09-30",
    elapsedDays: 73,
    elapsedPercent: 59.8,
    expectedCompletedCount: 4.79,
    id: "goal-summer-prose",
    lastCountedAt: "2026-07-28",
    list: { id: "list-summer-prose", name: "Літо з сучасною прозою" },
    listBookCount: 8,
    name: null,
    pace: null,
    paceDeltaBooks: null,
    paceDeltaPercent: null,
    progressPercent: 37.5,
    projectedCompletionDate: null,
    projectedDaysDelta: null,
    projectionConfidence: "none",
    remainingBooks: [
      remainingBook({
        book: SHELF.tanhoSmerti,
        position: 3,
        progress: {
          currentPage: 150,
          finishedAt: null,
          startedAt: "2026-08-01",
          status: "paused",
        },
      }),
      remainingBook({ book: SHELF.muzeiPokynutykhSekretiv, position: 4 }),
      remainingBook({ book: SHELF.amadoka, position: 5 }),
      remainingBook({ book: SHELF.zapyskySamashedshoho, position: 6 }),
      remainingBook({ book: SHELF.neOzyraisiaIMovchy, position: 7 }),
    ],
    remainingCount: 5,
    requiredBooksPerDay: null,
    requiredDaysPerBook: null,
    result: null,
    riskLevel: "none",
    riskReasons: [],
    snapshotBookCount: 8,
    status: "archived",
    targetCount: 8,
    totalDays: 122,
  }),
  completed: makeReadingGoalDetail({
    activityPreview: [
      makeReadingGoalActivity({
        book: null,
        createdAt: "2026-11-18T19:58:01.000Z",
        id: "activity-autumn-7",
        metadata: { completedAt: "2026-11-18", daysBeforeDeadline: 43 },
        type: "goal_completed",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.khibaRevutVoly),
        createdAt: "2026-11-18T19:58:00.000Z",
        id: "activity-autumn-6",
        metadata: { completedCount: 5, finishedAt: "2026-11-18", targetCount: 5 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.tyhrolovy),
        createdAt: "2026-11-13T20:40:00.000Z",
        id: "activity-autumn-5",
        metadata: { completedCount: 4, finishedAt: "2026-11-13", targetCount: 5 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.misto),
        createdAt: "2026-11-08T18:10:00.000Z",
        id: "activity-autumn-4",
        metadata: { completedCount: 3, finishedAt: "2026-11-08", targetCount: 5 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: bookRef(SHELF.zemlia),
        createdAt: "2026-10-23T19:45:00.000Z",
        id: "activity-autumn-3",
        metadata: { completedCount: 2, finishedAt: "2026-10-23", targetCount: 5 },
        type: "book_counted",
      }),
    ],
    actualBooksPerDay: 0.063,
    archivedAt: null,
    averageDaysPerBook: 15.8,
    checkpoints: [
      makeReadingGoalCheckpoint({
        achievedAt: "2026-09-14",
        currentCompletedCount: 5,
        dueDate: "2026-09-24",
        status: "achieved",
        targetCount: 1,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: "2026-10-23",
        currentCompletedCount: 5,
        dueDate: "2026-10-19",
        status: "missed",
        targetCount: 2,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: "2026-11-08",
        currentCompletedCount: 5,
        dueDate: "2026-11-12",
        status: "achieved",
        targetCount: 3,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: "2026-11-13",
        currentCompletedCount: 5,
        dueDate: "2026-12-07",
        status: "achieved",
        targetCount: 4,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: "2026-11-18",
        currentCompletedCount: 5,
        dueDate: "2026-12-31",
        status: "achieved",
        targetCount: 5,
      }),
    ],
    completedAt: "2026-11-18",
    completedCount: 5,
    countedBooks: [
      countedBook({
        book: SHELF.tiniZabutykhPredkiv,
        finishedAt: "2026-09-14",
        position: 0,
        startedAt: "2026-09-03",
      }),
      countedBook({
        book: SHELF.zemlia,
        finishedAt: "2026-10-23",
        position: 1,
        startedAt: "2026-09-20",
      }),
      countedBook({
        book: SHELF.misto,
        finishedAt: "2026-11-08",
        position: 2,
        startedAt: "2026-10-25",
      }),
      countedBook({
        book: SHELF.tyhrolovy,
        finishedAt: "2026-11-13",
        position: 3,
        startedAt: "2026-11-09",
      }),
      countedBook({
        book: SHELF.khibaRevutVoly,
        finishedAt: "2026-11-18",
        position: 4,
        startedAt: "2026-10-28",
      }),
    ],
    createdAt: "2026-09-01T08:30:00.000Z",
    daysLeft: null,
    daysSinceLastCounted: null,
    deadline: "2026-12-31",
    elapsedDays: 79,
    elapsedPercent: 64.8,
    expectedCompletedCount: 3.24,
    id: "goal-autumn-classics",
    lastCountedAt: "2026-11-18",
    list: { id: "list-ua-classics", name: "Українська класика" },
    listBookCount: 6,
    name: "Осіння класика",
    pace: null,
    paceDeltaBooks: null,
    paceDeltaPercent: null,
    progressPercent: 100,
    projectedCompletionDate: "2026-11-18",
    projectedDaysDelta: 43,
    projectionConfidence: "high",
    remainingBooks: [
      remainingBook({
        book: SHELF.zhovtyiKniaz,
        position: 5,
        progress: {
          currentPage: 140,
          finishedAt: null,
          startedAt: "2026-11-20",
          status: "reading",
        },
      }),
    ],
    remainingCount: 0,
    requiredBooksPerDay: null,
    requiredDaysPerBook: null,
    result: "completed",
    riskLevel: "none",
    riskReasons: [],
    snapshotBookCount: 6,
    status: "completed",
    targetCount: 5,
    totalDays: 122,
  }),
  lowConfidence: makeReadingGoalDetail({
    activityPreview: [
      makeReadingGoalActivity({
        book: bookRef(SHELF.internat),
        createdAt: "2026-11-19T19:42:00.000Z",
        id: "activity-winter-2",
        metadata: { completedCount: 1, finishedAt: "2026-11-19", targetCount: 6 },
        type: "book_counted",
      }),
      makeReadingGoalActivity({
        book: null,
        createdAt: "2026-11-10T09:15:00.000Z",
        id: "activity-winter-1",
        metadata: { deadline: "2027-01-31", snapshotBookCount: 7, targetCount: 6 },
        type: "goal_created",
      }),
    ],
    actualBooksPerDay: 0.067,
    archivedAt: null,
    averageDaysPerBook: 15,
    checkpoints: [
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 1,
        dueDate: "2026-11-26",
        status: "upcoming",
        targetCount: 2,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 1,
        dueDate: "2026-12-12",
        status: "upcoming",
        targetCount: 3,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 1,
        dueDate: "2026-12-29",
        status: "upcoming",
        targetCount: 4,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 1,
        dueDate: "2027-01-14",
        status: "upcoming",
        targetCount: 5,
      }),
      makeReadingGoalCheckpoint({
        achievedAt: null,
        currentCompletedCount: 1,
        dueDate: "2027-01-31",
        status: "upcoming",
        targetCount: 6,
      }),
    ],
    completedAt: null,
    completedCount: 1,
    countedBooks: [
      countedBook({
        book: SHELF.internat,
        finishedAt: "2026-11-19",
        position: 0,
        startedAt: "2026-11-11",
      }),
    ],
    createdAt: "2026-11-10T09:15:00.000Z",
    daysLeft: 68,
    daysSinceLastCounted: 5,
    deadline: "2027-01-31",
    elapsedDays: 15,
    elapsedPercent: 18.1,
    expectedCompletedCount: 1.08,
    id: "goal-winter-reading",
    lastCountedAt: "2026-11-19",
    list: { id: "list-winter-shelf", name: "Зимова полиця" },
    listBookCount: 7,
    name: "Зимове читання",
    pace: "on_track",
    paceDeltaBooks: -0.08,
    paceDeltaPercent: -1.4,
    progressPercent: 16.7,
    projectedCompletionDate: "2027-02-07",
    projectedDaysDelta: -7,
    projectionConfidence: "low",
    remainingBooks: [
      remainingBook({
        book: SHELF.mesopotamiia,
        position: 1,
        progress: {
          currentPage: 96,
          finishedAt: null,
          startedAt: "2026-11-20",
          status: "reading",
        },
      }),
      remainingBook({ book: SHELF.rekreatsii, position: 2 }),
      remainingBook({ book: SHELF.chornyiVoron, position: 3 }),
      remainingBook({ book: SHELF.maizheNikolyNeNavpaky, position: 4 }),
      remainingBook({ book: SHELF.soniachnaMashyna, position: 5 }),
      remainingBook({ book: SHELF.kaidashevaSimia, position: 6 }),
    ],
    remainingCount: 5,
    requiredBooksPerDay: 0.072,
    requiredDaysPerBook: 13.8,
    result: null,
    riskLevel: "none",
    riskReasons: [],
    snapshotBookCount: 7,
    status: "active",
    targetCount: 6,
    totalDays: 83,
  }),
};

const meta = {
  decorators: [
    (Story) => (
      <StoryQueryClient>
        <Story />
      </StoryQueryClient>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Reading Goals/Screens",
} satisfies Meta;

export default meta;

type Story = StoryObj;

function goalDetailScreen(goal: ReadingGoalDetail): Story {
  return {
    beforeEach: () => stubApi(PROFILE_SETTINGS_STUB),
    render: () => (
      <GoalsPageFrame page="detail">
        <GoalDetailsView goal={goal} />
      </GoalsPageFrame>
    ),
  };
}

export const EmptyCatalog: Story = {
  beforeEach: () =>
    stubApi({
      ...PROFILE_SETTINGS_STUB,
      [getReadingGoalsControllerListUrl()]: {
        items: [],
        nextCursor: null,
      } satisfies ReadingGoalListResponse,
      [getReadingGoalsControllerOverviewUrl()]: makeReadingGoalsOverview({
        active: { needsAttention: 0, onTrack: 0, total: 0 },
        attention: [],
        bestResult: null,
        booksCounted: { currentYear: 0 },
        completed: { completedOnOrBeforeDeadline: 0, total: 0 },
        success: { finishedGoals: 0, successfulGoals: 0, successRatePercent: 0 },
      }),
    }),
  render: () => (
    <GoalsPageFrame page="catalog">
      <GoalsCatalog />
    </GoalsPageFrame>
  ),
};

export const CompletedGoal: Story = goalDetailScreen(SCREEN_GOALS.completed);

export const ArchivedGoal: Story = goalDetailScreen(SCREEN_GOALS.archived);

export const LowConfidenceForecast: Story = goalDetailScreen(SCREEN_GOALS.lowConfidence);
