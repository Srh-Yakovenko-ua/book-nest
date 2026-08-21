import type { CancelledPlanBook, CancelledPlanContext } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { CancelledPlanLabels } from "./cancelled-follow-up";

import { buildCancelledDecisionRows, buildCancelledPlanRows } from "./cancelled-follow-up";

const labels: CancelledPlanLabels = {
  goalNamed: (name) => `Ціль «${name}»`,
  goalsCount: (count) => `${count} активні цілі`,
  goalUnnamed: "Активна ціль",
  queue: "Черга читання",
  risk: (level) => (level === "critical" ? "критичний ризик" : null),
  seriesNext: "Наступна у серії",
};

function planBook(contexts: CancelledPlanContext[]): CancelledPlanBook {
  return {
    authorName: "Frank Herbert",
    contexts,
    cover: null,
    id: "book-1",
    title: "Поклик з могили",
  };
}

describe("buildCancelledDecisionRows", () => {
  it("dates the cancellation in the reader's locale", () => {
    const rows = buildCancelledDecisionRows({
      books: [
        {
          authorName: "Frank Herbert",
          cancelledAt: "2026-08-10T10:00:00.000Z",
          cancelReason: null,
          cover: null,
          id: "book-1",
          title: "Поклик з могили",
        },
      ],
      cancelledOn: (date) => `Скасовано ${date}`,
      locale: "uk",
    });

    expect(rows[0]?.cancelledOnText).toBe("Скасовано 10 серп. 2026 р.");
    expect(rows[0]?.bookHref).toBe("/books/book-1");
  });
});

describe("buildCancelledPlanRows", () => {
  it("joins every context of one book", () => {
    const rows = buildCancelledPlanRows({
      books: [
        planBook([
          { kind: "queue" },
          { goalName: "Осіннє читання", goalsCount: 1, kind: "goal", riskLevel: "critical" },
          { kind: "series_next" },
        ]),
      ],
      labels,
    });

    expect(rows[0]?.contextText).toBe(
      "Черга читання · Ціль «Осіннє читання» · критичний ризик · Наступна у серії",
    );
  });

  it("leaves out a risk the reader does not need to see", () => {
    const rows = buildCancelledPlanRows({
      books: [
        planBook([
          { goalName: "Осіннє читання", goalsCount: 1, kind: "goal", riskLevel: "medium" },
        ]),
      ],
      labels,
    });

    expect(rows[0]?.contextText).toBe("Ціль «Осіннє читання»");
  });

  it("falls back to a plain label for a goal without a name", () => {
    const rows = buildCancelledPlanRows({
      books: [planBook([{ goalName: null, goalsCount: 1, kind: "goal", riskLevel: "none" }])],
      labels,
    });

    expect(rows[0]?.contextText).toBe("Активна ціль");
  });

  it("counts the goals instead of naming one when there are several", () => {
    const rows = buildCancelledPlanRows({
      books: [planBook([{ goalName: null, goalsCount: 3, kind: "goal", riskLevel: "none" }])],
      labels,
    });

    expect(rows[0]?.contextText).toBe("3 активні цілі");
  });
});
