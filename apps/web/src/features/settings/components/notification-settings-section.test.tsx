import "@testing-library/jest-dom/vitest";

import type { EmailNotifications } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notificationKeys } from "@/features/notifications/api/notification-keys";
import messages from "@/messages/uk.json";
import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test-utils";

import { NotificationSettingsSection } from "./notification-settings-section";

const COPY = {
  borrowed: messages.settings.notifications.toggles.borrowedBookReminders,
  comingSoon: /Скоро/,
  delivery: messages.settings.notifications.toggles.deliveryReminders,
  leadDayOptions: [
    "1 день",
    "2 дні",
    "3 дні",
    "4 дні",
    "5 днів",
    "6 днів",
    "7 днів",
    "8 днів",
    "9 днів",
    "10 днів",
    "11 днів",
    "12 днів",
    "13 днів",
    "14 днів",
  ],
  leadDays: messages.settings.notifications.leadDays,
  saveStatus: messages.settings.saveStatus,
  test: messages.settings.notifications.test,
} as const;

const BODIES = {
  borrowedOff: '{"emailNotifications":{"borrowedBookReminders":false}}',
  deliveryOff: '{"emailNotifications":{"deliveryReminders":false}}',
} as const satisfies Record<string, string>;

const fetchMock = vi.fn();

let respondToUpdate: () => Promise<Response>;
let respondToTest: () => Promise<Response>;

function deferredUpdate(respond: () => Response = () => jsonResponse(defaultUserProfileSettings)) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { release, respond: () => released.then(respond) };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderSection({
  emailNotifications,
  loanReminderLeadDays = defaultUserProfileSettings.loanReminderLeadDays,
  queryClient,
}: {
  emailNotifications?: Partial<EmailNotifications>;
  loanReminderLeadDays?: number;
  queryClient?: QueryClient;
} = {}) {
  return renderWithProviders(
    <NotificationSettingsSection
      emailNotifications={{
        ...defaultUserProfileSettings.emailNotifications,
        ...emailNotifications,
      }}
      loanReminderLeadDays={loanReminderLeadDays}
    />,
    { queryClient },
  );
}

function testNotificationCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/notifications/test"));
}

function updateBodies(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH")
    .map(([, init]) => String(init?.body));
}

beforeEach(() => {
  respondToUpdate = () => Promise.resolve(jsonResponse(defaultUserProfileSettings));
  respondToTest = () => Promise.resolve(new Response(null, { status: 202 }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings") && method === "PATCH") return respondToUpdate();
    if (url.includes("/api/notifications/test") && method === "POST") return respondToTest();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NotificationSettingsSection email reminders", () => {
  it("describes each email reminder switch with its caption", () => {
    renderSection();

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toHaveAccessibleDescription(
      COPY.delivery.description,
    );
    expect(screen.getByRole("switch", { name: COPY.borrowed.label })).toHaveAccessibleDescription(
      COPY.borrowed.description,
    );
  });

  it("offers only the two working email reminders, none of them coming soon", () => {
    renderSection();

    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.queryByText(COPY.comingSoon)).not.toBeInTheDocument();
  });

  it("reflects the stored value of each live reminder", () => {
    renderSection({
      emailNotifications: { borrowedBookReminders: false, deliveryReminders: true },
    });

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toBeChecked();
    expect(screen.getByRole("switch", { name: COPY.borrowed.label })).not.toBeChecked();
  });

  it("sends only the delivery field when the delivery reminder is switched off", async () => {
    renderSection({ emailNotifications: { deliveryReminders: true } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    expect(updateBodies()).toEqual([BODIES.deliveryOff]);
  });

  it("sends only the borrowed field when the borrowed reminder is switched on", async () => {
    renderSection({ emailNotifications: { borrowedBookReminders: false } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    expect(updateBodies()).toEqual(['{"emailNotifications":{"borrowedBookReminders":true}}']);
  });

  it("keeps the switch focused and enabled while its save is in flight", async () => {
    const pendingUpdate = deferredUpdate();
    respondToUpdate = pendingUpdate.respond;

    renderSection({ emailNotifications: { deliveryReminders: true } });

    const toggle = screen.getByRole("switch", { name: COPY.delivery.label });
    toggle.focus();
    await userEvent.keyboard(" ");

    await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "true"));
    expect(toggle).toHaveFocus();
    expect(toggle).not.toBeDisabled();

    pendingUpdate.release();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "false"));
  });
});

describe("NotificationSettingsSection save state", () => {
  it("announces the saving state while a switch's save is in flight", async () => {
    const pendingUpdate = deferredUpdate();
    respondToUpdate = pendingUpdate.respond;

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    expect(await screen.findByText(COPY.saveStatus.saving)).toHaveRole("status");
  });

  it("clears the saving state once the save succeeds", async () => {
    const pendingUpdate = deferredUpdate();
    respondToUpdate = pendingUpdate.respond;

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await screen.findByText(COPY.saveStatus.saving);
    pendingUpdate.release();

    await waitFor(() => expect(screen.queryByText(COPY.saveStatus.saving)).not.toBeInTheDocument());
  });

  it("returns a switch whose save failed to its stored value", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection({ emailNotifications: { deliveryReminders: true } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await screen.findByText(COPY.saveStatus.error);

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toBeChecked();
  });

  it("announces the failed save with a retry button", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    expect(await screen.findByText(COPY.saveStatus.error)).toHaveRole("status");
    expect(screen.getByRole("button", { name: COPY.saveStatus.retry })).toBeInTheDocument();
  });

  it("describes the retry button with the label of the field that failed", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));

    expect(
      await screen.findByRole("button", { name: COPY.saveStatus.retry }),
    ).toHaveAccessibleDescription(COPY.borrowed.label);
  });

  it("re-sends the failed change when the retry button is pressed", async () => {
    respondToUpdate = vi
      .fn(respondToUpdate)
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await userEvent.click(await screen.findByRole("button", { name: COPY.saveStatus.retry }));

    await waitFor(() => expect(updateBodies()).toEqual([BODIES.deliveryOff, BODIES.deliveryOff]));
  });

  it("moves focus to the switch when the retry button is pressed", async () => {
    respondToUpdate = vi
      .fn(respondToUpdate)
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await userEvent.click(await screen.findByRole("button", { name: COPY.saveStatus.retry }));

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toHaveFocus();
  });
});

describe("NotificationSettingsSection queued saves", () => {
  it("sends the second switch's change only after the first save settles", async () => {
    const firstUpdate = deferredUpdate();
    respondToUpdate = firstUpdate.respond;

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));
    await waitFor(() => expect(updateBodies()).toEqual([BODIES.deliveryOff]));
    firstUpdate.release();

    await waitFor(() => expect(updateBodies()).toEqual([BODIES.deliveryOff, BODIES.borrowedOff]));
  });

  it("still sends the queued switch's change after the first save fails", async () => {
    const failingUpdate = deferredUpdate(() => jsonResponse({ message: "boom" }, 500));
    respondToUpdate = vi.fn(respondToUpdate).mockImplementationOnce(failingUpdate.respond);

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));
    failingUpdate.release();

    await waitFor(() => expect(updateBodies()).toEqual([BODIES.deliveryOff, BODIES.borrowedOff]));
  });

  it("reports a failure only on the switch whose save failed", async () => {
    const failingUpdate = deferredUpdate(() => jsonResponse({ message: "boom" }, 500));
    respondToUpdate = vi.fn(respondToUpdate).mockImplementationOnce(failingUpdate.respond);

    renderSection({ emailNotifications: { deliveryReminders: true } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));
    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));
    failingUpdate.release();
    await screen.findByText(COPY.saveStatus.saved);

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toBeChecked();
    expect(screen.getByRole("button", { name: COPY.saveStatus.retry })).toHaveAccessibleDescription(
      COPY.delivery.label,
    );
  });
});

describe("NotificationSettingsSection lead days", () => {
  it("shows the stored lead time on the select", () => {
    renderSection({ loanReminderLeadDays: 5 });

    expect(screen.getByRole("combobox", { name: COPY.leadDays.label })).toHaveTextContent("5 днів");
  });

  it("offers one to fourteen days in Ukrainian plural forms", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("combobox", { name: COPY.leadDays.label }));
    await screen.findByRole("listbox");

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(
      COPY.leadDayOptions,
    );
  });

  it.each([
    { days: 1, option: "1 день" },
    { days: 7, option: "7 днів" },
    { days: 14, option: "14 днів" },
  ])("saves $days with one PATCH when $option is picked", async ({ days, option }) => {
    renderSection({ loanReminderLeadDays: 3 });

    await userEvent.click(screen.getByRole("combobox", { name: COPY.leadDays.label }));
    await userEvent.click(await screen.findByRole("option", { name: option }));
    await screen.findByText(COPY.saveStatus.saved);

    expect(updateBodies()).toEqual([`{"loanReminderLeadDays":${days}}`]);
  });

  it("sends nothing when the stored lead time is picked", async () => {
    renderSection({ loanReminderLeadDays: 5 });

    await userEvent.click(screen.getByRole("combobox", { name: COPY.leadDays.label }));
    await userEvent.click(await screen.findByRole("option", { name: "5 днів" }));

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(updateBodies()).toEqual([]);
  });

  it("lets the lead time change with both email reminders switched off", async () => {
    renderSection({
      emailNotifications: { borrowedBookReminders: false, deliveryReminders: false },
      loanReminderLeadDays: 3,
    });

    await userEvent.click(screen.getByRole("combobox", { name: COPY.leadDays.label }));
    await userEvent.click(await screen.findByRole("option", { name: "14 днів" }));

    await waitFor(() => expect(updateBodies()).toEqual(['{"loanReminderLeadDays":14}']));
  });

  it("ignores printable keys typed on the closed select", async () => {
    renderSection({ loanReminderLeadDays: 5 });

    const select = screen.getByRole("combobox", { name: COPY.leadDays.label });
    select.focus();
    await userEvent.keyboard("1");

    expect(select).toHaveTextContent("5 днів");
    expect(updateBodies()).toEqual([]);
  });

  it.each([
    { key: "{Enter}", name: "Enter" },
    { key: "{ArrowDown}", name: "ArrowDown" },
    { key: " ", name: "Space" },
  ])("opens the list with $name on the focused select", async ({ key }) => {
    renderSection();

    screen.getByRole("combobox", { name: COPY.leadDays.label }).focus();
    await userEvent.keyboard(key);

    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });
});

describe("NotificationSettingsSection test notification", () => {
  it("explains what the test notification does before it is sent", () => {
    renderSection();

    expect(screen.getByRole("button", { name: COPY.test.button })).toHaveAccessibleDescription(
      COPY.test.description,
    );
  });

  it("sends one request when pressed again while the first is pending", async () => {
    let releaseTest = () => {};
    respondToTest = () =>
      new Promise<Response>((resolve) => {
        releaseTest = () => resolve(new Response(null, { status: 202 }));
      });

    renderSection();

    const button = screen.getByRole("button", { name: COPY.test.button });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await userEvent.click(button);
    releaseTest();
    await screen.findByText(COPY.test.success);

    expect(testNotificationCalls()).toHaveLength(1);
  });

  it("keeps the pending button focused and marked busy", async () => {
    respondToTest = () => new Promise<Response>(() => {});

    renderSection();

    const button = screen.getByRole("button", { name: COPY.test.button });
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
  });

  it("confirms the created test notification once the server accepts it", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    expect(await screen.findByText(COPY.test.success)).toHaveRole("status");
  });

  it("refreshes the notifications cache once the test notification is created", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(notificationKeys.root, { gcTime: Number.POSITIVE_INFINITY });
    queryClient.setQueryData(notificationKeys.unreadCount, { unreadCount: 0 });

    renderSection({ queryClient });

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));
    await screen.findByText(COPY.test.success);

    expect(queryClient.getQueryState(notificationKeys.unreadCount)?.isInvalidated).toBe(true);
  });

  it("reports the rate limit when the server answers 429", async () => {
    respondToTest = () => Promise.resolve(jsonResponse({ message: "Too many requests" }, 429));

    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    expect(await screen.findByText(COPY.test.rateLimited)).toHaveRole("status");
  });

  it("reports a failed test notification when the server errors", async () => {
    respondToTest = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    expect(await screen.findByText(COPY.test.error)).toHaveRole("status");
  });

  it("sends the test notification again when pressed after a failure", async () => {
    respondToTest = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));
    await screen.findByText(COPY.test.error);
    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    await waitFor(() => expect(testNotificationCalls()).toHaveLength(2));
  });
});
