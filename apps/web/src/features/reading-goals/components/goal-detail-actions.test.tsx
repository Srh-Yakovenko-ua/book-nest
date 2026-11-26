import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeReadingGoalDetail, makeReadingGoalView } from "../model/reading-goals.fixtures";
import { GoalDetailActions } from "./goal-detail-actions";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const detail = messages.goals.detail;
const GOAL_PATH = "/api/goals/goal-1";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function changeRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      method: (init?.method ?? "GET").toUpperCase(),
      path: new URL(String(input), "http://localhost").pathname,
    }))
    .filter(({ method }) => method !== "GET")
    .map(({ method, path }) => `${method} ${path}`);
}

async function openMoreActions() {
  await userEvent.click(screen.getByRole("button", { name: detail.moreActions }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    if (path === `${GOAL_PATH}/archive` && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify(makeReadingGoalView({ status: "archived" })), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    if (path === GOAL_PATH && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${path}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalDetailActions more-actions menu", () => {
  it("names its trigger and offers archiving and deletion of an active goal", async () => {
    renderWithProviders(<GoalDetailActions goal={makeReadingGoalDetail()} />);

    const menu = await openMoreActions();

    expect(within(menu).getByRole("menuitem", { name: detail.archive })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: detail.delete })).toBeInTheDocument();
  });

  it("archives from the menu only once the confirmation is accepted", async () => {
    renderWithProviders(<GoalDetailActions goal={makeReadingGoalDetail()} />);

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: detail.archive }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: detail.archiveDialog.title,
    });

    expect(confirmation).toHaveAccessibleDescription(detail.archiveDialog.description);
    expect(changeRequests()).toEqual([]);

    await userEvent.click(
      within(confirmation).getByRole("button", { name: detail.archiveDialog.confirm }),
    );

    await waitFor(() => expect(changeRequests()).toEqual([`POST ${GOAL_PATH}/archive`]));
  });

  it("deletes from the menu only once the confirmation is accepted", async () => {
    renderWithProviders(<GoalDetailActions goal={makeReadingGoalDetail()} />);

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: detail.delete }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: detail.deleteDialog.title,
    });

    expect(changeRequests()).toEqual([]);

    await userEvent.click(
      within(confirmation).getByRole("button", { name: detail.deleteDialog.confirm }),
    );

    await waitFor(() => expect(changeRequests()).toEqual([`DELETE ${GOAL_PATH}`]));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
  });

  it("returns focus to the menu trigger when a confirmation opened from it is cancelled", async () => {
    renderWithProviders(<GoalDetailActions goal={makeReadingGoalDetail()} />);

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: detail.delete }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: detail.deleteDialog.title,
    });
    await userEvent.click(
      within(confirmation).getByRole("button", { name: detail.deleteDialog.cancel }),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: detail.moreActions })).toHaveFocus(),
    );
    expect(changeRequests()).toEqual([]);
  });

  it("leaves an archived goal only deletion, with no edit or archive", async () => {
    renderWithProviders(
      <GoalDetailActions
        goal={makeReadingGoalDetail({ daysLeft: null, pace: null, status: "archived" })}
      />,
    );

    expect(screen.queryByRole("button", { name: detail.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: detail.archive })).not.toBeInTheDocument();

    const menu = await openMoreActions();

    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(within(menu).getByRole("menuitem", { name: detail.delete })).toBeInTheDocument();
  });
});
