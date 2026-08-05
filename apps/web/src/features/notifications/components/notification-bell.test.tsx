import "@testing-library/jest-dom/vitest";

import type { ChangelogListResponse } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeChangelogEntry } from "@/features/changelog/components/changelog.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeNotification, makeNotificationsPage } from "../model/notification.fixtures";
import { NotificationBell } from "./notification-bell";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const REMINDERS_TAB = "Нагадування";
const CHANGELOG_TAB = "Що нового";
const LAZY_PANEL_TIMEOUT = { timeout: 2000 };

const fetchMock = vi.fn();

const calls = { changelogList: 0, changelogSeen: 0, list: 0, markAllRead: 0, markRead: 0 };

let respondToUnreadCount: () => Response;
let respondToList: () => Response;
let respondToChangelog: () => Response;

function findMarkAllRead() {
  return screen.findByRole("button", { name: "Прочитати все" }, LAZY_PANEL_TIMEOUT);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeChangelogPage(unreadCount: number): ChangelogListResponse {
  return { entries: [makeChangelogEntry()], nextCursor: null, unreadCount };
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function openBell() {
  return userEvent.click(screen.getByRole("button", { name: /Сповіщення/ }));
}

beforeEach(() => {
  calls.changelogList = 0;
  calls.changelogSeen = 0;
  calls.markAllRead = 0;
  calls.markRead = 0;
  calls.list = 0;

  respondToUnreadCount = () => jsonResponse({ unreadCount: 2 });
  respondToList = () =>
    jsonResponse(
      makeNotificationsPage({
        items: [
          makeNotification(),
          makeNotification({ id: "33333333-3333-4333-8333-333333333333" }),
        ],
      }),
    );
  respondToChangelog = () => jsonResponse(makeChangelogPage(1));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/notifications/unread-count")) {
      return Promise.resolve(respondToUnreadCount());
    }
    if (url.includes("/api/notifications/read-all")) {
      calls.markAllRead += 1;
      return Promise.resolve(noContent());
    }
    if (url.includes("/api/notifications/read")) {
      calls.markRead += 1;
      return Promise.resolve(noContent());
    }
    if (url.includes("/api/notifications")) {
      calls.list += 1;
      return Promise.resolve(respondToList());
    }
    if (url.includes("/api/changelog/seen")) {
      calls.changelogSeen += 1;
      return Promise.resolve(noContent());
    }
    if (url.includes("/api/changelog")) {
      calls.changelogList += 1;
      return Promise.resolve(respondToChangelog());
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NotificationBell badge", () => {
  it("shows no badge and an all-read announcement when nothing is unread", async () => {
    respondToUnreadCount = () => jsonResponse({ unreadCount: 0 });
    respondToChangelog = () => jsonResponse(makeChangelogPage(0));

    renderWithProviders(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: "Сповіщення" });
    await waitFor(() => expect(calls.changelogList).toBe(1));
    expect(trigger.textContent).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Усе прочитано");
  });

  it("sums the reminder and changelog unread counts into one badge", async () => {
    renderWithProviders(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });
    expect(trigger).toHaveTextContent("3");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Сповіщення, 3 непрочитані"),
    );
  });

  it("caps the badge at 99 while the accessible name keeps the exact count", async () => {
    respondToUnreadCount = () => jsonResponse({ unreadCount: 120 });
    respondToChangelog = () => jsonResponse(makeChangelogPage(0));

    renderWithProviders(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: "Сповіщення, 120 непрочитаних" });
    expect(trigger).toHaveTextContent("99+");
  });

  it("declines the Ukrainian unread noun for the singular count", async () => {
    respondToUnreadCount = () => jsonResponse({ unreadCount: 1 });
    respondToChangelog = () => jsonResponse(makeChangelogPage(0));

    renderWithProviders(<NotificationBell />);

    expect(
      await screen.findByRole("button", { name: "Сповіщення, 1 непрочитане" }),
    ).toBeInTheDocument();
  });
});

describe("NotificationBell panel", () => {
  it("renders both tabs and fetches each payload once across tab switches", async () => {
    respondToChangelog = () => jsonResponse(makeChangelogPage(0));

    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 2 непрочитані" });

    await openBell();

    expect(
      await screen.findByRole("tab", { name: new RegExp(REMINDERS_TAB) }, LAZY_PANEL_TIMEOUT),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.list).toBe(1));
    const changelogListCallsBeforeSwitch = calls.changelogList;

    await userEvent.click(screen.getByRole("tab", { name: new RegExp(CHANGELOG_TAB) }));

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: new RegExp(CHANGELOG_TAB) })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.queryByRole("button", { name: "Прочитати все" })).not.toBeInTheDocument();
    expect(calls.changelogList).toBe(changelogListCallsBeforeSwitch);

    await userEvent.click(screen.getByRole("tab", { name: new RegExp(REMINDERS_TAB) }));

    expect(await findMarkAllRead()).toBeInTheDocument();
    expect(calls.list).toBe(1);
  });

  it("marks nothing read when the panel opens", async () => {
    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();
    await findMarkAllRead();

    expect(calls.markRead).toBe(0);
    expect(calls.markAllRead).toBe(0);
    expect(calls.changelogSeen).toBe(0);
  });

  it("marks the changelog seen when its tab is revealed", async () => {
    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();
    await screen.findByRole("tab", { name: new RegExp(CHANGELOG_TAB) }, LAZY_PANEL_TIMEOUT);
    const changelogListCallsBeforeSeen = calls.changelogList;
    await userEvent.click(screen.getByRole("tab", { name: new RegExp(CHANGELOG_TAB) }));

    await waitFor(() => expect(calls.changelogSeen).toBe(1));
    await waitFor(() => expect(calls.changelogList).toBeGreaterThan(changelogListCallsBeforeSeen));

    expect(calls.changelogSeen).toBe(1);
    expect(calls.markAllRead).toBe(0);
  });

  it("drops the badge to the changelog-only count after marking everything read", async () => {
    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();
    const markAllRead = await findMarkAllRead();

    respondToUnreadCount = () => jsonResponse({ unreadCount: 0 });
    respondToList = () =>
      jsonResponse(
        makeNotificationsPage({
          items: [makeNotification({ readAt: "2026-07-30T10:00:00.000Z" })],
          unreadCount: 0,
        }),
      );

    await userEvent.click(markAllRead);

    await waitFor(() => expect(calls.markAllRead).toBe(1));
    expect(
      await screen.findByRole("button", { name: "Сповіщення, 1 непрочитане" }),
    ).toBeInTheDocument();
  });

  it("shows the reminder error state as an alert and recovers on retry", async () => {
    respondToList = () => jsonResponse({ message: "boom" }, 500);

    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();

    const alert = await screen.findByRole("alert", {}, LAZY_PANEL_TIMEOUT);
    expect(alert).toHaveTextContent("Не вдалося завантажити сповіщення");

    respondToList = () => jsonResponse(makeNotificationsPage({ items: [makeNotification()] }));
    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(await findMarkAllRead()).toBeInTheDocument();
  });

  it("keeps the loaded notifications when the refetch behind mark-all-read fails", async () => {
    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();
    const markAllRead = await findMarkAllRead();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    respondToList = () => jsonResponse({ message: "boom" }, 500);
    await userEvent.click(markAllRead);

    await waitFor(() => expect(calls.markAllRead).toBe(1));
    await waitFor(() => expect(calls.list).toBe(2));

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Не вдалося завантажити сповіщення")).not.toBeInTheDocument();
  });

  it("keeps the loaded notifications and reports inline when the next page fails", async () => {
    respondToList = () =>
      jsonResponse(
        makeNotificationsPage({
          items: [
            makeNotification(),
            makeNotification({ id: "33333333-3333-4333-8333-333333333333" }),
          ],
          nextCursor: "44444444-4444-4444-8444-444444444444",
        }),
      );

    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: "Сповіщення, 3 непрочитані" });

    await openBell();
    const loadMore = await screen.findByRole("button", { name: "Показати ще" }, LAZY_PANEL_TIMEOUT);

    respondToList = () => jsonResponse({ message: "boom" }, 500);
    await userEvent.click(loadMore);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Не вдалося завантажити наступні сповіщення",
      ),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("makes the scrolling reminders panel reachable by keyboard", async () => {
    renderWithProviders(<NotificationBell />);
    await screen.findByRole("button", { name: /Сповіщення/ });

    await openBell();
    await findMarkAllRead();

    const panel = screen.getByRole("tabpanel", { name: new RegExp(REMINDERS_TAB) });
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(panel).toHaveClass("overflow-y-auto");
  });
});
