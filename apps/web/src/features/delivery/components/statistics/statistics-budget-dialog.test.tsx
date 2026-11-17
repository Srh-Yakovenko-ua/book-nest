import "@testing-library/jest-dom/vitest";

import type { BookBudgetOverview, SettingsView } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { StatisticsBudgetDialog } from "./statistics-budget-dialog";

const TODAY = new Date(2026, 7, 22, 9, 0, 0);

const PROGRESS = {
  budget: 9000,
  daysInMonth: 31,
  deliveryShareOfBudgetPercent: null,
  elapsedDays: 22,
  forecast: null,
  isForecastComplete: true,
  month: "2026-08-01",
  outlook: "on_track",
  projectedOverage: null,
  projectedRemaining: 0,
  remaining: 9000,
  remainingSigned: 9000,
  spentToDate: 0,
  usedPercent: 0,
  validFromMonth: "2026-08-01",
  validToMonth: null,
} satisfies NonNullable<BookBudgetOverview["budgets"][number]["currentMonth"]>;

const EMPTY_COVERAGE = {
  ordersCount: 0,
  ordersWithoutResolvedAmount: 0,
  ordersWithResolvedAmount: 0,
};

const OVERVIEW: BookBudgetOverview = {
  budgets: [
    {
      currency: "UAH",
      currentMonth: PROGRESS,
      spendCoverage: EMPTY_COVERAGE,
      upcomingChanges: [],
    },
    {
      currency: "USD",
      currentMonth: { ...PROGRESS, budget: 80, remaining: 80, remainingSigned: 80 },
      spendCoverage: {
        ordersCount: 0,
        ordersWithoutResolvedAmount: 0,
        ordersWithResolvedAmount: 0,
      },
      upcomingChanges: [],
    },
  ],
  month: "2026-08-01",
};

const TOKYO_PROFILE = {
  now: "2026-08-31T16:00:00.000Z",
  settings: { ...defaultUserProfileSettings, timezone: "Asia/Tokyo" } satisfies SettingsView,
};

const fetchMock = vi.fn();

let settingsGate: Promise<SettingsView>;

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

function amountInput(currency: string) {
  return screen.getByLabelText(`Бюджет, ${currency}`);
}

function budgetDialog({
  open,
  overview,
}: {
  open: boolean;
  overview: BookBudgetOverview | undefined;
}) {
  return <StatisticsBudgetDialog onOpenChange={vi.fn()} open={open} overview={overview} />;
}

function holdProfileSettings(): (settings: SettingsView) => void {
  let release: (settings: SettingsView) => void = () => undefined;
  settingsGate = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function monthField() {
  return screen.getByRole("button", { name: "Застосувати з" });
}

async function pickMonth(month: string) {
  await userEvent.click(monthField());
  await userEvent.click(screen.getByRole("button", { name: month }));
}

function postCall(path: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) => String(url).includes(path) && (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function postPayload(path: string) {
  const call = postCall(path);
  return call === undefined ? undefined : (JSON.parse(String(call[1].body)) as unknown);
}

function renderDialog(overview: BookBudgetOverview = OVERVIEW) {
  renderWithProviders(<StatisticsBudgetDialog onOpenChange={vi.fn()} open overview={overview} />);
}

async function save() {
  await userEvent.click(screen.getByRole("button", { name: "Зберегти бюджет" }));
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  settingsGate = Promise.resolve(defaultUserProfileSettings);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings")) return settingsGate.then(jsonResponse);
    if (url.includes("/api/delivery/budgets") && method === "POST")
      return Promise.resolve(jsonResponse(OVERVIEW));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StatisticsBudgetDialog month", () => {
  it("names the month rather than a single day", () => {
    renderDialog();

    expect(monthField()).toHaveTextContent("серпень 2026");
  });

  it("offers months instead of days and keeps the past out of reach", async () => {
    renderDialog();

    await userEvent.click(monthField());

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "липень" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "вересень" })).toBeEnabled();
  });

  it("sends the picked month as the first day of that month", async () => {
    renderDialog();

    await pickMonth("вересень");
    await save();

    await waitFor(() => expect(postPayload("/api/delivery/budgets")).toBeDefined());
    expect(postPayload("/api/delivery/budgets")).toMatchObject({
      effectiveFromMonth: "2026-09-01",
    });
  });

  it("spells out the month the change starts from", async () => {
    renderDialog();

    expect(screen.getByRole("status")).toHaveTextContent("Зміни застосуються із серпня 2026.");

    await pickMonth("вересень");

    expect(screen.getByRole("status")).toHaveTextContent("Зміни застосуються із вересня 2026.");
  });

  it("re-reads the amounts of the month the reader moved to", async () => {
    renderDialog({
      budgets: [
        {
          currency: "UAH",
          currentMonth: { ...PROGRESS, validToMonth: "2026-09-01" },
          spendCoverage: {
            ordersCount: 0,
            ordersWithoutResolvedAmount: 0,
            ordersWithResolvedAmount: 0,
          },
          upcomingChanges: [],
        },
      ],
      month: "2026-08-01",
    });

    expect(amountInput("UAH")).toHaveValue(9000);

    await pickMonth("вересень");

    expect(amountInput("UAH")).toHaveValue(null);
  });

  it("keeps an amount the reader typed when the month moves", async () => {
    renderDialog();

    await userEvent.clear(amountInput("UAH"));
    await userEvent.type(amountInput("UAH"), "12000");
    await pickMonth("вересень");

    expect(amountInput("UAH")).toHaveValue(12000);
  });

  it("starts the budget month from the profile's current month", async () => {
    vi.setSystemTime("2026-08-31T22:30:00.000Z");
    renderDialog();

    expect(monthField()).toHaveTextContent("вересень 2026");

    await userEvent.click(monthField());

    expect(screen.getByRole("button", { name: "серпень" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "вересень" })).toBeEnabled();
  });
});

describe("StatisticsBudgetDialog stopping a currency", () => {
  it("stops the currency whose amount the reader cleared", async () => {
    renderDialog();

    await userEvent.clear(amountInput("USD"));
    await save();

    await waitFor(() => expect(postCall("/api/delivery/budgets/save")).toBeDefined());
    expect(postPayload("/api/delivery/budgets/save")).toMatchObject({
      changes: expect.arrayContaining([{ action: "stop", currency: "USD" }]),
      effectiveFromMonth: "2026-08-01",
    });
  });

  it("saves every currency of one edit as a single request", async () => {
    renderDialog();

    await userEvent.clear(amountInput("USD"));
    await save();

    await waitFor(() => expect(postCall("/api/delivery/budgets/save")).toBeDefined());
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).includes("/api/delivery/budgets") &&
          (init?.method ?? "GET").toUpperCase() === "POST",
      ),
    ).toHaveLength(1);
  });

  it("leaves the currencies that still carry an amount alone", async () => {
    renderDialog();

    await userEvent.clear(amountInput("USD"));
    await save();

    await waitFor(() => expect(postCall("/api/delivery/budgets/save")).toBeDefined());
    expect(postPayload("/api/delivery/budgets/save")).toMatchObject({
      changes: expect.arrayContaining([{ action: "set", currency: "UAH", monthlyAmount: 9000 }]),
    });
  });

  it("asks for nothing when a currency was empty all along", async () => {
    renderDialog({
      budgets: [
        {
          currency: "UAH",
          currentMonth: PROGRESS,
          spendCoverage: EMPTY_COVERAGE,
          upcomingChanges: [],
        },
      ],
      month: "2026-08-01",
    });

    await save();

    await waitFor(() => expect(postCall("/api/delivery/budgets")).toBeDefined());
    expect(postCall("/api/delivery/budgets/EUR/stop")).toBeUndefined();
    expect(postCall("/api/delivery/budgets/USD/stop")).toBeUndefined();
  });

  it("labels every amount by its currency without printing a symbol", () => {
    renderDialog();

    expect(amountInput("UAH")).toHaveValue(9000);
    expect(amountInput("EUR")).toHaveValue(null);
    expect(screen.getByText("Не вказуйте суму для валют без бюджету.")).toBeInTheDocument();
  });
});

describe("StatisticsBudgetDialog opening", () => {
  it("fills the amounts that loaded while it was still closed", () => {
    const { rerender } = renderWithProviders(budgetDialog({ open: false, overview: undefined }));

    rerender(budgetDialog({ open: true, overview: OVERVIEW }));

    expect(amountInput("UAH")).toHaveValue(9000);
    expect(amountInput("USD")).toHaveValue(80);
  });

  it("shows the amounts current at the moment it opens again", () => {
    const raised: BookBudgetOverview = {
      budgets: [
        {
          currency: "UAH",
          currentMonth: { ...PROGRESS, budget: 12500, remaining: 12500, remainingSigned: 12500 },
          spendCoverage: EMPTY_COVERAGE,
          upcomingChanges: [],
        },
      ],
      month: "2026-08-01",
    };
    const { rerender } = renderWithProviders(budgetDialog({ open: true, overview: OVERVIEW }));
    expect(amountInput("UAH")).toHaveValue(9000);

    rerender(budgetDialog({ open: false, overview: OVERVIEW }));
    rerender(budgetDialog({ open: false, overview: raised }));
    rerender(budgetDialog({ open: true, overview: raised }));

    expect(amountInput("UAH")).toHaveValue(12500);
  });
});

describe("StatisticsBudgetDialog profile time zone arriving after it opens", () => {
  it("opens on the profile's current month once the profile time zone arrives", async () => {
    vi.setSystemTime(TOKYO_PROFILE.now);
    const releaseSettings = holdProfileSettings();
    renderDialog();
    expect(monthField()).toHaveTextContent("серпень 2026");

    releaseSettings(TOKYO_PROFILE.settings);

    await waitFor(() => expect(monthField()).toHaveTextContent("вересень 2026"));
    await save();
    await waitFor(() => expect(postPayload("/api/delivery/budgets")).toBeDefined());
    expect(postPayload("/api/delivery/budgets")).toMatchObject({
      effectiveFromMonth: "2026-09-01",
    });
  });

  it("keeps the month the reader picked when the profile time zone arrives", async () => {
    vi.setSystemTime(TOKYO_PROFILE.now);
    const releaseSettings = holdProfileSettings();
    renderDialog();
    await pickMonth("жовтень");

    releaseSettings(TOKYO_PROFILE.settings);
    await userEvent.click(monthField());
    await waitFor(() => expect(screen.getByRole("button", { name: "серпень" })).toBeDisabled());

    expect(monthField()).toHaveTextContent("жовтень 2026");
  });

  it("shows the budget covering the profile month for currencies the reader has not typed", async () => {
    vi.setSystemTime(TOKYO_PROFILE.now);
    const releaseSettings = holdProfileSettings();
    renderDialog({
      budgets: [
        {
          currency: "UAH",
          currentMonth: { ...PROGRESS, validToMonth: "2026-09-01" },
          spendCoverage: EMPTY_COVERAGE,
          upcomingChanges: [
            { effectiveFromMonth: "2026-09-01", kind: "change", monthlyAmount: 12000 },
          ],
        },
      ],
      month: "2026-08-01",
    });
    expect(amountInput("UAH")).toHaveValue(9000);

    releaseSettings(TOKYO_PROFILE.settings);

    await waitFor(() => expect(amountInput("UAH")).toHaveValue(12000));
  });
});
