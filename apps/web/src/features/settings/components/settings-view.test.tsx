import "@testing-library/jest-dom/vitest";
import { defaultUserProfileSettings } from "@app/shared";
import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { SettingsView } from "./settings-view";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const WINTER_NOW = parseISO("2026-01-15T12:00:00Z");

const COPY = {
  appearanceTitle: messages.settings.appearance.title,
  comingSoon: /Скоро/,
  errorTitle: "Не вдалося завантажити налаштування",
  loading: "Завантаження налаштувань…",
  notificationsTitle: "Нагадування",
  regionalTitle: "Дата й календар",
  retry: "Спробувати ще раз",
  timezoneTrigger: /^Часовий пояс/,
  title: "Налаштування",
  warsawInWinter: "Варшава · UTC+01:00",
} as const satisfies Record<string, RegExp | string>;

const fetchMock = vi.fn();

let respondToSettings: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WINTER_NOW);
  Element.prototype.scrollIntoView = vi.fn();
  respondToSettings = () =>
    Promise.resolve(jsonResponse({ ...defaultUserProfileSettings, timezone: "Europe/Warsaw" }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings") && method === "GET") return respondToSettings();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SettingsView", () => {
  it("announces the skeleton while the settings load", () => {
    respondToSettings = () => new Promise<Response>(() => {});

    renderWithProviders(<SettingsView />);

    expect(screen.getByRole("heading", { level: 1, name: COPY.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(COPY.loading);
  });

  it("shows the appearance card while the settings load", () => {
    respondToSettings = () => new Promise<Response>(() => {});

    renderWithProviders(<SettingsView />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: COPY.appearanceTitle }),
    ).toBeInTheDocument();
  });

  it("renders both settings sections once the settings arrive", async () => {
    renderWithProviders(<SettingsView />);

    expect(
      await screen.findByRole("heading", { level: 2, name: COPY.notificationsTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: COPY.regionalTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.timezoneTrigger })).toHaveTextContent(
      COPY.warsawInWinter,
    );
  });

  it("places the appearance card after the notification and calendar sections", async () => {
    renderWithProviders(<SettingsView />);

    await screen.findByRole("heading", { level: 2, name: COPY.notificationsTitle });

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([COPY.notificationsTitle, COPY.regionalTitle, COPY.appearanceTitle]);
  });

  it("shows no coming-soon rows once the settings arrive", async () => {
    renderWithProviders(<SettingsView />);

    await screen.findByRole("heading", { level: 2, name: COPY.notificationsTitle });

    expect(screen.queryByText(COPY.comingSoon)).not.toBeInTheDocument();
  });

  it("raises an alert when the settings fail to load", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<SettingsView />);

    expect(await screen.findByRole("alert")).toHaveTextContent(COPY.errorTitle);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the appearance card when the settings fail to load", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<SettingsView />);

    await screen.findByRole("alert");
    expect(
      screen.getByRole("heading", { level: 2, name: COPY.appearanceTitle }),
    ).toBeInTheDocument();
  });

  it("recovers the sections when the retry succeeds", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<SettingsView />);
    await screen.findByRole("alert");

    respondToSettings = () => Promise.resolve(jsonResponse(defaultUserProfileSettings));
    await userEvent.click(screen.getByRole("button", { name: COPY.retry }));

    expect(
      await screen.findByRole("heading", { level: 2, name: COPY.notificationsTitle }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
