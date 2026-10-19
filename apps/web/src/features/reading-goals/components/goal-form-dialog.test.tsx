import "@testing-library/jest-dom/vitest";

import type { ReadingGoalView } from "@app/shared";
import type { ReactNode, RefObject } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeReadingGoalView } from "../model/reading-goals.fixtures";
import { GoalFormDialog } from "./goal-form-dialog";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const GOAL_URL = "/api/goals/goal-1";
const QUICK_PICK_GROUP = {
  deadline: "Швидкий вибір дедлайну",
  target: "Швидкий вибір кількості книг",
} as const;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();
const onOpenChange = vi.fn();
const openerRef: RefObject<HTMLButtonElement | null> = { current: null };

let respondToUpdate: () => Response;

function calendarDay(day: string) {
  return within(screen.getByRole("grid")).getByText(day);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function openEditDialog(goal: ReadingGoalView, bookCount = 20) {
  renderWithProviders(
    <GoalFormDialog
      bookCount={bookCount}
      listName="Книги на осінь"
      mode={{ goal, kind: "edit" }}
      onOpenChange={onOpenChange}
      open
      openerRef={openerRef}
    />,
  );
  return screen.getByRole("dialog");
}

function quickPickLabels(dialog: HTMLElement, group: keyof typeof QUICK_PICK_GROUP) {
  return within(within(dialog).getByRole("group", { name: QUICK_PICK_GROUP[group] }))
    .getAllByRole("button")
    .map((button) => button.textContent);
}

function updateBody(): unknown {
  return JSON.parse(String(updateCall()?.[1].body));
}

function updateCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(GOAL_URL) && (init?.method ?? "GET").toUpperCase() === "PATCH",
  ) as [string, RequestInit] | undefined;
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToUpdate = () => jsonResponse(makeReadingGoalView());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(GOAL_URL) && method === "PATCH") return Promise.resolve(respondToUpdate());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalFormDialog validation", () => {
  it("puts a deadline moved to today right next to its own field", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-08-20" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "До дати, 20 серпня 2026" }));
    await userEvent.click(calendarDay("15"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "До дати, 15 серпня 2026" }),
      ).toHaveAccessibleDescription("Оберіть дату пізніше за сьогодні"),
    );
    expect(updateCall()).toBeUndefined();
  });

  it("caps the target at the books fixed in the goal", async () => {
    const dialog = openEditDialog(makeReadingGoalView(), 8);
    const target = within(dialog).getByLabelText("Прочитати книг");

    expect(target).toHaveAttribute("max", "8");
    expect(target).toHaveAccessibleDescription("У цілі 8 книг");

    await userEvent.clear(target);
    await userEvent.type(target, "9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(target).toHaveAccessibleDescription("У цілі лише 8 книг"));
    expect(target).toHaveAttribute("aria-invalid", "true");
    expect(updateCall()).toBeUndefined();
  });

  it("shows a deadline the server rejected right next to its own field", async () => {
    respondToUpdate = () =>
      jsonResponse(
        { errorsMessages: [{ field: "deadline", message: "Deadline must be after today" }] },
        400,
      );
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-08-20" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "До дати, 20 серпня 2026" }));
    await userEvent.click(calendarDay("16"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "До дати, 16 серпня 2026" }),
      ).toHaveAccessibleDescription("Deadline must be after today"),
    );
    expect(updateBody()).toEqual({ deadline: "2026-08-16" });
  });
});

describe("GoalFormDialog changes", () => {
  it("keeps save locked until something changes", async () => {
    const dialog = openEditDialog(makeReadingGoalView());
    const save = within(dialog).getByRole("button", { name: "Зберегти" });

    expect(save).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");

    expect(save).toBeEnabled();
  });

  it("sends only the name when only the name changed", async () => {
    const dialog = openEditDialog(makeReadingGoalView());

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: "Осінній забіг" });
  });

  it("renames an expired goal without re-checking its old deadline", async () => {
    const dialog = openEditDialog(
      makeReadingGoalView({ daysLeft: -4, deadline: "2026-01-05", status: "expired" }),
    );

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Зимовий забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: "Зимовий забіг" });
    expect(
      within(dialog).getByRole("button", { name: "До дати, 5 січня 2026" }),
    ).not.toHaveAccessibleDescription("Оберіть дату пізніше за сьогодні");
  });

  it("clears a name the reader wiped out instead of saving an empty string", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ name: "Осінній забіг" }));

    await userEvent.clear(within(dialog).getByLabelText(/Назва цілі/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: null });
  });
});

describe("GoalFormDialog target presets", () => {
  it("offers only the presets the goal can hold and marks the current one", () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 8 }), 8);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "Усі · 8"]);
    expect(within(dialog).getByRole("button", { name: "Усі · 8" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not repeat a preset that already covers every book", () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 3 }), 10);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "10"]);
  });

  it("stops the last preset at the largest target the server accepts", () => {
    const dialog = openEditDialog(makeReadingGoalView(), 1500);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "10", "Максимум · 1000"]);
  });

  it("fills the target from a preset and saves only that change", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 8 }), 20);

    await userEvent.click(within(dialog).getByRole("button", { name: "5" }));

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveValue(5);
    expect(within(dialog).getByRole("button", { name: "5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ targetCount: 5 });
  });
});

describe("GoalFormDialog deadline shortcuts", () => {
  it("sets the deadline to an ISO day counted from today", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-30" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual([
      "Кінець місяця",
      "Через 3 місяці",
      "Кінець року",
    ]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець місяця" }));
    expect(
      within(dialog).getByRole("button", { name: "До дати, 31 серпня 2026" }),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Через 3 місяці" }));
    expect(
      within(dialog).getByRole("button", { name: "До дати, 15 листопада 2026" }),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ deadline: "2026-11-15" });
  });

  it("hides the end of the month on its last day", async () => {
    vi.setSystemTime(new Date(2026, 7, 31, 9, 0, 0));
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-30" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual(["Через 3 місяці", "Кінець року"]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець року" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ deadline: "2026-12-31" });
  });

  it("offers a single shortcut when the month and the year end on the same day", () => {
    vi.setSystemTime(new Date(2026, 11, 10, 9, 0, 0));
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2027-01-20" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual(["Кінець місяця", "Через 3 місяці"]);
  });
});
