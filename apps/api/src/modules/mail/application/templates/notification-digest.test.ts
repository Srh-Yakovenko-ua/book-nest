import type { NotificationPayload } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";
import { describe, expect, it } from "vitest";

import { renderNotificationDigest } from "./notification-digest.js";

const DASHBOARD_URL = "http://localhost:3000/dashboard";
const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const HOSTILE_TITLE = '<img src=x onerror="alert(1)">';

const loanDueToday: NotificationPayload = {
  bookId: BOOK_ID,
  bookTitle: "Dune",
  dueDate: "2026-07-30",
  personName: "Paul",
  type: NOTIFICATION_TYPES.loanDueToday,
};

const deliveryDelayed: NotificationPayload = {
  bookId: BOOK_ID,
  bookTitle: "Neuromancer",
  expectedDate: "2026-07-27",
  storeName: "Yakaboo",
  type: NOTIFICATION_TYPES.deliveryDelayed,
};

describe("renderNotificationDigest", () => {
  it("renders every payload in Ukrainian by default", () => {
    const { html, subject, text } = renderNotificationDigest({
      dashboardUrl: DASHBOARD_URL,
      items: [loanDueToday, deliveryDelayed],
      locale: "uk",
      userName: "Читач",
    });

    expect(subject).toBe("Нагадування BookNest");
    expect(text).toContain("Dune");
    expect(text).toContain("сьогодні термін повернення");
    expect(text).toContain("доставка затримується");
    expect(text).toContain("Yakaboo");
    expect(html).toContain('<html lang="uk">');
  });

  it("renders the same payloads in English", () => {
    const { html, subject, text } = renderNotificationDigest({
      dashboardUrl: DASHBOARD_URL,
      items: [loanDueToday, deliveryDelayed],
      locale: "en",
      userName: "Reader",
    });

    expect(subject).toBe("BookNest reminders");
    expect(text).toContain("due back today");
    expect(text).toContain("delivery is late");
    expect(html).toContain('<html lang="en">');
  });

  it("escapes every payload string in the html body", () => {
    const { html } = renderNotificationDigest({
      dashboardUrl: DASHBOARD_URL,
      items: [{ ...loanDueToday, bookTitle: HOSTILE_TITLE, personName: HOSTILE_TITLE }],
      locale: "uk",
      userName: HOSTILE_TITLE,
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("omits the store name when there is none", () => {
    const { text } = renderNotificationDigest({
      dashboardUrl: DASHBOARD_URL,
      items: [{ ...deliveryDelayed, storeName: null }],
      locale: "uk",
      userName: "Читач",
    });

    expect(text).not.toContain("()");
    expect(text).toContain("Neuromancer");
  });

  it("renders every notification type without throwing", () => {
    const everyType: NotificationPayload[] = [
      { ...loanDueToday, type: NOTIFICATION_TYPES.loanDueSoon },
      loanDueToday,
      { ...loanDueToday, daysOverdue: 7, stage: 1, type: NOTIFICATION_TYPES.loanOverdue },
      { ...deliveryDelayed, type: NOTIFICATION_TYPES.deliveryArrivingSoon },
      { ...deliveryDelayed, type: NOTIFICATION_TYPES.deliveryArrivingToday },
      deliveryDelayed,
      {
        requestedAt: "2026-07-30T06:00:00.000Z",
        type: NOTIFICATION_TYPES.systemTest,
      },
    ];

    const { text } = renderNotificationDigest({
      dashboardUrl: DASHBOARD_URL,
      items: everyType,
      locale: "uk",
      userName: "Читач",
    });

    expect(text.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(everyType.length);
  });
});
