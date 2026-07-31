import "@testing-library/jest-dom/vitest";

import type { NotificationView } from "@app/shared";
import type { ComponentProps } from "react";

import { NOTIFICATION_TYPES } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import { formatDateShort } from "@/lib/format";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeNotification, notificationsOfEveryType } from "../model/notification.fixtures";
import { NotificationPanel } from "./notification-panel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const BOOK_ID = "22222222-2222-4222-8222-222222222222";

type PanelOverrides = {
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onRetry: () => void;
};

function makeOverdue(daysOverdue: number): NotificationView {
  return makeNotification({
    id: `bbbbbbbb-000${daysOverdue}-4000-8000-00000000000${daysOverdue}`,
    payload: {
      bookId: BOOK_ID,
      bookTitle: "Місто",
      daysOverdue,
      dueDate: "2026-07-26",
      personName: "Ірина",
      stage: 1,
      type: NOTIFICATION_TYPES.loanOverdue,
    },
  });
}

function renderPanel(items: NotificationView[], overrides: Partial<PanelOverrides> = {}) {
  return renderWithProviders(
    <NotificationPanel
      isMarkingAllRead={false}
      locale="uk"
      onMarkAllRead={overrides.onMarkAllRead ?? vi.fn()}
      onMarkRead={overrides.onMarkRead ?? vi.fn()}
      onRetry={overrides.onRetry ?? vi.fn()}
      state={{ items, kind: "ready", loadMore: null }}
      unreadCount={items.filter((item) => item.readAt === null).length}
    />,
  );
}

describe("NotificationPanel copy", () => {
  it("renders the localized text of every notification type", () => {
    renderPanel(notificationsOfEveryType);

    expect(
      screen.getByText(`Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Олег має повернути «Тигролови» сьогодні")).toBeInTheDocument();
    expect(
      screen.getByText("Позику «Місто» прострочено на 3 дні, позичальник — Ірина"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Доставка «Земля, забута часом» очікується ${formatDateShort("2026-08-04", "uk")}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Доставка «Інтернат» прибуває сьогодні")).toBeInTheDocument();
    expect(
      screen.getByText(
        `Доставка «Ворошиловград» затримується, очікували ${formatDateShort("2026-07-27", "uk")}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Тестове сповіщення, усе працює")).toBeInTheDocument();
  });

  it("uses the three integer Ukrainian plural forms for the overdue day count", () => {
    renderPanel([makeOverdue(1), makeOverdue(3), makeOverdue(5)]);

    expect(
      screen.getByText("Позику «Місто» прострочено на 1 день, позичальник — Ірина"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Позику «Місто» прострочено на 3 дні, позичальник — Ірина"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Позику «Місто» прострочено на 5 днів, позичальник — Ірина"),
    ).toBeInTheDocument();
  });
});

describe("NotificationPanel entity states", () => {
  it("links a live notification straight to its book", () => {
    renderPanel([makeNotification({ entityState: "live" })]);

    expect(
      screen.getByRole("link", {
        name: `Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`,
      }),
    ).toHaveAttribute("href", `/books/${BOOK_ID}`);
  });

  it("keeps a trashed notification as plain text behind a trash chip", () => {
    renderPanel([makeNotification({ entityState: "trashed" })]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("у кошику")).toBeInTheDocument();
    expect(
      screen.getByText(`Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`),
    ).toBeInTheDocument();
  });

  it("keeps a gone notification as inert historical text", () => {
    renderPanel([makeNotification({ entityState: "gone" })]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("у кошику")).not.toBeInTheDocument();
    expect(
      screen.getByText(`Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`),
    ).toBeInTheDocument();
  });
});

describe("NotificationPanel unread affordances", () => {
  it("marks an unread row with a dot, a heavier weight and a text label", () => {
    renderPanel([makeNotification({ readAt: null })]);

    const message = screen.getByText(
      `Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`,
    );
    expect(message).toHaveClass("font-medium");
    expect(screen.getByText("Непрочитане")).toBeInTheDocument();
  });

  it("names the per-row action after the notification it belongs to", async () => {
    const onMarkRead = vi.fn();
    renderPanel([makeNotification({ readAt: null })], { onMarkRead });

    const markRead = screen.getByRole("button", {
      name: `Позначити прочитаним Марина має повернути «Дюна» до ${formatDateShort("2026-08-02", "uk")}`,
    });
    await userEvent.click(markRead);

    expect(onMarkRead).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("keeps the per-row action focusable but inert once the row is read", async () => {
    const onMarkRead = vi.fn();
    renderPanel([makeNotification({ readAt: "2026-07-30T10:00:00.000Z" })], { onMarkRead });

    const markRead = screen.getByRole("button", { name: /Позначити прочитаним/ });
    expect(markRead).toHaveAttribute("aria-disabled", "true");
    expect(markRead).not.toBeDisabled();

    markRead.focus();
    await userEvent.click(markRead);

    expect(onMarkRead).not.toHaveBeenCalled();
    expect(markRead).toHaveFocus();
  });
});

describe("NotificationPanel states", () => {
  it("announces the error state as an alert and retries on demand", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <NotificationPanel
        isMarkingAllRead={false}
        locale="uk"
        onMarkAllRead={vi.fn()}
        onMarkRead={vi.fn()}
        onRetry={onRetry}
        state={{ kind: "error" }}
        unreadCount={0}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити сповіщення");

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the compact empty block when there is nothing to remind about", () => {
    renderWithProviders(
      <NotificationPanel
        isMarkingAllRead={false}
        locale="uk"
        onMarkAllRead={vi.fn()}
        onMarkRead={vi.fn()}
        onRetry={vi.fn()}
        state={{ kind: "empty" }}
        unreadCount={0}
      />,
    );

    expect(screen.getByText("Нагадувань немає")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Прочитати все" })).not.toBeInTheDocument();
  });

  it("keeps mark-all-read focusable but inert when every loaded notification is read", async () => {
    const onMarkAllRead = vi.fn();
    renderPanel([makeNotification({ readAt: "2026-07-30T10:00:00.000Z" })], { onMarkAllRead });

    const markAllRead = screen.getByRole("button", { name: "Прочитати все" });
    expect(markAllRead).toHaveAttribute("aria-disabled", "true");
    expect(markAllRead).not.toBeDisabled();

    markAllRead.focus();
    await userEvent.click(markAllRead);

    expect(onMarkAllRead).not.toHaveBeenCalled();
    expect(markAllRead).toHaveFocus();
  });

  it("gives the list an accessible name so it can be jumped to", () => {
    renderPanel([makeNotification()]);

    expect(screen.getByRole("list", { name: "Список сповіщень" })).toBeInTheDocument();
  });

  it("keeps load-more focusable while it is fetching and reports a failed page inline", async () => {
    const onLoadMore = vi.fn();
    const { rerender } = renderPanel([makeNotification()]);

    rerender(
      <NotificationPanel
        isMarkingAllRead={false}
        locale="uk"
        onMarkAllRead={vi.fn()}
        onMarkRead={vi.fn()}
        onRetry={vi.fn()}
        state={{
          items: [makeNotification()],
          kind: "ready",
          loadMore: { onLoadMore, status: "loading" },
        }}
        unreadCount={1}
      />,
    );

    const loadMore = screen.getByRole("button", { name: "Завантаження…" });
    expect(loadMore).toHaveAttribute("aria-disabled", "true");
    expect(loadMore).not.toBeDisabled();

    loadMore.focus();
    await userEvent.click(loadMore);

    expect(onLoadMore).not.toHaveBeenCalled();
    expect(loadMore).toHaveFocus();

    rerender(
      <NotificationPanel
        isMarkingAllRead={false}
        locale="uk"
        onMarkAllRead={vi.fn()}
        onMarkRead={vi.fn()}
        onRetry={vi.fn()}
        state={{
          items: [makeNotification()],
          kind: "ready",
          loadMore: { onLoadMore, status: "failed" },
        }}
        unreadCount={1}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити наступні сповіщення",
    );
    expect(screen.getByRole("button", { name: "Показати ще" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Показати ще" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
