import type { NotificationPayload, NotificationType } from "@app/shared";

import {
  MarkNotificationsReadInputSchema,
  NOTIFICATION_BOUNDS,
  NOTIFICATION_LEVEL_BY_TYPE,
  NotificationChannelSchema,
  NotificationDeliveryStatusSchema,
  NotificationEntityTypeSchema,
  NotificationLevelSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationPayloadSchema,
  NotificationTypeSchema,
  NotificationUnreadCountSchema,
  NotificationViewSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "22222222-2222-4222-8222-222222222222";

const loanFields = {
  bookId: BOOK_ID,
  bookTitle: "Дюна",
  dueDate: "2026-08-10",
  personName: "Олена",
};

const deliveryFields = {
  bookId: BOOK_ID,
  bookTitle: "Дюна",
  expectedDate: "2026-08-10",
  storeName: "Книгарня Є",
};

const overdueFields = { ...loanFields, daysOverdue: 7, stage: 1 };

const testFields = { requestedAt: "2026-07-30T09:00:00.000Z" };

const PAYLOAD_CASES = {
  "delivery.arriving_soon": { foreign: loanFields, own: deliveryFields },
  "delivery.arriving_today": { foreign: loanFields, own: deliveryFields },
  "delivery.delayed": { foreign: loanFields, own: deliveryFields },
  "loan.due_soon": { foreign: deliveryFields, own: loanFields },
  "loan.due_today": { foreign: deliveryFields, own: loanFields },
  "loan.overdue": { foreign: loanFields, own: overdueFields },
  "system.test": { foreign: loanFields, own: testFields },
} satisfies {
  [Type in NotificationType]: {
    foreign: Record<string, unknown>;
    own: Omit<Extract<NotificationPayload, { type: Type }>, "type">;
  };
};

const payloadCases = Object.entries(PAYLOAD_CASES).map(([type, payloadCase]) => ({
  ...payloadCase,
  type,
}));

describe("NotificationPayloadSchema", () => {
  it.each(payloadCases)("$type parses its own payload", ({ own, type }) => {
    const result = NotificationPayloadSchema.safeParse({ ...own, type });

    expect(result.success).toBe(true);
  });

  it.each(payloadCases)("$type rejects a foreign payload", ({ foreign, type }) => {
    const result = NotificationPayloadSchema.safeParse({ ...foreign, type });

    expect(result.success).toBe(false);
  });

  it("covers every declared notification type with an arm", () => {
    const covered = Object.keys(PAYLOAD_CASES).sort();

    expect(covered).toEqual([...NotificationTypeSchema.options].sort());
  });

  it("rejects a type that is not in the enum", () => {
    const result = NotificationPayloadSchema.safeParse({ ...loanFields, type: "loan.returned" });

    expect(result.success).toBe(false);
  });

  it("accepts a delivery payload without a store name", () => {
    const result = NotificationPayloadSchema.safeParse({
      ...deliveryFields,
      storeName: null,
      type: "delivery.delayed",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an overdue stage outside 1..3", () => {
    for (const stage of [0, 4]) {
      const result = NotificationPayloadSchema.safeParse({
        ...overdueFields,
        stage,
        type: "loan.overdue",
      });

      expect(result.success).toBe(false);
    }
  });

  it("rejects a non-positive overdue day count", () => {
    const result = NotificationPayloadSchema.safeParse({
      ...overdueFields,
      daysOverdue: 0,
      type: "loan.overdue",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a calendar date carrying a time component", () => {
    const result = NotificationPayloadSchema.safeParse({
      ...loanFields,
      dueDate: "2026-08-10T09:00:00.000Z",
      type: "loan.due_soon",
    });

    expect(result.success).toBe(false);
  });
});

describe("NotificationViewSchema", () => {
  const view = {
    createdAt: "2026-07-30T09:00:00.000Z",
    entityState: "live",
    id: NOTIFICATION_ID,
    level: "time_sensitive",
    payload: { ...overdueFields, type: "loan.overdue" },
    readAt: null,
    reason: "loan_opt_in",
  };

  it("parses a row whose payload matches its declared type", () => {
    expect(NotificationViewSchema.safeParse(view).success).toBe(true);
  });

  it("accepts a row that points at no entity", () => {
    expect(NotificationViewSchema.safeParse({ ...view, entityState: null }).success).toBe(true);
  });

  it("rejects an unknown entity state", () => {
    expect(NotificationViewSchema.safeParse({ ...view, entityState: "purged" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown reason", () => {
    expect(NotificationViewSchema.safeParse({ ...view, reason: "because" }).success).toBe(false);
  });
});

describe("NotificationListQuerySchema", () => {
  it("coerces the limit and the unreadOnly flag from query strings", () => {
    const parsed = NotificationListQuerySchema.parse({ limit: "10", unreadOnly: "true" });

    expect(parsed).toEqual({ limit: 10, unreadOnly: true });
  });

  it("falls back to the default page size when no limit is given", () => {
    expect(NotificationListQuerySchema.parse({}).limit).toBe(NOTIFICATION_BOUNDS.pageSizeDefault);
  });

  it("rejects a limit above the list ceiling", () => {
    const result = NotificationListQuerySchema.safeParse({
      limit: String(NOTIFICATION_BOUNDS.listLimitMax + 1),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unreadOnly value that is not boolean-like", () => {
    expect(NotificationListQuerySchema.safeParse({ unreadOnly: "maybe" }).success).toBe(false);
  });
});

describe("NotificationListResponseSchema", () => {
  it("accepts an empty page with a null cursor", () => {
    const result = NotificationListResponseSchema.safeParse({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative unread count", () => {
    expect(NotificationUnreadCountSchema.safeParse({ unreadCount: -1 }).success).toBe(false);
  });
});

describe("NOTIFICATION_LEVEL_BY_TYPE", () => {
  it("assigns exactly one known level to every declared type", () => {
    const levels = Object.entries(NOTIFICATION_LEVEL_BY_TYPE);

    expect(levels.map(([type]) => type).sort()).toEqual([...NotificationTypeSchema.options].sort());
    for (const [, level] of levels) {
      expect(NotificationLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it("marks an overdue loan as time sensitive", () => {
    expect(NOTIFICATION_LEVEL_BY_TYPE["loan.overdue"]).toBe("time_sensitive");
  });
});

describe("the notification delivery contracts", () => {
  it("accepts only the channels the writer can emit", () => {
    expect(NotificationChannelSchema.options).toEqual(["email"]);
    expect(NotificationChannelSchema.safeParse("in_app").success).toBe(false);
  });

  it("accepts only the delivery statuses the writer can persist", () => {
    expect(NotificationDeliveryStatusSchema.options).toEqual(["failed", "pending", "sent"]);
    expect(NotificationDeliveryStatusSchema.safeParse("queued").success).toBe(false);
  });

  it("accepts only the entity types a notification can point at", () => {
    expect(NotificationEntityTypeSchema.options).toEqual(["book"]);
    expect(NotificationEntityTypeSchema.safeParse("series").success).toBe(false);
  });
});

describe("MarkNotificationsReadInputSchema", () => {
  it("accepts a full page of ids", () => {
    const result = MarkNotificationsReadInputSchema.safeParse({
      ids: buildIds(NOTIFICATION_BOUNDS.markReadMax),
    });

    expect(result.success).toBe(true);
  });

  it("rejects one id more than the ceiling", () => {
    const result = MarkNotificationsReadInputSchema.safeParse({
      ids: buildIds(NOTIFICATION_BOUNDS.markReadMax + 1),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty id list", () => {
    expect(MarkNotificationsReadInputSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("rejects an id that is not a uuid", () => {
    expect(MarkNotificationsReadInputSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
  });
});

function buildIds(count: number): string[] {
  return Array.from({ length: count }, () => NOTIFICATION_ID);
}
