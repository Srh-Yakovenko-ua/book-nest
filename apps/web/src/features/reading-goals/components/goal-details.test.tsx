import "@testing-library/jest-dom/vitest";

import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeReadingGoalActivity,
  makeReadingGoalCheckpoint,
  makeReadingGoalDetail,
} from "../model/reading-goals.fixtures";
import { GoalDetails } from "./goal-details";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const GOAL_ID = "goal-1";
const GOAL_URL = `/api/goals/${GOAL_ID}`;

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
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

function renderDetails(searchParams = "", events: UrlUpdateEvent[] = []) {
  return renderWithProviders(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={(event) => events.push(event)}
      searchParams={searchParams}
    >
      <GoalDetails id={GOAL_ID} />
    </NuqsTestingAdapter>,
  );
}

function respondWith(overrides: Parameters<typeof makeReadingGoalDetail>[0]) {
  respondToDetail = () => jsonResponse(makeReadingGoalDetail(overrides));
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
    if (url.includes(`${GOAL_URL}/books`) || url.includes(`${GOAL_URL}/activity`))
      return Promise.resolve(jsonResponse({ items: [], nextCursor: null }));
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
  it("exposes the server progress of the goal to assistive tech", async () => {
    renderDetails();

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "63");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  });

  it("keeps the server percent when more books are counted than the target", async () => {
    respondWith({ completedCount: 9, progressPercent: 100, remainingCount: 0, targetCount: 8 });

    renderDetails();

    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("9 із 8 книг")).toBeInTheDocument();
  });

  it("caps the edited target at the books fixed in the goal, not the current list", async () => {
    respondWith({ listBookCount: 20, snapshotBookCount: 8 });

    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "Редагувати ціль" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveAttribute("max", "8");
    expect(within(dialog).getByText("У цілі 8 книг")).toBeInTheDocument();
  });

  it("goes back to the source list while it exists", async () => {
    renderDetails();

    expect(await screen.findByRole("link", { name: "До списку «Книги на осінь»" })).toHaveAttribute(
      "href",
      "/lists/list-1",
    );
  });

  it("falls back to the goals catalog when the source list is gone", async () => {
    respondWith({ list: null });

    renderDetails();

    expect(await screen.findByRole("link", { name: "До цілей" })).toHaveAttribute("href", "/goals");
  });

  it("sends the not-found state back to the goals catalog", async () => {
    respondToDetail = () => jsonResponse({ message: "not found" }, 404);

    renderDetails();

    expect(await screen.findByText("Ціль не знайдено")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторити" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "До цілей" }));
    expect(pushMock).toHaveBeenCalledWith("/goals");
  });

  it("lets the reader retry a goal that failed to load", async () => {
    respondToDetail = () => jsonResponse({ message: "boom" }, 500);

    renderDetails();

    expect(await screen.findByText("Не вдалося завантажити ціль")).toBeInTheDocument();

    respondToDetail = () => jsonResponse(makeReadingGoalDetail());
    await userEvent.click(screen.getByRole("button", { name: "Повторити" }));

    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
  });

  it("returns focus to the archive button when the confirmation is cancelled", async () => {
    renderDetails();

    const archive = await screen.findByRole("button", { name: "Архівувати" });
    await userEvent.click(archive);
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(archive).toHaveFocus());
  });

  it("keeps an archived goal read-only and shows that it has no result", async () => {
    respondWith({
      daysLeft: null,
      pace: null,
      projectionConfidence: "none",
      result: null,
      status: "archived",
    });

    renderDetails();

    expect(await screen.findByText("Заархівована")).toBeInTheDocument();
    expect(screen.getByText("Без результату")).toBeInTheDocument();
    expect(screen.queryByText("Прострочена")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Редагувати ціль" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Архівувати" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
  });

  it("confirms the deletion and then replaces the page with the goals catalog", async () => {
    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");

    expect(deleteCall()).toBeUndefined();

    await userEvent.click(within(confirmation).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteCall()).toBeDefined());
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("drops the book scope from the URL when leaving the books tab", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("?tab=books&scope=counted", events);

    await userEvent.click(await screen.findByRole("tab", { name: "Історія" }));

    await waitFor(() => expect(events).not.toHaveLength(0));
    const lastUpdate = events.at(-1);
    expect(lastUpdate?.searchParams.get("tab")).toBe("activity");
    expect(lastUpdate?.searchParams.has("scope")).toBe(false);
    expect(lastUpdate?.options.history).toBe("push");
  });

  it("clears the tab and the activity filter when returning to the overview", async () => {
    const events: UrlUpdateEvent[] = [];
    renderDetails("?tab=activity&activityType=book_counted", events);

    await userEvent.click(await screen.findByRole("tab", { name: "Огляд" }));

    await waitFor(() => expect(events).not.toHaveLength(0));
    expect(events.at(-1)?.searchParams.toString()).toBe("");
    expect(screen.getByRole("tab", { name: "Огляд" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the activity tab from the recent events preview", async () => {
    const events: UrlUpdateEvent[] = [];
    respondWith({ activityPreview: [makeReadingGoalActivity()] });

    renderDetails("", events);

    await userEvent.click(await screen.findByRole("button", { name: "Уся історія" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("tab")).toBe("activity"));
  });

  it("names a forecast date only when the server is confident about it", async () => {
    respondWith({ projectedCompletionDate: "2026-11-25", projectionConfidence: "medium" });

    renderDetails();

    expect(await screen.findByText(/виконано 25 листопада 2026/)).toBeInTheDocument();
    expect(screen.getByText("Середня точність прогнозу")).toBeInTheDocument();
  });

  it("does not state an exact date for a low-confidence forecast", async () => {
    respondWith({ projectedCompletionDate: "2026-11-25", projectionConfidence: "low" });

    renderDetails();

    expect(
      await screen.findByText(
        "Прогноз поки приблизний: книг зараховано ще замало, щоб назвати дату.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/25 листопада 2026/)).not.toBeInTheDocument();
  });

  it("keeps both the miss and the late achievement of a checkpoint", async () => {
    respondWith({
      checkpoints: [
        makeReadingGoalCheckpoint({
          achievedAt: "2026-10-20",
          dueDate: "2026-10-15",
          status: "missed",
        }),
      ],
    });

    renderDetails();

    expect(await screen.findByText("Пропущено")).toBeInTheDocument();
    expect(screen.getByText(/досягнуто пізніше, 20 жовтня 2026/)).toBeInTheDocument();
  });

  it("names every risk reason the server reports", async () => {
    respondWith({ riskLevel: "high", riskReasons: ["behind_schedule", "no_recent_progress"] });

    renderDetails();

    expect(await screen.findByText("Високий ризик")).toBeInTheDocument();
    expect(screen.getByText("Прогрес відстає від запланованого графіка")).toBeInTheDocument();
    expect(screen.getByText("Давно не було нових зарахованих книг")).toBeInTheDocument();
  });
});
