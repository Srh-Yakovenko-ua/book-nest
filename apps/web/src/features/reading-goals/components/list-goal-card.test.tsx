import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeReadingGoalView } from "../model/reading-goals.fixtures";
import { ListGoalCard } from "./list-goal-card";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const LIST_ID = "list-1";
const GOAL_URL = `/api/lists/${LIST_ID}/goal`;

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

let respondToGoal: () => Response;
let respondToCreate: () => Response;

function calendarDay(day: string) {
  return within(screen.getByRole("grid")).getByText(day);
}

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(GOAL_URL) && (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

async function openCreateDialog(name = "Створити ціль") {
  await userEvent.click(await screen.findByRole("button", { name }));
  return screen.getByRole("dialog");
}

function renderCard(bookCount = 20) {
  return renderWithProviders(
    <ListGoalCard bookCount={bookCount} listId={LIST_ID} listName="Книги на осінь" />,
  );
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToGoal = noContentResponse;
  respondToCreate = () => jsonResponse(makeReadingGoalView(), 201);

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(GOAL_URL) && method === "POST") return Promise.resolve(respondToCreate());
    if (url.includes(GOAL_URL)) return Promise.resolve(respondToGoal());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ListGoalCard states", () => {
  it("invites you to start a goal when the list has none", async () => {
    renderCard();

    expect(await screen.findByRole("button", { name: "Створити ціль" })).toBeEnabled();
    expect(
      screen.getByText("Перетворіть цю тематичну добірку на читацький виклик."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Переглянути ціль" })).not.toBeInTheDocument();
  });

  it("shows the progress of an active goal and drops the create button", async () => {
    respondToGoal = () => jsonResponse(makeReadingGoalView());

    renderCard();

    expect(await screen.findByRole("link", { name: "Переглянути ціль" })).toHaveAttribute(
      "href",
      "/goals/goal-1",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "63");
    expect(screen.getByText("5 із 8 виконано")).toBeInTheDocument();
    expect(screen.getByText("Залишилося 3 книги")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Створити ціль" })).not.toBeInTheDocument();
  });

  it("celebrates a completed goal and offers the next one", async () => {
    respondToGoal = () =>
      jsonResponse(
        makeReadingGoalView({
          completedAt: "2026-11-12",
          completedCount: 8,
          daysLeft: null,
          remainingCount: 0,
          status: "completed",
        }),
      );

    renderCard();

    expect(await screen.findByText("Ціль виконана")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити нову ціль" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Переглянути ціль" })).toBeInTheDocument();
  });

  it("stays neutral about an expired goal and offers the next one", async () => {
    respondToGoal = () => jsonResponse(makeReadingGoalView({ daysLeft: -4, status: "expired" }));

    renderCard();

    expect(await screen.findByText("Дедлайн минув")).toBeInTheDocument();
    expect(screen.getByText("5 із 8 · прострочено на 4 дні")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Створити нову ціль" })).toBeInTheDocument();
  });

  it("treats an archived goal as no goal at all", async () => {
    respondToGoal = () => jsonResponse(makeReadingGoalView({ daysLeft: null, status: "archived" }));

    renderCard();

    expect(await screen.findByRole("button", { name: "Створити ціль" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Переглянути ціль" })).not.toBeInTheDocument();
  });

  it("asks for books before it lets you set a goal", async () => {
    renderCard(0);

    const create = await screen.findByRole("button", { name: "Створити ціль" });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription("Спочатку додайте книги до списку");
  });
});

describe("ListGoalCard creation", () => {
  it("suggests a reachable target instead of the whole list", async () => {
    renderCard();

    const dialog = await openCreateDialog();

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveValue(5);
  });

  it("keeps the submit locked until a deadline is chosen", async () => {
    renderCard();

    const dialog = await openCreateDialog();

    expect(within(dialog).getByRole("button", { name: "Створити ціль" })).toBeDisabled();
    expect(createCall()).toBeUndefined();
  });

  it("sends no name at all when the field is left empty", async () => {
    renderCard();

    const dialog = await openCreateDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "До дати" }));
    await userEvent.click(calendarDay("20"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Створити ціль" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(String(createCall()?.[1].body))).toEqual({
      deadline: "2026-08-20",
      targetCount: 5,
    });
    expect(toast.success).toHaveBeenCalledWith("Ціль створено");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the modal open and names the conflict when a goal already exists", async () => {
    respondToCreate = () => jsonResponse({ message: "active goal exists" }, 409);

    renderCard();

    const dialog = await openCreateDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "До дати" }));
    await userEvent.click(calendarDay("20"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Створити ціль" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Для цього списку вже є активна ціль"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
