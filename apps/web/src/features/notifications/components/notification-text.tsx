"use client";

import type { NotificationPayload } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";
import { useTranslations } from "next-intl";

import { formatDateShort } from "@/lib/format";

type NotificationTextProps = {
  locale: string;
  payload: NotificationPayload;
};

export function NotificationText({ locale, payload }: NotificationTextProps) {
  const t = useTranslations("notifications.types");

  switch (payload.type) {
    case NOTIFICATION_TYPES.deliveryArrivingSoon:
      return t("delivery.arrivingSoon", {
        bookTitle: payload.bookTitle,
        date: formatDateShort(payload.expectedDate, locale),
      });
    case NOTIFICATION_TYPES.deliveryArrivingToday:
      return t("delivery.arrivingToday", { bookTitle: payload.bookTitle });
    case NOTIFICATION_TYPES.deliveryDelayed:
      return t("delivery.delayed", {
        bookTitle: payload.bookTitle,
        date: formatDateShort(payload.expectedDate, locale),
      });
    case NOTIFICATION_TYPES.loanDueSoon:
      return t("loan.dueSoon", {
        bookTitle: payload.bookTitle,
        date: formatDateShort(payload.dueDate, locale),
        personName: payload.personName,
      });
    case NOTIFICATION_TYPES.loanDueToday:
      return t("loan.dueToday", {
        bookTitle: payload.bookTitle,
        personName: payload.personName,
      });
    case NOTIFICATION_TYPES.loanOverdue:
      return t("loan.overdue", {
        bookTitle: payload.bookTitle,
        count: payload.daysOverdue,
        personName: payload.personName,
      });
    case NOTIFICATION_TYPES.systemTest:
      return t("system.test");
    default:
      return assertNever(payload);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled notification payload: ${JSON.stringify(value)}`);
}
