import "@testing-library/jest-dom/vitest";
import type { WeekStartDay } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { RegionalSettingsSection } from "./regional-settings-section";

const RUNTIME_TIMEZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

const WINTER_NOW = parseISO("2026-01-15T12:00:00Z");

const COPY = {
  saveStatus: messages.settings.saveStatus,
  timezone: messages.settings.regional.timezone,
  title: messages.settings.regional.title,
  weekStart: messages.settings.regional.weekStartDay,
} as const;

const WINTER_LABELS = {
  berlin: "Берлін · UTC+01:00",
  kyiv: "Київ · UTC+02:00",
  mergedAlias: "Europe/Zaporozhye · UTC+02:00",
  utc: "UTC · UTC+00:00",
  warsaw: "Варшава · UTC+01:00",
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

function firstPreviewDay() {
  const preview = screen.getByRole("list", { name: COPY.weekStart.preview });
  const [first] = within(preview).getAllByRole("listitem");
  return first;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openTimezoneList() {
  await userEvent.click(timezoneTrigger());
  return screen.findByRole("combobox", { name: COPY.timezone.search });
}

function renderSection(timezone: string, weekStartDay: WeekStartDay = "monday") {
  return renderWithProviders(
    <RegionalSettingsSection timezone={timezone} weekStartDay={weekStartDay} />,
  );
}

function timezoneTrigger() {
  return screen.getByRole("button", { name: new RegExp(`^${COPY.timezone.label}`) });
}

function updateBodies(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH")
    .map(([, init]) => String(init?.body));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WINTER_NOW);
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RegionalSettingsSection", () => {
  it("titles the card after dates and calendars", () => {
    renderSection(TIMEZONES.known);

    expect(screen.getByRole("heading", { level: 2, name: COPY.title })).toBeInTheDocument();
  });
});

describe("RegionalSettingsSection timezone trigger", () => {
  it("shows the stored timezone as its city and winter UTC offset", () => {
    renderSection(TIMEZONES.unlistedAlias);

    expect(timezoneTrigger()).toHaveTextContent(WINTER_LABELS.kyiv);
  });

  it("explains that reminders are planned at 09:00 in the chosen timezone", () => {
    renderSection(TIMEZONES.known);

    expect(timezoneTrigger()).toHaveAccessibleDescription(COPY.timezone.hint);
  });

  it("shows a stored legacy timezone under its current name", () => {
    renderSection(TIMEZONES.legacyAlias);

    expect(timezoneTrigger()).toHaveTextContent(WINTER_LABELS.kyiv);
  });

  it("shows a stored zone without a city name under its id and offset", () => {
    renderSection(TIMEZONES.mergedAlias);

    expect(timezoneTrigger()).toHaveTextContent(WINTER_LABELS.mergedAlias);
  });
});

describe("RegionalSettingsSection timezone list", () => {
  it("lists the stored timezone first and active", async () => {
    renderSection(TIMEZONES.other);

    await openTimezoneList();
    const [first] = screen.getAllByRole("option");

    expect(first).toHaveAccessibleName(WINTER_LABELS.warsaw);
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it.each([
    { label: WINTER_LABELS.kyiv, query: "Київ" },
    { label: WINTER_LABELS.kyiv, query: "Kyiv" },
    { label: WINTER_LABELS.kyiv, query: "Kiev" },
    { label: WINTER_LABELS.kyiv, query: "Europe/Kyiv" },
    { label: WINTER_LABELS.warsaw, query: "Warsaw" },
  ])("puts $label first and active for the query $query", async ({ label, query }) => {
    renderSection(TIMEZONES.known);

    await userEvent.type(await openTimezoneList(), query);
    const [first] = screen.getAllByRole("option");

    expect(first).toHaveAccessibleName(label);
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("announces an empty result and lists nothing when no zone matches", async () => {
    renderSection(TIMEZONES.known);

    await userEvent.type(await openTimezoneList(), "zzzz");

    expect(
      within(screen.getByRole("dialog", { name: COPY.timezone.label })).getByRole("status"),
    ).toHaveTextContent(COPY.timezone.empty);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("closes the list on Escape and returns focus to the trigger", async () => {
    renderSection(TIMEZONES.known);

    await userEvent.type(await openTimezoneList(), "Kyiv");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(timezoneTrigger()).toHaveFocus());
  });

  it("starts with an empty search when reopened after Escape", async () => {
    renderSection(TIMEZONES.known);

    await userEvent.type(await openTimezoneList(), "Kyiv");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(await openTimezoneList()).toHaveValue("");
  });

  it("saves the second result with ArrowDown and Enter", async () => {
    renderSection(TIMEZONES.known);

    await userEvent.type(await openTimezoneList(), "Bahia");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(updateBodies()).toEqual(['{"timezone":"America/Bahia_Banderas"}']));
  });

  it("saves the picked timezone and closes the list", async () => {
    renderSection(TIMEZONES.known);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: WINTER_LABELS.warsaw }));

    await waitFor(() => expect(updateBodies()).toEqual([`{"timezone":"${TIMEZONES.other}"}`]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sends nothing when the already selected timezone is picked", async () => {
    renderSection(TIMEZONES.known);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: WINTER_LABELS.berlin }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateBodies()).toEqual([]);
  });

  it("offers the stored timezone even when the runtime list omits it", async () => {
    expect(RUNTIME_TIMEZONES).not.toContain(TIMEZONES.unlisted);

    renderSection(TIMEZONES.unlisted);

    await openTimezoneList();

    expect(await screen.findByRole("option", { name: WINTER_LABELS.utc })).toBeInTheDocument();
  });

  it("offers the stored timezone exactly once even when the runtime lists it under an alias", async () => {
    expect(RUNTIME_TIMEZONES).toContain(TIMEZONES.legacyAlias);

    renderSection(TIMEZONES.unlistedAlias);
    await openTimezoneList();

    expect(await screen.findAllByRole("option", { name: WINTER_LABELS.kyiv })).toHaveLength(1);
  });

  it("keeps a runtime-omitted stored timezone selectable after a search", async () => {
    expect(RUNTIME_TIMEZONES).not.toContain(TIMEZONES.unlistedAlias);

    renderSection(TIMEZONES.unlistedAlias);

    await userEvent.type(await openTimezoneList(), "Kyiv");
    await userEvent.click(await screen.findByRole("option", { name: WINTER_LABELS.kyiv }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lists a runtime legacy timezone once under its current name", async () => {
    expect(RUNTIME_TIMEZONES).toContain(TIMEZONES.legacyAlias);

    renderSection(TIMEZONES.unrelated);
    await openTimezoneList();

    expect(await screen.findAllByRole("option", { name: WINTER_LABELS.kyiv })).toHaveLength(1);
    expect(
      screen.queryByRole("option", { name: new RegExp(`^${TIMEZONES.legacyAlias}`) }),
    ).not.toBeInTheDocument();
  });

  it("saves the current name of a runtime legacy timezone picked through a search", async () => {
    renderSection(TIMEZONES.unrelated);

    await userEvent.type(await openTimezoneList(), "Kyiv");
    await userEvent.click(await screen.findByRole("option", { name: WINTER_LABELS.kyiv }));

    await waitFor(() => expect(updateBodies()).toEqual(['{"timezone":"Europe/Kyiv"}']));
  });

  it("lists a stored legacy timezone once under its current name", async () => {
    renderSection(TIMEZONES.legacyAlias);
    await openTimezoneList();

    expect(await screen.findAllByRole("option", { name: WINTER_LABELS.kyiv })).toHaveLength(1);
    expect(
      screen.queryByRole("option", { name: new RegExp(`^${TIMEZONES.legacyAlias}`) }),
    ).not.toBeInTheDocument();
  });

  it("sends nothing when the current name of a stored legacy timezone is picked", async () => {
    renderSection(TIMEZONES.legacyAlias);

    await openTimezoneList();
    await userEvent.click(await screen.findByRole("option", { name: WINTER_LABELS.kyiv }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateBodies()).toEqual([]);
  });

  it("finds a stored zone merged into a renamed one by the current name, shown once", async () => {
    renderSection(TIMEZONES.mergedAlias);

    await userEvent.type(await openTimezoneList(), "Kyiv");

    expect(
      await screen.findByRole("option", { name: WINTER_LABELS.mergedAlias }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: WINTER_LABELS.kyiv })).not.toBeInTheDocument();
  });
});

describe("RegionalSettingsSection week start", () => {
  it("saves the picked first day of the week once", async () => {
    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.weekStart.sunday }));
    await screen.findByText(COPY.saveStatus.saved);

    expect(updateBodies()).toEqual(['{"weekStartDay":"sunday"}']);
  });

  it("sends nothing when the already selected first day of the week is picked", async () => {
    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.weekStart.monday }));

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: COPY.weekStart.monday })).toBeChecked(),
    );
    expect(updateBodies()).toEqual([]);
  });

  it.each([
    { firstDay: /^пн/, weekStartDay: "monday" },
    { firstDay: /^нд/, weekStartDay: "sunday" },
  ] as const)(
    "starts the weekday preview on the stored $weekStartDay",
    ({ firstDay, weekStartDay }) => {
      renderSection(TIMEZONES.known, weekStartDay);

      expect(firstPreviewDay()).toHaveTextContent(firstDay);
    },
  );

  it.each([
    { firstDay: /^нд/, pick: COPY.weekStart.sunday, stored: "monday" },
    { firstDay: /^пн/, pick: COPY.weekStart.monday, stored: "sunday" },
  ] as const)(
    "reorders the preview as soon as $pick is chosen, before the save resolves",
    async ({ firstDay, pick, stored }) => {
      respondToUpdate = () => new Promise<Response>(() => {});

      renderSection(TIMEZONES.known, stored);

      await userEvent.click(screen.getByRole("radio", { name: pick }));

      await waitFor(() => expect(firstPreviewDay()).toHaveTextContent(firstDay));
    },
  );

  it("describes the week start choice with the calendar hint", () => {
    renderSection(TIMEZONES.known, "monday");

    expect(
      screen.getByRole("radiogroup", { name: COPY.weekStart.label }),
    ).toHaveAccessibleDescription(COPY.weekStart.hint);
  });

  it("marks the week start choice disabled while its save is pending", async () => {
    respondToUpdate = () => new Promise<Response>(() => {});

    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.weekStart.sunday }));

    await waitFor(() =>
      expect(screen.getByRole("radiogroup", { name: COPY.weekStart.label })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
  });

  it("returns to the stored first day and offers a retry when the save fails", async () => {
    respondToUpdate = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderSection(TIMEZONES.known, "monday");

    await userEvent.click(screen.getByRole("radio", { name: COPY.weekStart.sunday }));

    expect(
      await screen.findByRole("button", { name: COPY.saveStatus.retry }),
    ).toHaveAccessibleDescription(COPY.weekStart.label);
    expect(screen.getByRole("radio", { name: COPY.weekStart.monday })).toBeChecked();
  });
});
