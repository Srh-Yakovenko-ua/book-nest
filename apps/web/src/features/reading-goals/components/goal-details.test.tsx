import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeReadingGoalDetail } from "../model/reading-goals.fixtures";
import { GoalDetails } from "./goal-details";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const GOAL_ID = "goal-1";
const GOAL_URL = `/api/goals/${GOAL_ID}`;

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToDetail: () => Response;

function deleteCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(GOAL_URL) && (init?.method ?? "GET").toUpperCase() === "DELETE",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDetails() {
  return renderWithProviders(<GoalDetails id={GOAL_ID} />);
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToDetail = () => jsonResponse(makeReadingGoalDetail());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(GOAL_URL) && method === "DELETE")
      return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes(GOAL_URL)) return Promise.resolve(respondToDetail());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalDetails", () => {
  it("exposes the progress of the goal to assistive tech", async () => {
    renderDetails();

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "63");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  });

  it("explains what counts when the goal has no books yet", async () => {
    respondToDetail = () => jsonResponse(makeReadingGoalDetail({ countedBooks: [] }));

    renderDetails();

    expect(await screen.findByText("Ще жодної книги не зараховано")).toBeInTheDocument();
    expect(
      screen.getByText("У ціль зараховуються лише книги зі списку, дочитані після її створення."),
    ).toBeInTheDocument();
  });

  it("links every counted book to its own page", async () => {
    renderDetails();

    expect(await screen.findByRole("link", { name: /Бігуни/ })).toHaveAttribute(
      "href",
      "/books/book-1",
    );
  });

  it("shows the not-found state when the goal is gone", async () => {
    respondToDetail = () => jsonResponse({ message: "not found" }, 404);

    renderDetails();

    expect(await screen.findByText("Ціль не знайдено")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "До списків" })).toBeInTheDocument();
  });

  it("drops the editing actions for an archived goal", async () => {
    respondToDetail = () =>
      jsonResponse(makeReadingGoalDetail({ daysLeft: null, status: "archived" }));

    renderDetails();

    expect(await screen.findByText("Заархівована")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Редагувати ціль" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Архівувати" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
  });

  it("returns to the source list once the goal is deleted", async () => {
    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteCall()).toBeDefined());
    expect(pushMock).toHaveBeenCalledWith("/lists/list-1");
  });
});
