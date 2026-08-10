import type { ReadingGoalBook, ReadingGoalDetail, ReadingGoalView } from "@app/shared";

export function makeReadingGoalBook(overrides: Partial<ReadingGoalBook> = {}): ReadingGoalBook {
  return {
    authors: [{ id: "author-1", name: "Ольга Токарчук" }],
    cover: null,
    finishedAt: "2026-11-03",
    id: "book-1",
    title: "Бігуни",
    ...overrides,
  };
}

export function makeReadingGoalDetail(
  overrides: Partial<ReadingGoalDetail> = {},
): ReadingGoalDetail {
  return {
    ...makeReadingGoalView(),
    countedBooks: [makeReadingGoalBook()],
    listBookCount: 20,
    ...overrides,
  };
}

export function makeReadingGoalView(overrides: Partial<ReadingGoalView> = {}): ReadingGoalView {
  return {
    completedAt: null,
    completedCount: 5,
    createdAt: "2026-09-01T10:00:00.000Z",
    daysLeft: 12,
    deadline: "2026-11-30",
    id: "goal-1",
    list: { id: "list-1", name: "Книги на осінь" },
    name: null,
    remainingCount: 3,
    status: "active",
    targetCount: 8,
    ...overrides,
  };
}
