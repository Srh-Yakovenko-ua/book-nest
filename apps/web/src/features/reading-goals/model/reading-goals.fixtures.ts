import type {
  ReadingGoalActivityView,
  ReadingGoalBookView,
  ReadingGoalCheckpoint,
  ReadingGoalDetail,
  ReadingGoalListItem,
  ReadingGoalMetrics,
  ReadingGoalsOverview,
  ReadingGoalView,
} from "@app/shared";

export function makeReadingGoalActivity(
  overrides: Partial<ReadingGoalActivityView> = {},
): ReadingGoalActivityView {
  return {
    book: { id: "book-1", title: "Бігуни" },
    createdAt: "2026-11-03T12:00:00.000Z",
    id: "activity-1",
    metadata: null,
    type: "book_counted",
    ...overrides,
  };
}

export function makeReadingGoalBook(
  overrides: Partial<ReadingGoalBookView> = {},
): ReadingGoalBookView {
  return {
    authors: [{ id: "author-1", name: "Ольга Токарчук" }],
    countedFinishedAt: "2026-11-03",
    cover: null,
    id: "book-1",
    ownershipStatus: "owned",
    qualifies: true,
    reading: {
      currentPage: null,
      finishedAt: "2026-11-03",
      pagesCount: 320,
      startedAt: "2026-10-20",
      status: "finished",
    },
    snapshotPosition: 0,
    title: "Бігуни",
    ...overrides,
  };
}

export function makeReadingGoalCheckpoint(
  overrides: Partial<ReadingGoalCheckpoint> = {},
): ReadingGoalCheckpoint {
  return {
    achievedAt: null,
    currentCompletedCount: 5,
    dueDate: "2026-10-15",
    status: "upcoming",
    targetCount: 4,
    ...overrides,
  };
}

export function makeReadingGoalDetail(
  overrides: Partial<ReadingGoalDetail> = {},
): ReadingGoalDetail {
  return {
    ...makeReadingGoalView(),
    ...makeReadingGoalMetrics(),
    activityPreview: [],
    checkpoints: [],
    countedBooks: [makeReadingGoalBook()],
    listBookCount: 20,
    remainingBooks: [],
    snapshotBookCount: 8,
    ...overrides,
  };
}

export function makeReadingGoalListItem(
  overrides: Partial<ReadingGoalListItem> = {},
): ReadingGoalListItem {
  return { ...makeReadingGoalView(), ...makeReadingGoalMetrics(), ...overrides };
}

export function makeReadingGoalMetrics(
  overrides: Partial<ReadingGoalMetrics> = {},
): ReadingGoalMetrics {
  return {
    actualBooksPerDay: 0.2,
    averageDaysPerBook: 5,
    completedCount: 5,
    daysLeft: 12,
    daysSinceLastCounted: 2,
    elapsedDays: 25,
    elapsedPercent: 67.6,
    expectedCompletedCount: 5.4,
    lastCountedAt: "2026-11-03",
    pace: "on_track",
    paceDeltaBooks: -0.4,
    paceDeltaPercent: -5,
    progressPercent: 62.5,
    projectedCompletionDate: "2026-11-25",
    projectedDaysDelta: 5,
    projectionConfidence: "medium",
    remainingCount: 3,
    requiredBooksPerDay: 0.23,
    requiredDaysPerBook: 4.3,
    riskLevel: "none",
    riskReasons: [],
    totalDays: 37,
    ...overrides,
  };
}

export function makeReadingGoalsOverview(
  overrides: Partial<ReadingGoalsOverview> = {},
): ReadingGoalsOverview {
  return {
    active: { needsAttention: 1, onTrack: 2, total: 3 },
    attention: [],
    bestResult: null,
    booksCounted: { currentYear: 14 },
    completed: { completedOnOrBeforeDeadline: 4, total: 5 },
    success: { finishedGoals: 6, successfulGoals: 5, successRatePercent: 83.3 },
    ...overrides,
  };
}

export function makeReadingGoalView(overrides: Partial<ReadingGoalView> = {}): ReadingGoalView {
  return {
    archivedAt: null,
    completedAt: null,
    completedCount: 5,
    createdAt: "2026-09-01T10:00:00.000Z",
    daysLeft: 12,
    deadline: "2026-11-30",
    id: "goal-1",
    list: { id: "list-1", name: "Книги на осінь" },
    name: null,
    remainingCount: 3,
    result: null,
    status: "active",
    targetCount: 8,
    ...overrides,
  };
}
