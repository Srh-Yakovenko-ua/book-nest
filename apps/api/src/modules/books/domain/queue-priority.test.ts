import { describe, expect, it } from "vitest";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import {
  EMPTY_QUEUE_PRIORITY_DETAILS,
  QUEUE_PRIORITY_CUSTOM_TEXT_HIGH_ONLY_MESSAGE,
  QUEUE_PRIORITY_CUSTOM_TEXT_OTHER_ONLY_MESSAGE,
  QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE,
  QUEUE_PRIORITY_REASON_HIGH_ONLY_MESSAGE,
  QUEUE_PRIORITY_TARGET_DATE_HIGH_ONLY_MESSAGE,
  QUEUE_PRIORITY_TARGET_DATE_REQUIRES_REASON_MESSAGE,
  QUEUE_PRIORITY_TARGET_DATE_UNSUPPORTED_MESSAGE,
  type QueuePriorityDetails,
  resolveQueuePriorityDetails,
} from "./queue-priority.js";

function catchBadRequest(run: () => unknown): BadRequestError {
  try {
    run();
  } catch (error) {
    if (error instanceof BadRequestError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected resolveQueuePriorityDetails to throw a BadRequestError");
}

describe("resolveQueuePriorityDetails high priority accepts the detail fields", () => {
  it("returns empty details when high priority carries no reason", () => {
    const result = resolveQueuePriorityDetails({
      current: EMPTY_QUEUE_PRIORITY_DETAILS,
      input: {},
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: null, targetDate: null });
  });

  it("keeps a non-date reason with no custom text and no target date", () => {
    const result = resolveQueuePriorityDetails({
      current: EMPTY_QUEUE_PRIORITY_DETAILS,
      input: { reason: "series_order" },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: "series_order", targetDate: null });
  });

  it("keeps a date-supporting reason together with its target date", () => {
    const result = resolveQueuePriorityDetails({
      current: EMPTY_QUEUE_PRIORITY_DETAILS,
      input: { reason: "book_club", targetDate: "2026-08-24" },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: "book_club", targetDate: "2026-08-24" });
  });

  it("trims the custom text when the reason is other", () => {
    const result = resolveQueuePriorityDetails({
      current: EMPTY_QUEUE_PRIORITY_DETAILS,
      input: { customText: "  buddy pick  ", reason: "other" },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: "buddy pick", reason: "other", targetDate: null });
  });
});

describe("resolveQueuePriorityDetails high priority rejects invalid combinations", () => {
  it("throws when the other reason has no custom text", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { reason: "other" },
        resolvedPriority: "high",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReasonCustomText");
  });

  it("throws when the other reason has whitespace-only custom text", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { customText: "   ", reason: "other" },
        resolvedPriority: "high",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReasonCustomText");
  });

  it("throws when custom text is given for a non-other reason", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { customText: "handpicked", reason: "series_order" },
        resolvedPriority: "high",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_CUSTOM_TEXT_OTHER_ONLY_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReasonCustomText");
  });

  it("throws when a target date is given for a reason that does not support one", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { reason: "series_order", targetDate: "2026-08-24" },
        resolvedPriority: "high",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_TARGET_DATE_UNSUPPORTED_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityTargetDate");
  });

  it("throws when a target date is given without a reason", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { targetDate: "2026-08-24" },
        resolvedPriority: "high",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_TARGET_DATE_REQUIRES_REASON_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityTargetDate");
  });
});

describe("resolveQueuePriorityDetails non-high priority rejects and clears the detail fields", () => {
  it("throws when a reason is provided for normal priority", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { reason: "series_order" },
        resolvedPriority: "normal",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_REASON_HIGH_ONLY_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReason");
  });

  it("throws when a reason is provided for low priority", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { reason: "series_order" },
        resolvedPriority: "low",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_REASON_HIGH_ONLY_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReason");
  });

  it("throws when custom text is provided for normal priority", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { customText: "handpicked" },
        resolvedPriority: "normal",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_CUSTOM_TEXT_HIGH_ONLY_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityReasonCustomText");
  });

  it("throws when a target date is provided for low priority", () => {
    const error = catchBadRequest(() =>
      resolveQueuePriorityDetails({
        current: EMPTY_QUEUE_PRIORITY_DETAILS,
        input: { targetDate: "2026-08-24" },
        resolvedPriority: "low",
      }),
    );

    expect(error.message).toBe(QUEUE_PRIORITY_TARGET_DATE_HIGH_ONLY_MESSAGE);
    expect(error.fields?.[0]?.field).toBe("queuePriorityTargetDate");
  });

  it("clears stored details when the priority drops to normal", () => {
    const current: QueuePriorityDetails = {
      customText: null,
      reason: "book_club",
      targetDate: "2026-08-24",
    };

    const result = resolveQueuePriorityDetails({ current, input: {}, resolvedPriority: "normal" });

    expect(result).toEqual({ customText: null, reason: null, targetDate: null });
  });

  it("clears stored details when the priority drops to low", () => {
    const current: QueuePriorityDetails = {
      customText: "buddy pick",
      reason: "other",
      targetDate: null,
    };

    const result = resolveQueuePriorityDetails({ current, input: {}, resolvedPriority: "low" });

    expect(result).toEqual({ customText: null, reason: null, targetDate: null });
  });
});

describe("resolveQueuePriorityDetails high priority merges current details with the input", () => {
  it("clears the custom text when the reason changes away from other", () => {
    const current: QueuePriorityDetails = {
      customText: "buddy pick",
      reason: "other",
      targetDate: null,
    };

    const result = resolveQueuePriorityDetails({
      current,
      input: { reason: "series_order" },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: "series_order", targetDate: null });
  });

  it("clears the target date when the reason changes to one without dates", () => {
    const current: QueuePriorityDetails = {
      customText: null,
      reason: "book_club",
      targetDate: "2026-08-24",
    };

    const result = resolveQueuePriorityDetails({
      current,
      input: { reason: "series_order" },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: "series_order", targetDate: null });
  });

  it("clears the custom text and target date when the reason is cleared to null", () => {
    const current: QueuePriorityDetails = {
      customText: "buddy pick",
      reason: "other",
      targetDate: null,
    };

    const result = resolveQueuePriorityDetails({
      current,
      input: { reason: null },
      resolvedPriority: "high",
    });

    expect(result).toEqual({ customText: null, reason: null, targetDate: null });
  });

  it("preserves the stored reason and target date when the input carries no detail fields", () => {
    const current: QueuePriorityDetails = {
      customText: null,
      reason: "book_club",
      targetDate: "2026-08-24",
    };

    const result = resolveQueuePriorityDetails({ current, input: {}, resolvedPriority: "high" });

    expect(result).toEqual({ customText: null, reason: "book_club", targetDate: "2026-08-24" });
  });
});
