import type { QueuePriorityReason } from "@app/shared";

import {
  QUEUE_PRIORITY_DATE_REASONS,
  QueuePriorityReasonSchema,
  queuePriorityReasonSupportsDate,
  QueuePrioritySchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

import type { QueuePriorityFields } from "./queue-priority";

import {
  buildQueuePriorityPayload,
  isCustomReasonMissing,
  QUEUE_PRIORITY_META,
  QUEUE_PRIORITY_ORDER,
  QUEUE_PRIORITY_REASON_ICONS,
  QUEUE_PRIORITY_REASON_LABEL_KEYS,
  QUEUE_PRIORITY_REASON_ORDER,
  reasonSupportsDate,
} from "./queue-priority";

const NON_DATE_REASONS = QueuePriorityReasonSchema.options.filter(
  (reason) => !queuePriorityReasonSupportsDate(reason),
);

function inQueue(overrides: QueuePriorityFields = {}): QueuePriorityFields {
  return { addToReadingQueue: true, queuePriority: "high", ...overrides };
}

describe("buildQueuePriorityPayload", () => {
  it("omits every queue field when the book is not added to the queue", () => {
    const payload = buildQueuePriorityPayload({
      addToReadingQueue: false,
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityReasonCustomText: "текст",
      queuePriorityTargetDate: "2026-08-24",
    });

    expect(payload).toEqual({
      addToReadingQueue: false,
      queuePriority: undefined,
      queuePriorityReason: undefined,
      queuePriorityReasonCustomText: undefined,
      queuePriorityTargetDate: undefined,
    });
  });

  it("keeps unrelated fields untouched", () => {
    const payload = buildQueuePriorityPayload({ ...inQueue(), title: "Книга" });

    expect(payload.title).toBe("Книга");
  });

  it("does not mutate its input", () => {
    const values = inQueue({
      queuePriority: "normal",
      queuePriorityReason: "book_club",
      queuePriorityReasonCustomText: "текст",
      queuePriorityTargetDate: "2026-08-24",
    });
    const snapshot = structuredClone(values);

    buildQueuePriorityPayload(values);

    expect(values).toEqual(snapshot);
  });

  it("falls back to the normal priority when none was chosen", () => {
    const values: QueuePriorityFields = { addToReadingQueue: true };

    const payload = buildQueuePriorityPayload(values);

    expect(payload.queuePriority).toBe("normal");
  });

  it.each(["normal", "low"] as const)("drops hidden values for the %s priority", (priority) => {
    const payload = buildQueuePriorityPayload(
      inQueue({
        queuePriority: priority,
        queuePriorityReason: "book_club",
        queuePriorityReasonCustomText: "текст",
        queuePriorityTargetDate: "2026-08-24",
      }),
    );

    expect(payload).toEqual({
      addToReadingQueue: true,
      queuePriority: priority,
      queuePriorityReason: null,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: null,
    });
  });

  it("sends a high priority without a reason as an empty reason", () => {
    const payload = buildQueuePriorityPayload(inQueue());

    expect(payload).toEqual({
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: null,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: null,
    });
  });

  it.each(QUEUE_PRIORITY_DATE_REASONS)("keeps the target date for the %s reason", (reason) => {
    const payload = buildQueuePriorityPayload(
      inQueue({ queuePriorityReason: reason, queuePriorityTargetDate: "2026-08-24" }),
    );

    expect(payload).toEqual({
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: reason,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: "2026-08-24",
    });
  });

  it.each(NON_DATE_REASONS)("drops the target date for the %s reason", (reason) => {
    const payload = buildQueuePriorityPayload(
      inQueue({ queuePriorityReason: reason, queuePriorityTargetDate: "2026-08-24" }),
    );

    expect(payload.queuePriorityTargetDate).toBeNull();
  });

  it("drops the target date when no reason is chosen", () => {
    const payload = buildQueuePriorityPayload(inQueue({ queuePriorityTargetDate: "2026-08-24" }));

    expect(payload.queuePriorityTargetDate).toBeNull();
  });

  it("keeps the trimmed custom text for the other reason", () => {
    const payload = buildQueuePriorityPayload(
      inQueue({
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "  Хочу прочитати перед відпусткою  ",
      }),
    );

    expect(payload).toEqual({
      addToReadingQueue: true,
      queuePriority: "high",
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "Хочу прочитати перед відпусткою",
      queuePriorityTargetDate: null,
    });
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a null value", null],
    ["an absent value", undefined],
  ])("turns %s custom text into null rather than an empty string", (_label, text) => {
    const payload = buildQueuePriorityPayload(
      inQueue({ queuePriorityReason: "other", queuePriorityReasonCustomText: text }),
    );

    expect(payload.queuePriorityReasonCustomText).toBeNull();
  });

  it("drops the custom text when the reason is not other", () => {
    const payload = buildQueuePriorityPayload(
      inQueue({ queuePriorityReason: "series_order", queuePriorityReasonCustomText: "текст" }),
    );

    expect(payload.queuePriorityReasonCustomText).toBeNull();
  });
});

describe("isCustomReasonMissing", () => {
  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a null value", null],
  ])("reports missing text when the other reason carries %s", (_label, text) => {
    expect(
      isCustomReasonMissing(
        inQueue({ queuePriorityReason: "other", queuePriorityReasonCustomText: text }),
      ),
    ).toBe(true);
  });

  it("accepts the other reason once real text is present", () => {
    expect(
      isCustomReasonMissing(
        inQueue({ queuePriorityReason: "other", queuePriorityReasonCustomText: "причина" }),
      ),
    ).toBe(false);
  });

  it("ignores an empty custom text for a reason other than other", () => {
    expect(
      isCustomReasonMissing(
        inQueue({ queuePriorityReason: "series_order", queuePriorityReasonCustomText: "" }),
      ),
    ).toBe(false);
  });

  it.each(["normal", "low"] as const)("ignores the hidden other reason for %s", (priority) => {
    expect(
      isCustomReasonMissing(
        inQueue({
          queuePriority: priority,
          queuePriorityReason: "other",
          queuePriorityReasonCustomText: "",
        }),
      ),
    ).toBe(false);
  });

  it("ignores the hidden other reason when the book is out of the queue", () => {
    expect(
      isCustomReasonMissing({
        addToReadingQueue: false,
        queuePriority: "high",
        queuePriorityReason: "other",
        queuePriorityReasonCustomText: "",
      }),
    ).toBe(false);
  });
});

describe("reasonSupportsDate", () => {
  it.each(QUEUE_PRIORITY_DATE_REASONS)("supports a date for the %s reason", (reason) => {
    expect(reasonSupportsDate(reason)).toBe(true);
  });

  it.each(NON_DATE_REASONS)("rejects a date for the %s reason", (reason) => {
    expect(reasonSupportsDate(reason)).toBe(false);
  });
});

describe("queue priority configuration", () => {
  it("orders the priorities from low to high", () => {
    expect(QUEUE_PRIORITY_ORDER).toEqual(["low", "normal", "high"]);
  });

  it("covers every priority of the shared contract", () => {
    expect([...QUEUE_PRIORITY_ORDER].sort()).toEqual([...QueuePrioritySchema.options].sort());
    expect(Object.keys(QUEUE_PRIORITY_META).sort()).toEqual(
      [...QueuePrioritySchema.options].sort(),
    );
  });

  it("covers every reason of the shared contract exactly once", () => {
    const expected = [...QueuePriorityReasonSchema.options].sort();
    expect([...QUEUE_PRIORITY_REASON_ORDER].sort()).toEqual(expected);
    expect(Object.keys(QUEUE_PRIORITY_REASON_ICONS).sort()).toEqual(expected);
    expect(Object.keys(QUEUE_PRIORITY_REASON_LABEL_KEYS).sort()).toEqual(expected);
  });

  it("offers the other reason last so the free-text option closes the list", () => {
    expect(QUEUE_PRIORITY_REASON_ORDER.at(-1)).toBe<QueuePriorityReason>("other");
  });
});
