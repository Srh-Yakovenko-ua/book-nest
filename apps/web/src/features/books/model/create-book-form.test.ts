import { QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { CreateBookFormValues } from "./create-book-form";

import {
  createBookFormDefaults,
  CreateBookFormSchema,
  UpdateBookFormSchema,
} from "./create-book-form";
import { QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE } from "./queue-priority";

function customTextIssues(values: CreateBookFormValues) {
  const result = CreateBookFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.filter(
    (issue) => issue.path.join(".") === "queuePriorityReasonCustomText",
  );
}

function formValues(overrides: Partial<CreateBookFormValues> = {}): CreateBookFormValues {
  return {
    ...createBookFormDefaults,
    authors: [{ name: "Анджей Сапковський" }],
    title: "Останнє бажання",
    ...overrides,
  };
}

function queuedHigh(overrides: Partial<CreateBookFormValues> = {}): CreateBookFormValues {
  return formValues({ addToReadingQueue: true, queuePriority: "high", ...overrides });
}

describe("CreateBookFormSchema queue priority validation", () => {
  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a null value", null],
  ])("rejects the other reason with %s as custom text", (_label, text) => {
    const issues = customTextIssues(
      queuedHigh({ queuePriorityReason: "other", queuePriorityReasonCustomText: text }),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe(QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE);
  });

  it("accepts the other reason with real custom text", () => {
    const result = CreateBookFormSchema.safeParse(
      queuedHigh({
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "Хочу прочитати перед відпусткою",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects custom text longer than the shared maximum", () => {
    const issues = customTextIssues(
      queuedHigh({
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "я".repeat(QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX + 1),
      }),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("too_big");
  });

  it("accepts custom text at exactly the shared maximum", () => {
    const result = CreateBookFormSchema.safeParse(
      queuedHigh({
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "я".repeat(QUEUE_PRIORITY_REASON_CUSTOM_TEXT_MAX),
      }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts a high priority without a reason", () => {
    const result = CreateBookFormSchema.safeParse(queuedHigh());

    expect(result.success).toBe(true);
  });

  it("accepts a high priority with a reason and a target date", () => {
    const result = CreateBookFormSchema.safeParse(
      queuedHigh({ queuePriorityReason: "book_club", queuePriorityTargetDate: "2026-08-24" }),
    );

    expect(result.success).toBe(true);
  });

  it.each(["normal", "low"] as const)("accepts the %s priority with no extra data", (priority) => {
    const result = CreateBookFormSchema.safeParse(
      formValues({ addToReadingQueue: true, queuePriority: priority }),
    );

    expect(result.success).toBe(true);
  });

  it.each(["normal", "low"] as const)(
    "does not demand custom text for a stale other reason under the %s priority",
    (priority) => {
      const issues = customTextIssues(
        formValues({
          addToReadingQueue: true,
          queuePriority: priority,
          queuePriorityReason: "other",
          queuePriorityReasonCustomText: "",
        }),
      );

      expect(issues).toEqual([]);
    },
  );

  it("does not demand custom text when the book stays out of the queue", () => {
    const issues = customTextIssues(
      formValues({
        addToReadingQueue: false,
        queuePriority: "high",
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "",
      }),
    );

    expect(issues).toEqual([]);
  });

  it("rejects a target date that is not an ISO day", () => {
    const result = CreateBookFormSchema.safeParse(
      queuedHigh({ queuePriorityReason: "book_club", queuePriorityTargetDate: "24.08.2026" }),
    );

    expect(result.success).toBe(false);
  });
});

describe("UpdateBookFormSchema queue priority validation", () => {
  it("rejects the other reason without custom text", () => {
    const result = UpdateBookFormSchema.safeParse({
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "  ",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the other reason with custom text", () => {
    const result = UpdateBookFormSchema.safeParse({
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "Позичив у друга",
    });

    expect(result.success).toBe(true);
  });
});

describe("createBookFormDefaults", () => {
  it("starts a new book outside the reading queue with no priority details", () => {
    expect(createBookFormDefaults.addToReadingQueue).toBe(false);
    expect(createBookFormDefaults.queuePriorityReason).toBeNull();
    expect(createBookFormDefaults.queuePriorityReasonCustomText).toBeNull();
    expect(createBookFormDefaults.queuePriorityTargetDate).toBeNull();
  });
});
