import "@testing-library/jest-dom/vitest";

import type { EmailNotifications } from "@app/shared";

import { defaultUserProfileSettings, LOAN_REMINDER_LEAD_DAYS } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { NotificationSettingsSection } from "./notification-settings-section";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const COPY = {
  borrowed: {
    description: "Лист, коли комусь час повертати вашу книгу.",
    label: "Нагадування про позичені книги",
  },
  comingSoonBadge: "Скоро",
  comingSoonLabels: [
    "Нагадування читати",
    "Нагадування про цілі читання",
    "Підсумок тижня",
    "Звіт за місяць",
  ],
  decrement: "Зменшити",
  delivery: {
    description: "Лист, коли книга ось-ось приїде або доставка затрималася.",
    label: "Нагадування про доставки",
  },
  increment: "Збільшити",
  leadDaysLabel: "Нагадувати про повернення завчасно",
  test: {
    button: "Надіслати тест",
    error: "Не вдалося надіслати тестове сповіщення. Спробуйте за хвилину.",
    success: "Тестове сповіщення створено — загляньте у дзвіночок.",
  },
  toast: {
    error: "Не вдалося зберегти. Спробуйте ще раз.",
    saved: "Збережено",
  },
} as const satisfies Record<string, readonly string[] | Record<string, string> | string>;

const fetchMock = vi.fn();

let respondToUpdate: () => Promise<Response>;
let respondToTest: () => Promise<Response>;

function deferredUpdate() {
  let release = () => {};
  const response = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse(defaultUserProfileSettings));
  });
  return { release, respond: () => response };
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
}: {
  emailNotifications?: Partial<EmailNotifications>;
  loanReminderLeadDays?: number;
} = {}) {
  return renderWithProviders(
    <NotificationSettingsSection
      emailNotifications={{
        ...defaultUserProfileSettings.emailNotifications,
        ...emailNotifications,
      }}
      loanReminderLeadDays={loanReminderLeadDays}
    />,
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
  respondToTest = () => Promise.resolve(new Response(null, { status: 204 }));

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

describe("NotificationSettingsSection live reminders", () => {
  it("describes each live reminder next to its switch", () => {
    renderSection();

    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toBeInTheDocument();
    expect(screen.getByText(COPY.delivery.description)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: COPY.borrowed.label })).toBeInTheDocument();
    expect(screen.getByText(COPY.borrowed.description)).toBeInTheDocument();
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
    expect(updateBodies()).toEqual(['{"emailNotifications":{"deliveryReminders":false}}']);
  });

  it("sends only the borrowed field when the borrowed reminder is switched on", async () => {
    renderSection({ emailNotifications: { borrowedBookReminders: false } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.borrowed.label }));

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    expect(updateBodies()).toEqual(['{"emailNotifications":{"borrowedBookReminders":true}}']);
  });

  it("confirms a saved reminder with a toast", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(COPY.toast.saved));
  });

  it("reports a failed save with a toast", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(COPY.toast.error));
  });

  it("falls back to the stored value when the save fails", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection({ emailNotifications: { deliveryReminders: true } });

    await userEvent.click(screen.getByRole("switch", { name: COPY.delivery.label }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(COPY.toast.error));
    expect(screen.getByRole("switch", { name: COPY.delivery.label })).toBeChecked();
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

describe("NotificationSettingsSection unavailable reminders", () => {
  it.each([...COPY.comingSoonLabels])("keeps the %s switch reachable but inert", (label) => {
    renderSection();

    const toggle = screen.getByRole("switch", { name: label });

    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toBeDisabled();
    expect(toggle).not.toBeChecked();
  });

  it("badges every unavailable reminder as coming soon", () => {
    renderSection();

    expect(screen.getAllByText(COPY.comingSoonBadge)).toHaveLength(COPY.comingSoonLabels.length);
  });

  it("sends no request when an unavailable reminder is clicked", async () => {
    renderSection();

    for (const label of COPY.comingSoonLabels) {
      await userEvent.click(screen.getByRole("switch", { name: label }));
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("NotificationSettingsSection lead days", () => {
  it("shows the stored lead time", () => {
    renderSection({ loanReminderLeadDays: 5 });

    expect(screen.getByRole("spinbutton", { name: COPY.leadDaysLabel })).toHaveValue("5");
  });

  it("saves the incremented lead time", async () => {
    renderSection({ loanReminderLeadDays: 5 });

    await userEvent.click(screen.getByRole("button", { name: COPY.increment }));

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    expect(updateBodies()).toEqual(['{"loanReminderLeadDays":6}']);
  });

  it("never sends a lead time above the allowed maximum", async () => {
    renderSection({ loanReminderLeadDays: LOAN_REMINDER_LEAD_DAYS.max });

    const stepper = screen.getByRole("spinbutton", { name: COPY.leadDaysLabel });
    stepper.focus();
    await userEvent.keyboard("{ArrowUp}");

    expect(screen.getByRole("button", { name: COPY.increment })).toBeDisabled();
    expect(updateBodies()).toEqual([]);
  });

  it("never sends a lead time below the allowed minimum", async () => {
    renderSection({ loanReminderLeadDays: LOAN_REMINDER_LEAD_DAYS.min });

    const stepper = screen.getByRole("spinbutton", { name: COPY.leadDaysLabel });
    stepper.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: COPY.decrement })).toBeDisabled();
    expect(updateBodies()).toEqual([]);
  });
});

describe("NotificationSettingsSection test notification", () => {
  it("sends one test notification per click", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    await waitFor(() => expect(testNotificationCalls()).toHaveLength(1));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("confirms a sent test notification with a toast", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(COPY.test.success));
  });

  it("reports a failed test notification with a toast", async () => {
    respondToTest = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection();

    await userEvent.click(screen.getByRole("button", { name: COPY.test.button }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(COPY.test.error));
  });
});
