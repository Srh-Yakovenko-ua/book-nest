import "@testing-library/jest-dom/vitest";

import type {
  LoanDirectionSummary,
  LoanListItemView,
  LoansSummaryView,
  LoanType,
} from "@app/shared";
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
const attention = messages.loans.sidebar.attention;
const longHeld = messages.loans.sidebar.longHeld;
const people = messages.loans.sidebar.people;
const upcoming = messages.loans.sidebar.upcoming;
const requestedUrls: string[] = [];

const EMPTY_DIRECTION_SUMMARY: LoanDirectionSummary = {
  earliestLoanDate: null,
  longHeldCount: 0,
  longHeldLoans: [],
  nearestReturnDate: null,
  noReminderWithDateCount: 0,
  noReturnDateCount: 0,
  noReturnDatePeopleCount: 0,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  peopleCount: 0,
  returningSoonCount: 0,
  topPeople: [],
  totalCount: 0,
  upcomingReturns: [],
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
        ...EMPTY_DIRECTION_SUMMARY,
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
        ...EMPTY_DIRECTION_SUMMARY,
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
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    await findStatCard(stats.lent.total.label);
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.longHeld.label)).not.toBeInTheDocument();
  });

  it("names today and tomorrow instead of counting days to the nearest return", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
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
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
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
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    const noReturnDate = await findStatCard(stats.lent.noReturnDate.label);
    expect(within(noReturnDate).getByText(stats.lent.noReturnDate.empty)).toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is borrowed", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 } });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(copy.states.typeEmpty.borrowed.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.borrowed.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.borrowed.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("hides the stat cards and explains the page when nothing is lent out", async () => {
    mockLoans([], { borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 } });

    renderLoans("lent_to_someone");

    expect(await screen.findByText(copy.states.typeEmpty.lent.title)).toBeInTheDocument();
    expect(screen.getByText(copy.states.typeEmpty.lent.description)).toBeInTheDocument();
    expect(screen.queryByText(stats.lent.total.label)).not.toBeInTheDocument();
    expect(screen.queryByText(stats.overdue.label)).not.toBeInTheDocument();
  });

  it("lists what needs attention in the borrowed sidebar", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReturnDateCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-11),
        overdueCount: 2,
        totalCount: 8,
      },
    });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(attention.title)).toBeInTheDocument();

    const overdueRow = await screen.findByRole("button", { name: /2 книги прострочено/ });
    expect(within(overdueRow).getByText("Найдовше — на 11 днів")).toBeInTheDocument();

    const noReturnDateRow = screen.getByRole("button", { name: /3 книги без дати повернення/ });
    expect(
      within(noReturnDateRow).getByText(attention.borrowed.no_return_date.detail),
    ).toBeInTheDocument();
  });

  it("applies the existing loans filter when an attention row is clicked", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        oldestOverdueReturnDate: isoDaysFromToday(-3),
        overdueCount: 1,
        totalCount: 4,
      },
    });

    renderLoans("borrowed_from_someone");

    await userEvent.click(await screen.findByRole("button", { name: /1 книга прострочена/ }));

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes("filter=overdue"))).toBe(true);
    });
  });

  it("reassures the reader when no borrowed loan needs attention", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 2 },
    });

    renderLoans("borrowed_from_someone");

    expect(await screen.findByText(attention.allClear.title)).toBeInTheDocument();
    expect(screen.getByText(attention.borrowed.allClearText)).toBeInTheDocument();
  });

  it("lists what needs attention in the lent sidebar, most urgent first", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        noReminderWithDateCount: 5,
        noReturnDateCount: 4,
        noReturnDatePeopleCount: 3,
        oldestOverdueReturnDate: isoDaysFromToday(-12),
        overdueCount: 3,
        totalCount: 12,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(attention.title);
    const rows = within(block).getAllByRole("button");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("3 книги не повернули вчасно");
    expect(rows[0]).toHaveTextContent("Найдовше — на 12 днів");
    expect(rows[1]).toHaveTextContent("4 книги без дати повернення");
    expect(rows[1]).toHaveTextContent("У 3 різних людей");
    expect(rows[2]).toHaveTextContent("5 книг без нагадування");
    expect(rows[2]).toHaveTextContent("Для 5 вказано дату повернення");
  });

  it("applies the without reminder filter when its attention row is clicked", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, noReminderWithDateCount: 2, totalCount: 6 },
    });

    renderLoans("lent_to_someone");

    await userEvent.click(await screen.findByRole("button", { name: /2 книги без нагадування/ }));

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes("filter=without_reminder"))).toBe(true);
    });
  });

  it("keeps loans that are merely due soon out of the lent attention block", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        nearestReturnDate: isoDaysFromToday(1),
        returningSoonCount: 4,
        totalCount: 4,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(attention.title);
    expect(within(block).queryAllByRole("button")).toHaveLength(0);
    expect(within(block).getByText(attention.allClear.title)).toBeInTheDocument();
    expect(within(block).getByText(attention.lent.allClearText)).toBeInTheDocument();
  });

  it("builds the upcoming returns block from the summary, not from the visible page", async () => {
    mockLoans([loanItem("lent_to_someone", "Гобіт")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        totalCount: 9,
        upcomingReturns: [
          loanItem("lent_to_someone", "Дюна", {
            expectedReturnDate: isoDaysFromToday(0),
            personName: "Ігор",
          }),
          loanItem("lent_to_someone", "Соляріс", {
            expectedReturnDate: isoDaysFromToday(1),
            personName: "Марта",
          }),
          loanItem("lent_to_someone", "Кобзар", {
            expectedReturnDate: isoDaysFromToday(3),
            personName: "Тарас",
          }),
        ],
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(upcoming.title);
    expect(within(block).getByText("Дюна")).toBeInTheDocument();
    expect(within(block).getByText("Ігор")).toBeInTheDocument();
    expect(within(block).getByText(upcoming.today)).toBeInTheDocument();
    expect(within(block).getByText(upcoming.tomorrow)).toBeInTheDocument();
    expect(within(block).getByText("Через 3 дні")).toBeInTheDocument();
    expect(within(block).queryByText("Гобіт")).not.toBeInTheDocument();
  });

  it("says there is nothing scheduled when no return is upcoming", async () => {
    mockLoans([loanItem("lent_to_someone", "Гобіт")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, noReturnDateCount: 1, totalCount: 1 },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(upcoming.title);
    expect(within(block).getByText(upcoming.empty)).toBeInTheDocument();
  });

  it("lists the people holding the most books, with their book counts", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [
          { bookCount: 4, covers: [], personName: "Олена" },
          { bookCount: 2, covers: [], personName: "Петро" },
          { bookCount: 1, covers: [], personName: "Ірина" },
        ],
        totalCount: 7,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(people.title);
    const rows = within(block).getAllByRole("button");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Олена");
    expect(rows[0]).toHaveTextContent("4 книги");
    expect(rows[1]).toHaveTextContent("Петро");
    expect(rows[1]).toHaveTextContent("2 книги");
    expect(rows[2]).toHaveTextContent("Ірина");
    expect(rows[2]).toHaveTextContent("1 книга");
  });

  it("filters the list by a person when the row is clicked, and clears it on a second click", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: {
        ...EMPTY_DIRECTION_SUMMARY,
        topPeople: [{ bookCount: 3, covers: [], personName: "Олена" }],
        totalCount: 3,
      },
    });

    renderLoans("lent_to_someone");

    const block = await findSidebarBlock(people.title);
    const row = within(block).getByRole("button", { name: /Олена/ });

    await userEvent.click(row);
    await waitFor(() => {
      expect(
        requestedUrls.some((url) => url.includes(`person=${encodeURIComponent("Олена")}`)),
      ).toBe(true);
    });
    expect(row).toHaveAttribute("aria-pressed", "true");

    requestedUrls.length = 0;
    await userEvent.click(row);
    await waitFor(() => {
      expect(row).toHaveAttribute("aria-pressed", "false");
    });
    expect(requestedUrls.every((url) => !url.includes("person="))).toBe(true);
  });

  it("hides the people block when nobody is holding a book", async () => {
    mockLoans([loanItem("lent_to_someone", "Дюна")], {
      lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 0 },
    });

    renderLoans("lent_to_someone");

    await findSidebarBlock(upcoming.title);
    expect(within(sidebar()).queryByText(people.title)).not.toBeInTheDocument();
  });

  it("lists the long-held loans of the borrowed page, oldest first", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        longHeldCount: 2,
        longHeldLoans: [
          loanItem("borrowed_from_someone", "Дюна", {
            loanDate: isoDaysFromToday(-47),
            personName: "Ігор",
          }),
          loanItem("borrowed_from_someone", "Соляріс", {
            loanDate: isoDaysFromToday(-31),
            personName: "Марта",
          }),
        ],
        totalCount: 9,
      },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByText("Дюна")).toBeInTheDocument();
    expect(within(block).getByText("Ігор")).toBeInTheDocument();
    expect(within(block).getByText("47 днів у вас")).toBeInTheDocument();
    expect(within(block).getByText("31 день у вас")).toBeInTheDocument();
    expect(within(block).queryByText("Гобіт")).not.toBeInTheDocument();
  });

  it("opens the book behind a long-held loan", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: {
        ...EMPTY_DIRECTION_SUMMARY,
        longHeldCount: 1,
        longHeldLoans: [
          loanItem("borrowed_from_someone", "Дюна", { loanDate: isoDaysFromToday(-33) }),
        ],
        totalCount: 2,
      },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByRole("link", { name: /Дюна/ })).toHaveAttribute(
      "href",
      "/books/book-Дюна",
    );
  });

  it("says no book has been held long when none is", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    const block = await findSidebarBlock(longHeld.title);
    expect(within(block).getByText(longHeld.empty)).toBeInTheDocument();
  });

  it("keeps the upcoming returns and the call to action off the borrowed page", async () => {
    mockLoans([loanItem("borrowed_from_someone", "Гобіт")], {
      borrowed: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 1 },
    });

    renderLoans("borrowed_from_someone");

    await findSidebarBlock(longHeld.title);
    expect(within(sidebar()).queryByText(upcoming.title)).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText(copy.sidebar.cta.title)).not.toBeInTheDocument();
    expect(within(sidebar()).queryByText(people.title)).not.toBeInTheDocument();
  });

  it("sends the reader to the other page when this one has no loans", async () => {
    mockLoans([], { lent: { ...EMPTY_DIRECTION_SUMMARY, totalCount: 3 } });

    renderLoans("borrowed_from_someone");

    await userEvent.click(
      await screen.findByRole("button", { name: copy.states.typeEmpty.borrowed.openOther }),
    );

    expect(push).toHaveBeenCalledWith("/loans/lent");
  });
});

function countedStats(items: LoanListItemView[], type: LoanType): LoanDirectionSummary {
  return {
    ...EMPTY_DIRECTION_SUMMARY,
    totalCount: items.filter((item) => item.type === type).length,
  };
}

function findSidebarBlock(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const block = within(sidebar()).getByText(title).closest<HTMLElement>("section");
    if (block === null) throw new Error(`Sidebar block not found: ${title}`);
    if (block.querySelector('[data-slot="skeleton"]') !== null) {
      throw new Error(`Sidebar block is still loading: ${title}`);
    }
    return block;
  });
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

function loanItem(
  type: LoanType,
  title: string,
  overrides: Partial<LoanListItemView> = {},
): LoanListItemView {
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
    ...overrides,
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

function sidebar(): HTMLElement {
  return screen.getByRole("complementary", { name: copy.sidebar.label });
}
