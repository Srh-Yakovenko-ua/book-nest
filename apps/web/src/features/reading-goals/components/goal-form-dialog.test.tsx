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
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(GOAL_URL) && method === "PATCH")
      return Promise.resolve(jsonResponse(makeReadingGoalView()));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalFormDialog validation", () => {
  it("puts a passed deadline right next to its own field", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-01-05" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "До дати" })).toHaveAccessibleDescription(
        "Оберіть дату пізніше за сьогодні",
      ),
    );
    expect(updateCall()).toBeUndefined();
  });

  it("puts a target the list cannot cover right next to its own field", async () => {
    const dialog = openEditDialog(makeReadingGoalView());
    const target = within(dialog).getByLabelText("Прочитати книг");

    await userEvent.clear(target);
    await userEvent.type(target, "999");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(target).toHaveAccessibleDescription("У списку лише 20 книг"));
    expect(target).toHaveAttribute("aria-invalid", "true");
    expect(updateCall()).toBeUndefined();
  });

  it("clears a name the reader wiped out instead of saving an empty string", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ name: "Осінній забіг" }));

    await userEvent.clear(within(dialog).getByLabelText(/Назва цілі/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(JSON.parse(String(updateCall()?.[1].body))).toEqual({
      deadline: "2026-11-30",
      name: null,
      targetCount: 8,
    });
  });
});
