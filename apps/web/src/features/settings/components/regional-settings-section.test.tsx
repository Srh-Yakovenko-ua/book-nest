import "@testing-library/jest-dom/vitest";
import type { WeekStartDay } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { RegionalSettingsSection } from "./regional-settings-section";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const RUNTIME_TIMEZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

const COPY = {
  monday: "Понеділок",
  saved: "Збережено",
  search: "Пошук часового поясу",
  sunday: "Неділя",
  triggerLabel: "Ваш часовий пояс",
} as const satisfies Record<string, string>;

const TIMEZONES = {
  known: "Europe/Berlin",
  legacyAlias: "Europe/Kiev",
  mergedAlias: "Europe/Zaporozhye",
  other: "Europe/Warsaw",
  unlisted: "UTC",
  unlistedAlias: "Europe/Kyiv",
  unrelated: "America/New_York",
} as const satisfies Record<string, string>;

const fetchMock = vi.fn();

let respondToUpdate: () => Promise<Response>;

function canonicalTimezone(zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openTimezoneList() {
  await userEvent.click(screen.getByRole("button", { name: COPY.triggerLabel }));
  return screen.findByPlaceholderText(COPY.search);
}

function renderSection(timezone: string, weekStartDay: WeekStartDay = "monday") {
  return renderWithProviders(
    <RegionalSettingsSection timezone={timezone} weekStartDay={weekStartDay} />,
  );
}

function updateBodies(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH")
    .map(([, init]) => String(init?.body));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  respondToUpdate = () => Promise.resolve(jsonResponse(defaultUserProfileSettings));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings") && method === "PATCH") return respondToUpdate();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RegionalSettingsSection", () => {
  it("shows the stored timezone on the trigger", () => {
    renderSection(TIMEZONES.known);

    expect(screen.getByRole("button", { name: COPY.triggerLabel })).toHaveTextContent(
      TIMEZONES.known,
    );
  });

  it("saves the picked timezone and closes the list", async () => {
    renderSection(TIMEZONES.known);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.other }));

    await waitFor(() => expect(updateBodies()).toEqual([`{"timezone":"${TIMEZONES.other}"}`]));
    await waitFor(() => expect(screen.queryByPlaceholderText(COPY.search)).not.toBeInTheDocument());
  });

  it("confirms a saved timezone with a toast", async () => {
    renderSection(TIMEZONES.known);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.other }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(COPY.saved));
  });

  it("sends nothing when the already selected timezone is picked", async () => {
    renderSection(TIMEZONES.known);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.known }));

    await waitFor(() => expect(screen.queryByPlaceholderText(COPY.search)).not.toBeInTheDocument());
    expect(updateBodies()).toEqual([]);
  });

  it("offers the stored timezone even when the runtime list omits it", async () => {
    expect(RUNTIME_TIMEZONES).not.toContain(TIMEZONES.unlisted);

    renderSection(TIMEZONES.unlisted);

    await openTimezoneList();

    expect(await screen.findByRole("option", { name: TIMEZONES.unlisted })).toBeInTheDocument();
  });

  it("saves the picked first day of the week", async () => {
    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.sunday }));

    await waitFor(() => expect(updateBodies()).toEqual(['{"weekStartDay":"sunday"}']));
  });

  it("sends nothing when the already selected first day of the week is picked", async () => {
    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.monday }));

    await waitFor(() => expect(screen.getByRole("radio", { name: COPY.monday })).toBeChecked());
    expect(updateBodies()).toEqual([]);
  });

  it("offers the stored timezone exactly once even when the runtime lists it under an alias", async () => {
    renderSection(TIMEZONES.unlistedAlias);
    await openTimezoneList();
    await screen.findByRole("option", { name: TIMEZONES.unlistedAlias });

    const storedZone = canonicalTimezone(TIMEZONES.unlistedAlias);
    const offeringStoredZone = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "")
      .filter((name) => canonicalTimezone(name) === storedZone);

    expect(offeringStoredZone).toEqual([TIMEZONES.unlistedAlias]);
  });

  it("keeps a runtime-omitted stored timezone selectable after a search", async () => {
    expect(RUNTIME_TIMEZONES).not.toContain(TIMEZONES.unlistedAlias);

    renderSection(TIMEZONES.unlistedAlias);

    const search = await openTimezoneList();
    await userEvent.type(search, "Kyiv");

    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.unlistedAlias }));

    await waitFor(() => expect(screen.queryByPlaceholderText(COPY.search)).not.toBeInTheDocument());
  });

  it("lists a runtime legacy timezone once under its current name", async () => {
    expect(RUNTIME_TIMEZONES).toContain(TIMEZONES.legacyAlias);

    renderSection(TIMEZONES.unrelated);
    await openTimezoneList();

    const kyivOptions = await screen.findAllByRole("option", { name: TIMEZONES.unlistedAlias });
    expect(kyivOptions).toHaveLength(1);
    expect(screen.queryByRole("option", { name: TIMEZONES.legacyAlias })).not.toBeInTheDocument();
  });

  it("saves the current name of a runtime legacy timezone picked through a search", async () => {
    renderSection(TIMEZONES.unrelated);

    const search = await openTimezoneList();
    await userEvent.type(search, "Kyiv");
    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.unlistedAlias }));

    await waitFor(() => expect(updateBodies()).toEqual(['{"timezone":"Europe/Kyiv"}']));
  });

  it("finds a timezone when searching by its legacy name", async () => {
    renderSection(TIMEZONES.unrelated);

    const search = await openTimezoneList();
    await userEvent.type(search, "Kiev");

    expect(
      await screen.findByRole("option", { name: TIMEZONES.unlistedAlias }),
    ).toBeInTheDocument();
  });

  it("shows a stored legacy timezone on the trigger under its current name", () => {
    renderSection(TIMEZONES.legacyAlias);

    expect(screen.getByRole("button", { name: COPY.triggerLabel })).toHaveTextContent(
      TIMEZONES.unlistedAlias,
    );
  });

  it("lists a stored legacy timezone once under its current name", async () => {
    renderSection(TIMEZONES.legacyAlias);
    await openTimezoneList();

    const kyivOptions = await screen.findAllByRole("option", { name: TIMEZONES.unlistedAlias });
    expect(kyivOptions).toHaveLength(1);
    expect(screen.queryByRole("option", { name: TIMEZONES.legacyAlias })).not.toBeInTheDocument();
  });

  it("sends nothing when the current name of a stored legacy timezone is picked", async () => {
    renderSection(TIMEZONES.legacyAlias);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: TIMEZONES.unlistedAlias }));

    await waitFor(() => expect(screen.queryByPlaceholderText(COPY.search)).not.toBeInTheDocument());
    expect(updateBodies()).toEqual([]);
  });

  it("finds a stored zone merged into a renamed one by the current name, shown once", async () => {
    expect(canonicalTimezone(TIMEZONES.mergedAlias)).toBe(TIMEZONES.legacyAlias);

    renderSection(TIMEZONES.mergedAlias);

    const search = await openTimezoneList();
    await userEvent.type(search, "Kyiv");

    expect(await screen.findByRole("option", { name: TIMEZONES.mergedAlias })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: TIMEZONES.unlistedAlias })).not.toBeInTheDocument();
  });
});
