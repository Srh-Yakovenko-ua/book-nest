import "@testing-library/jest-dom/vitest";
import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { SettingsView } from "./settings-view";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const COPY = {
  errorTitle: "Не вдалося завантажити налаштування",
  loading: "Завантаження налаштувань…",
  notificationsTitle: "Нагадування на пошту",
  regionalTitle: "Часовий пояс",
  retry: "Спробувати ще раз",
  timezoneTrigger: "Ваш часовий пояс",
  title: "Налаштування",
} as const satisfies Record<string, string>;

const fetchMock = vi.fn();

let respondToSettings: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
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

  it("renders both settings sections once the settings arrive", async () => {
    renderWithProviders(<SettingsView />);

    expect(
      await screen.findByRole("heading", { level: 2, name: COPY.notificationsTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: COPY.regionalTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.timezoneTrigger })).toHaveTextContent(
      "Europe/Warsaw",
    );
  });

  it("raises an alert when the settings fail to load", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<SettingsView />);

    expect(await screen.findByRole("alert")).toHaveTextContent(COPY.errorTitle);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
