import "@testing-library/jest-dom/vitest";
import { defaultUserProfileSettings } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { useSettings } from "../api/use-settings";
import { LanguageSync } from "../components/language-sync";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const QUERY_STATUS = {
  error: "error",
  pending: "pending",
  success: "success",
} as const satisfies Record<string, string>;

const SYNCED_TIMEZONE = "UTC";

const fetchMock = vi.fn();

let respondToSettings: () => Promise<Response>;
let respondToUpdate: () => Promise<Response>;

function deferredUpdate(body: Record<string, unknown>) {
  let release = () => {};
  const response = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse(body));
  });
  return { release, respond: () => response };
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ...defaultUserProfileSettings, ...body }), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function LanguageSyncHarness() {
  const settings = useSettings();

  return (
    <>
      <LanguageSync />
      <p>{settings.status}</p>
      <p>{settings.data?.timezone ?? "-"}</p>
    </>
  );
}

function updateBodies(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH")
    .map(([, init]) => String(init?.body));
}

beforeEach(() => {
  respondToSettings = () => Promise.resolve(jsonResponse({ language: "en" }));
  respondToUpdate = () => Promise.resolve(jsonResponse({ language: "uk" }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings") && method === "GET") return respondToSettings();
    if (url.includes("/api/profile/settings") && method === "PATCH") return respondToUpdate();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LanguageSync", () => {
  it("saves the active locale when the stored language differs", async () => {
    renderWithProviders(<LanguageSyncHarness />);

    await waitFor(() => expect(updateBodies()).toEqual(['{"language":"uk"}']));
  });

  it("saves the language once even while the server keeps reporting the other one", async () => {
    const pendingUpdate = deferredUpdate({ language: "en", timezone: SYNCED_TIMEZONE });
    respondToUpdate = pendingUpdate.respond;

    const { rerender } = renderWithProviders(<LanguageSyncHarness />);

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    pendingUpdate.release();
    await screen.findByText(SYNCED_TIMEZONE);
    rerender(<LanguageSyncHarness />);
    rerender(<LanguageSyncHarness />);

    expect(updateBodies()).toHaveLength(1);
  });

  it("saves nothing when the stored language already matches the locale", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ language: "uk" }));

    renderWithProviders(<LanguageSyncHarness />);

    await screen.findByText(QUERY_STATUS.success);
    expect(updateBodies()).toEqual([]);
  });

  it("saves nothing while the settings are still loading", async () => {
    respondToSettings = () => new Promise<Response>(() => {});

    renderWithProviders(<LanguageSyncHarness />);

    await screen.findByText(QUERY_STATUS.pending);
    expect(updateBodies()).toEqual([]);
  });

  it("saves nothing when the settings failed to load", async () => {
    respondToSettings = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<LanguageSyncHarness />);

    await screen.findByText(QUERY_STATUS.error);
    expect(updateBodies()).toEqual([]);
  });

  it("stays silent instead of toasting the sync", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ language: "uk", timezone: "UTC" }));

    renderWithProviders(<LanguageSyncHarness />);

    await waitFor(() => expect(updateBodies()).toHaveLength(1));
    await screen.findByText(SYNCED_TIMEZONE);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
