import type { HomeAttentionGroup, HomeAttentionView } from "@app/shared";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { homeAttentionCardState } from "../model/home-attention";
import { HomeAttentionCenter } from "./home-attention-center";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const attention = messages.home.attention;
const GOAL_ID = "dddddddd-0000-4000-8000-000000000001";
const BOOK_ID = "dddddddd-0000-4000-8000-000000000002";
const SERIES_ID = "dddddddd-0000-4000-8000-000000000003";

const pickupGroup: HomeAttentionGroup = {
  count: 2,
  dueDate: "2026-11-27",
  id: "delivery_ready_for_pickup",
  reason: "delivery_ready_for_pickup",
  severity: "high",
  unit: "parcels",
};

const overdueLoanGroup: HomeAttentionGroup = {
  count: 1,
  direction: "lent_to_someone",
  dueDate: "2026-11-20",
  id: "loan_overdue:lent_to_someone",
  reason: "loan_overdue",
  severity: "high",
  unit: "books",
};

const goalGroup: HomeAttentionGroup = {
  count: 1,
  dueDate: "2026-12-31",
  goalId: GOAL_ID,
  goalName: "Зимове читання",
  id: `goal_at_risk:${GOAL_ID}`,
  isPrimary: true,
  listName: null,
  reason: "goal_at_risk",
  riskReason: "behind_schedule",
  severity: "medium",
  unit: "goals",
};

const staleReadingGroup: HomeAttentionGroup = {
  bookId: BOOK_ID,
  bookTitle: "Мор",
  count: 1,
  dueDate: null,
  id: "reading_stale",
  reason: "reading_stale",
  severity: "low",
  unit: "books",
};

const seriesGroup: HomeAttentionGroup = {
  count: 1,
  dueDate: null,
  id: "series_order_issue",
  reason: "series_order_issue",
  seriesId: SERIES_ID,
  seriesTitle: "Дискосвіт",
  severity: "low",
  unit: "issues",
};

const criticalPickupGroup: HomeAttentionGroup = {
  count: 1,
  dueDate: "2026-11-25",
  expiredCount: 0,
  id: "delivery_pickup_expiring",
  reason: "delivery_pickup_expiring",
  severity: "critical",
  unit: "parcels",
};

const FIVE_GROUPS = [pickupGroup, overdueLoanGroup, goalGroup, staleReadingGroup, seriesGroup];

function showAttention(view: HomeAttentionView, onRetry = vi.fn()) {
  const state = homeAttentionCardState({ data: view, isError: false });
  if (state.kind === "hidden") throw new Error("the attention card is hidden for this view");
  return renderWithProviders(
    <HomeAttentionCenter isRetrying={false} onRetry={onRetry} state={state} />,
  );
}

describe("HomeAttentionCenter rows", () => {
  it("links a delivery row to the matching in-transit filter", () => {
    showAttention({ groups: [pickupGroup], unavailableSources: [] });

    expect(screen.getByRole("link", { name: /Можна забирати: 2 посилки/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?filter=ready_for_pickup",
    );
  });

  it("links a loan row to the overdue loans of its direction", () => {
    showAttention({ groups: [overdueLoanGroup], unavailableSources: [] });

    expect(
      screen.getByRole("link", { name: /Видані комусь, термін минув: 1 книга/ }),
    ).toHaveAttribute("href", "/loans/lent?filter=overdue");
  });

  it("links a goal row to the goal page", () => {
    showAttention({ groups: [goalGroup], unavailableSources: [] });

    expect(screen.getByRole("link", { name: /Ціль під загрозою: Зимове читання/ })).toHaveAttribute(
      "href",
      `/goals/${GOAL_ID}`,
    );
  });

  it("names the severity in words, not only by color", () => {
    showAttention({ groups: [pickupGroup, goalGroup], unavailableSources: [] });

    expect(
      screen.getByRole("link", { name: /^Високий: Можна забирати: 2 посилки/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Середній: Ціль під загрозою: Зимове читання/ }),
    ).toBeInTheDocument();
  });
});

describe("HomeAttentionCenter overflow", () => {
  it("shows three rows and a more control for the remaining two", () => {
    showAttention({ groups: FIVE_GROUPS, unavailableSources: [] });

    const card = screen.getByRole("region", { name: attention.title });
    expect(within(card).getAllByRole("link")).toHaveLength(3);
    expect(within(card).getByRole("button", { name: "Ще 2" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Мор/ })).not.toBeInTheDocument();
  });

  it("opens a dialog with the remaining groups", async () => {
    showAttention({ groups: FIVE_GROUPS, unavailableSources: [] });

    await userEvent.click(screen.getByRole("button", { name: "Ще 2" }));

    const dialog = await screen.findByRole("dialog", { name: attention.moreTitle });
    expect(within(dialog).getByText("Ще 2 пункти потребують уваги")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("link")).toHaveLength(2);
    expect(within(dialog).getByRole("link", { name: /Давно без прогресу: «Мор»/ })).toHaveAttribute(
      "href",
      `/books/${BOOK_ID}`,
    );
    expect(
      within(dialog).getByRole("link", { name: /Перевір порядок читання в «Дискосвіт»/ }),
    ).toHaveAttribute("href", `/series/${SERIES_ID}`);
  });

  it("has no more control with three groups or fewer", () => {
    showAttention({ groups: [pickupGroup, overdueLoanGroup, goalGroup], unavailableSources: [] });

    expect(screen.queryByRole("button", { name: /^Ще/ })).not.toBeInTheDocument();
  });
});

describe("HomeAttentionCenter critical group", () => {
  it("leaves the critical group out of the list", () => {
    showAttention({ groups: [criticalPickupGroup, pickupGroup], unavailableSources: [] });

    const card = screen.getByRole("region", { name: attention.title });
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    expect(
      within(card).queryByRole("link", { name: /Скоро завершиться зберігання/ }),
    ).not.toBeInTheDocument();
  });
});

describe("HomeAttentionCenter completeness", () => {
  it("warns that the list may be incomplete and offers a retry", async () => {
    const onRetry = vi.fn();
    showAttention({ groups: [pickupGroup], unavailableSources: ["loans"] }, onRetry);

    expect(screen.getByRole("status")).toHaveTextContent(attention.incomplete);
    await userEvent.click(screen.getByRole("button", { name: attention.error.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("warns about an incomplete check even when no group came back", () => {
    showAttention({ groups: [], unavailableSources: ["deliveries"] });

    expect(screen.getByRole("status")).toHaveTextContent(attention.incomplete);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows no incomplete warning when every source answered", () => {
    showAttention({ groups: [pickupGroup], unavailableSources: [] });

    expect(screen.queryByText(attention.incomplete)).not.toBeInTheDocument();
  });
});
