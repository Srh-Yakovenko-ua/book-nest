import type { NotificationListResponse, NotificationView, Nullable } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";

const BOOK_ID = "22222222-2222-4222-8222-222222222222";

export function makeNotification(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    createdAt: "2026-07-30T09:00:00.000Z",
    entityState: "live",
    id: "11111111-1111-4111-8111-111111111111",
    level: "normal",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Дюна",
      dueDate: "2026-08-02",
      personName: "Марина",
      type: NOTIFICATION_TYPES.loanDueSoon,
    },
    readAt: null,
    reason: "global_setting",
    ...overrides,
  };
}

export function makeNotificationsPage({
  items,
  nextCursor = null,
  unreadCount,
}: {
  items: NotificationView[];
  nextCursor?: Nullable<string>;
  unreadCount?: number;
}): NotificationListResponse {
  return {
    items,
    nextCursor,
    unreadCount: unreadCount ?? items.filter((item) => item.readAt === null).length,
  };
}

export const notificationsOfEveryType: NotificationView[] = [
  makeNotification({
    id: "aaaaaaaa-0001-4000-8000-000000000001",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Дюна",
      dueDate: "2026-08-02",
      personName: "Марина",
      type: NOTIFICATION_TYPES.loanDueSoon,
    },
  }),
  makeNotification({
    createdAt: "2026-07-30T07:30:00.000Z",
    id: "aaaaaaaa-0002-4000-8000-000000000002",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Тигролови",
      dueDate: "2026-07-30",
      personName: "Олег",
      type: NOTIFICATION_TYPES.loanDueToday,
    },
  }),
  makeNotification({
    createdAt: "2026-07-29T18:00:00.000Z",
    id: "aaaaaaaa-0003-4000-8000-000000000003",
    level: "time_sensitive",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Місто",
      daysOverdue: 3,
      dueDate: "2026-07-26",
      personName: "Ірина",
      stage: 1,
      type: NOTIFICATION_TYPES.loanOverdue,
    },
  }),
  makeNotification({
    createdAt: "2026-07-29T12:00:00.000Z",
    entityState: "trashed",
    id: "aaaaaaaa-0004-4000-8000-000000000004",
    level: "passive",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Земля, забута часом",
      expectedDate: "2026-08-04",
      storeName: "Yakaboo",
      type: NOTIFICATION_TYPES.deliveryArrivingSoon,
    },
    readAt: "2026-07-29T13:00:00.000Z",
  }),
  makeNotification({
    createdAt: "2026-07-29T08:00:00.000Z",
    id: "aaaaaaaa-0005-4000-8000-000000000005",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Інтернат",
      expectedDate: "2026-07-29",
      storeName: null,
      type: NOTIFICATION_TYPES.deliveryArrivingToday,
    },
  }),
  makeNotification({
    createdAt: "2026-07-28T09:15:00.000Z",
    entityState: "gone",
    id: "aaaaaaaa-0006-4000-8000-000000000006",
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Ворошиловград",
      expectedDate: "2026-07-27",
      storeName: "Книгарня Є",
      type: NOTIFICATION_TYPES.deliveryDelayed,
    },
    readAt: "2026-07-28T10:00:00.000Z",
  }),
  makeNotification({
    createdAt: "2026-07-28T08:00:00.000Z",
    entityState: null,
    id: "aaaaaaaa-0007-4000-8000-000000000007",
    payload: {
      requestedAt: "2026-07-28T08:00:00.000Z",
      type: NOTIFICATION_TYPES.systemTest,
    },
    reason: "manual_test",
  }),
];
