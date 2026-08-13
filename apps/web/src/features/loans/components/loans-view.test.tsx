import "@testing-library/jest-dom/vitest";

import type { LoanDirectionStats, LoanListItemView, LoansSummaryView, LoanType } from "@app/shared";
import type { ReactNode } from "react";

import { addDays, format } from "date-fns";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { LoansView } from "./loans-view";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const copy = messages.loans;
const stats = messages.loans.stats;
const requestedUrls: string[] = [];

const EMPTY_DIRECTION_STATS: LoanDirectionStats = {
  earliestLoanDate: null,
  longHeldCount: 0,
  nearestReturnDate: null,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  totalCount: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
  requestedUrls.length = 0;
  push.mockClear();
});

describe("LoansView", () => {
  it("asks the API only for borrowed loans and renders the borrowed page", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    expect(
      await screen.findByRole("heading", { level: 1, name: copy.pages.borrowed.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Гобіт")).toBeInTheDocument();
    expect(listUrl()).toContain("type=borrowed_from_someone");
    expect(listUrl()).not.toContain("lent_to_someone");
  });

  it("asks the API only for lent loans and renders the lent page", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")]);

    renderLoans("lent_to_someone");

    expect(
      await screen.findByRole("heading", { level: 1, name: copy.pages.lent.title }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(listUrl()).toContain("type=lent_to_someone");
  });

  it("renders no tab switcher", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone");

    await screen.findByText("Гобіт");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("keeps search and filters from the URL in the request", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")]);

    renderLoans("borrowed_from_someone", "?q=hobbit&filter=overdue&sort=title&page=2");

    await screen.findByText("Гобіт");
    expect(listUrl()).toContain("search=hobbit");
    expect(listUrl()).toContain("filter=overdue");
    expect(listUrl()).toContain("sort=title");
    expect(listUrl()).toContain("pageNumber=2");
  });

  it("builds the borrowed stat cards from the summary", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_STATS,
        earliestLoanDate: isoDaysFromToday(-47),
        longHeldCount: 2,
        nearestReturnDate: isoDaysFromToday(2),
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 3,
        peopleCount: 5,
        returningSoonCount: 4,
        totalCount: 8,
      },
    });

    renderLoans("borrowed_from_someone");

    const total = await findStatCard(stats.borrowed.total.label);
    expect(within(total).getByText("8")).toBeInTheDocument();
    expect(within(total).getByText("книг")).toBeInTheDocument();
    expect(within(total).getByText("Від 5 різних людей")).toBeInTheDocument();

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(within(returningSoon).getByText("4")).toBeInTheDocument();
    expect(within(returningSoon).getByText("Найближче — через 2 дні")).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText("3")).toBeInTheDocument();
    expect(within(overdue).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const longHeld = await findStatCard(stats.borrowed.longHeld.label);
    expect(within(longHeld).getByText("2")).toBeInTheDocument();
    expect(within(longHeld).getByText("Найдовше — 47 днів")).toBeInTheDocument();
  });

  it("builds the lent stat cards from the summary", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_STATS,
        nearestReturnDate: isoDaysFromToday(2),
        noReturnDateCount: 4,
        noReturnDatePeopleCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 3,
        peopleCount: 5,
        returningSoonCount: 4,
        totalCount: 8,
      },
    });

    renderLoans("lent_to_someone");

    const total = await findStatCard(stats.lent.total.label);
    expect(within(total).getByText("8")).toBeInTheDocument();
    expect(within(total).getByText("книг")).toBeInTheDocument();
    expect(within(total).getByText("У 5 різних людей")).toBeInTheDocument();

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(within(returningSoon).getByText("4")).toBeInTheDocument();
    expect(within(returningSoon).getByText("Найближче — через 2 дні")).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText("3")).toBeInTheDocument();
    expect(within(overdue).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const noReturnDate = await findStatCard(stats.lent.noReturnDate.label);
    expect(within(noReturnDate).getByText("4")).toBeInTheDocument();
    expect(within(noReturnDate).getByText("У 3 різних людей")).toBeInTheDocument();
  });

  it("keeps the borrowed-only cards off the lent page", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_STATS, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    await findStatCard(stats.lent.total.label);
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.longHeld.label)).not.toBeInTheDocument();
  });

  it("names today and tomorrow instead of counting days to the nearest return", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_STATS,
        nearestReturnDate: isoDaysFromToday(1),
        returningSoonCount: 1,
        totalCount: 1,
      },
    });

    renderLoans("borrowed_from_someone");

    const card = await findStatCard(stats.returningSoon.label);
    expect(within(card).getByText(stats.returningSoon.tomorrow)).toBeInTheDocument();
  });

  it("falls back to the calm wording when a borrowed stat is empty", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_STATS, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    const returningSoon = await findStatCard(stats.returningSoon.label);
    expect(
      within(returningSoon).getByText("Немає повернень у найближчі 7 днів"),
    ).toBeInTheDocument();

    const overdue = await findStatCard(stats.overdue.label);
    expect(within(overdue).getByText(stats.overdue.empty)).toBeInTheDocument();

    const longHeld = await findStatCard(stats.borrowed.longHeld.label);
    expect(
      within(longHeld).getByText("Немає книг, позичених 30 днів і більше"),
    ).toBeInTheDocument();
  });

  it("falls back to the calm wording when every lent loan has a return date", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_STATS, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    const noReturnDate = await findStatCard(stats.lent.noReturnDate.label);
    expect(within(noReturnDate).getByText(stats.lent.noReturnDate.empty)).toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is borrowed", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_STATS, totalCount: 2 } });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(copy.states.typeEmpty.borrowed.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.borrowed.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is lent out", async () => {
    mockLoans([], { borrowed: { ...EMPTY_DIRECTION_STATS, totalCount: 2 } });

    renderLoans("lent_to_someone");

    expect(await screen.findByText(copy.states.typeEmpty.lent.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.lent.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.lent.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("sends the reader to the other page when this one has no loans", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_STATS, totalCount: 3 } });

    renderLoans("borrowed_from_someone");

    await userEvent.click(
      await screen.findByRole("button", { name: copy.states.typeEmpty.borrowed.openOther }),
    );

    expect(push).toHaveBeenCalledWith("/loans/lent");
  });
});

function countedStats(items: LoanListItemView[], type: LoanType): LoanDirectionStats {
  return {
    ...EMPTY_DIRECTION_STATS,
    totalCount: items.filter((item) => item.type === type).length,
  };
}

function findStatCard(label: string): Promise<HTMLElement> {
  return waitFor(() => {
    const card = screen
      .getAllByText(label)
      .map((node) => node.closest<HTMLElement>('[data-slot="stat-card"]'))
      .find((node) => node !== null);
    if (card === undefined) throw new Error(`Stat card not found: ${label}`);
    return card;
  });
}

function isoDaysFromToday(offset: number): string {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function listUrl(): string {
  const found = requestedUrls.find((url) => !url.includes("/api/loans/summary"));
  if (found === undefined) throw new Error("the loans list was never requested");
  return found;
}

function loanItem(type: LoanType, title: string): LoanListItemView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Дж. Р. Р. Толкін",
      id: `book-${title}`,
      originalTitle: null,
      ownershipStatus: "owned",
      publisher: null,
      title,
    },
    contact: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    expectedReturnDate: "2026-02-01",
    id: `loan-${title}`,
    loanDate: "2026-01-05",
    loanUiStatus: "on_time",
    note: null,
    personName: "Оля",
    remindToReturn: false,
    type,
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

function mockLoans(items: LoanListItemView[], summaryOverrides?: Partial<LoansSummaryView>) {
  const summary: LoansSummaryView = {
    borrowed: countedStats(items, "borrowed_from_someone"),
    lent: countedStats(items, "lent_to_someone"),
    ...summaryOverrides,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/api/loans/summary")) return Promise.resolve(jsonResponse(summary));
      if (url.includes("/api/loans")) {
        return Promise.resolve(
          jsonResponse({
            items,
            page: 1,
            pagesCount: items.length === 0 ? 0 : 1,
            pageSize: 10,
            totalCount: items.length,
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function renderLoans(type: LoanType, searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={searchParams}>
      <LoansView type={type} />
    </NuqsTestingAdapter>,
  );
}
