import { describe, expect, it } from "vitest";

import { makeBookView } from "../components/book-details.fixtures";
import { bookViewToFormState } from "./book-view-to-form";

describe("bookViewToFormState queue priority hydration", () => {
  it("hydrates a high priority with its reason and target date", () => {
    const { values } = bookViewToFormState(
      makeBookView({
        isInReadingQueue: true,
        queuePriority: "high",
        queuePriorityReason: "book_club",
        queuePriorityReasonCustomText: null,
        queuePriorityTargetDate: "2026-08-24",
      }),
    );

    expect(values.addToReadingQueue).toBe(true);
    expect(values.queuePriority).toBe("high");
    expect(values.queuePriorityReason).toBe("book_club");
    expect(values.queuePriorityTargetDate).toBe("2026-08-24");
  });

  it("hydrates the stored custom text of the other reason", () => {
    const { values } = bookViewToFormState(
      makeBookView({
        isInReadingQueue: true,
        queuePriority: "high",
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "Хочу прочитати перед відпусткою",
      }),
    );

    expect(values.queuePriorityReason).toBe("other");
    expect(values.queuePriorityReasonCustomText).toBe("Хочу прочитати перед відпусткою");
  });

  it("keeps the target date exactly as the API stored it", () => {
    const { values } = bookViewToFormState(
      makeBookView({
        isInReadingQueue: true,
        queuePriority: "high",
        queuePriorityReason: "return_due",
        queuePriorityTargetDate: "2026-01-01",
      }),
    );

    expect(values.queuePriorityTargetDate).toBe("2026-01-01");
  });

  it("hydrates a legacy record that carries no priority details", () => {
    const { values } = bookViewToFormState(
      makeBookView({
        isInReadingQueue: true,
        queuePriority: null,
        queuePriorityReason: null,
        queuePriorityReasonCustomText: null,
        queuePriorityTargetDate: null,
      }),
    );

    expect(values.addToReadingQueue).toBe(true);
    expect(values.queuePriority).toBeUndefined();
    expect(values.queuePriorityReason).toBeUndefined();
    expect(values.queuePriorityReasonCustomText).toBeUndefined();
    expect(values.queuePriorityTargetDate).toBeUndefined();
  });

  it("leaves a book outside the queue without queue details", () => {
    const { values } = bookViewToFormState(makeBookView({ isInReadingQueue: false }));

    expect(values.addToReadingQueue).toBe(false);
  });

  it("does not invent a reason for a low priority book", () => {
    const { values } = bookViewToFormState(
      makeBookView({ isInReadingQueue: true, queuePriority: "low" }),
    );

    expect(values.queuePriority).toBe("low");
    expect(values.queuePriorityReason).toBeUndefined();
  });
});

describe("bookViewToFormState purchase hydration", () => {
  it("leaves the stored purchase note out of the form values", () => {
    const { values } = bookViewToFormState(
      makeBookView({
        ownershipStatus: "want_to_buy",
        purchaseInfo: {
          currency: "UAH",
          expectedPrice: 450,
          note: "Дочекатися знижки",
          purchasedAt: null,
          storeName: "Yakaboo",
          storeUrl: null,
        },
      }),
    );

    expect(values.purchaseInfo).toStrictEqual({
      currency: "UAH",
      expectedPrice: 450,
      storeName: "Yakaboo",
      storeUrl: undefined,
    });
    expect(values.purchaseInfo).not.toHaveProperty("note");
  });
});
