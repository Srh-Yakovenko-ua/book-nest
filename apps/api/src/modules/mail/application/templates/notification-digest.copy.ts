import type {
  InterfaceLanguage,
  NotificationPayload,
  NotificationType,
  Nullable,
} from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";

export type DigestCopy = {
  deliveryArrivingSoon: (
    payload: PayloadOf<typeof NOTIFICATION_TYPES.deliveryArrivingSoon>,
  ) => string;
  deliveryArrivingToday: (
    payload: PayloadOf<typeof NOTIFICATION_TYPES.deliveryArrivingToday>,
  ) => string;
  deliveryDelayed: (payload: PayloadOf<typeof NOTIFICATION_TYPES.deliveryDelayed>) => string;
  footer: string;
  greeting: (userName: string) => string;
  intro: string;
  linkLabel: string;
  loanDueSoon: (payload: PayloadOf<typeof NOTIFICATION_TYPES.loanDueSoon>) => string;
  loanDueToday: (payload: PayloadOf<typeof NOTIFICATION_TYPES.loanDueToday>) => string;
  loanOverdue: (payload: PayloadOf<typeof NOTIFICATION_TYPES.loanOverdue>) => string;
  subject: string;
  systemTest: (payload: PayloadOf<typeof NOTIFICATION_TYPES.systemTest>) => string;
  title: string;
};

type PayloadOf<TType extends NotificationType> = Extract<NotificationPayload, { type: TType }>;

export const DIGEST_COPY: Record<InterfaceLanguage, DigestCopy> = {
  en: {
    deliveryArrivingSoon: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — delivery expected on ${payload.expectedDate}`,
        storeName: payload.storeName,
      }),
    deliveryArrivingToday: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — delivery expected today`,
        storeName: payload.storeName,
      }),
    deliveryDelayed: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — delivery is late, it was expected on ${payload.expectedDate}`,
        storeName: payload.storeName,
      }),
    footer: "You are getting this email because BookNest reminders are on in your settings.",
    greeting: (userName) => `Hi ${userName}!`,
    intro: "Here is what needs your attention today:",
    linkLabel: "Open BookNest",
    loanDueSoon: (payload) =>
      `«${payload.bookTitle}» — due back on ${payload.dueDate} (${payload.personName})`,
    loanDueToday: (payload) => `«${payload.bookTitle}» — due back today (${payload.personName})`,
    loanOverdue: (payload) =>
      `«${payload.bookTitle}» — ${payload.daysOverdue} days overdue (${payload.personName})`,
    subject: "BookNest reminders",
    systemTest: (payload) => `Test notification (${payload.requestedAt})`,
    title: "BookNest reminders",
  },
  uk: {
    deliveryArrivingSoon: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — доставка очікується ${payload.expectedDate}`,
        storeName: payload.storeName,
      }),
    deliveryArrivingToday: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — доставка очікується сьогодні`,
        storeName: payload.storeName,
      }),
    deliveryDelayed: (payload) =>
      withStore({
        line: `«${payload.bookTitle}» — доставка затримується, очікувалась ${payload.expectedDate}`,
        storeName: payload.storeName,
      }),
    footer: "Ви отримали цей лист, бо в налаштуваннях BookNest увімкнені нагадування.",
    greeting: (userName) => `Вітаємо, ${userName}!`,
    intro: "Ось що варто тримати в полі зору сьогодні:",
    linkLabel: "Відкрити BookNest",
    loanDueSoon: (payload) =>
      `«${payload.bookTitle}» — термін повернення ${payload.dueDate} (${payload.personName})`,
    loanDueToday: (payload) =>
      `«${payload.bookTitle}» — сьогодні термін повернення (${payload.personName})`,
    loanOverdue: (payload) =>
      `«${payload.bookTitle}» — прострочено на ${payload.daysOverdue} дн. (${payload.personName})`,
    subject: "Нагадування BookNest",
    systemTest: (payload) => `Тестове сповіщення (${payload.requestedAt})`,
    title: "Нагадування BookNest",
  },
};

function withStore({ line, storeName }: { line: string; storeName: Nullable<string> }): string {
  return storeName === null ? line : `${line} (${storeName})`;
}
