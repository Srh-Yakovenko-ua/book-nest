import "@testing-library/jest-dom/vitest";

import type { LoanListItemView, LoansSummaryView, LoanType } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { LoansView } from "./loans-view";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const copy = messages.loans;
const requestedUrls: string[] = [];

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

  it("sends the reader to the other page when this one has no loans", async () => {
    mockLoans([], { borrowedCount: 0, lentCount: 3 });

    renderLoans("borrowed_from_someone");

    await userEvent.click(
      await screen.findByRole("button", { name: copy.states.typeEmpty.borrowed.openOther }),
    );

    expect(push).toHaveBeenCalledWith("/loans/lent");
  });
});

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

function mockLoans(items: LoanListItemView[], summaryCounts?: Partial<LoansSummaryView>) {
  const summary: LoansSummaryView = {
    borrowedCount: items.length,
    lentCount: 0,
    overdueCount: 0,
    returnThisWeek: 0,
    withoutReturnDate: 0,
    withReminder: 0,
    ...summaryCounts,
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
