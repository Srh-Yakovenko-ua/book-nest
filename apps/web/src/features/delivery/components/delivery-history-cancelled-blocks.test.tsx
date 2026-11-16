import "@testing-library/jest-dom/vitest";

import type { CancelledFollowUpBook, CancelledFollowUpView, CancelledPlanBook } from "@app/shared";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { DeliveryHistoryCancelledBlocks } from "./delivery-history-sidebar";

const retryMock = vi.fn();

const paths = {
  profileSettings: "/api/profile/settings",
  returnAllToWishlist: "/api/delivery/books/history/cancelled-follow-up/want-to-buy",
  wantToBuy: "/api/books/book-1/ownership/want-to-buy",
};

const wishlistResponses = new Map<string, unknown>([
  [paths.returnAllToWishlist, { updatedCount: 2 }],
  [paths.wantToBuy, makeBookView({ id: "book-1", ownershipStatus: "want_to_buy" })],
]);

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

function makePlanBook(overrides: Partial<CancelledPlanBook> = {}): CancelledPlanBook {
  return {
    authorName: "Frank Herbert",
    contexts: [{ kind: "queue" }],
    cover: null,
    id: "plan-1",
    title: "Поклик з могили",
    ...overrides,
  };
}

function makeUnresolvedBook(overrides: Partial<CancelledFollowUpBook> = {}): CancelledFollowUpBook {
  return {
    authorName: "Frank Herbert",
    cancelledAt: "2026-08-10T10:00:00.000Z",
    cancelReason: null,
    cover: null,
    id: "book-1",
    title: "Поклик з могили",
    ...overrides,
  };
}

function renderBlocks(followUp: Partial<CancelledFollowUpView>) {
  return renderWithProviders(
    <DeliveryHistoryCancelledBlocks
      followUp={{ outcomes: null, plans: null, unresolved: null, ...followUp }}
      isError={false}
      isLoading={false}
      onRetry={retryMock}
    />,
  );
}

function renderFailedBlocks() {
  return renderWithProviders(
    <DeliveryHistoryCancelledBlocks
      followUp={null}
      isError
      isLoading={false}
      onRetry={retryMock}
    />,
  );
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let profileTimeZone: string = defaultUserProfileSettings.timezone;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function parseJsonBody(body: RequestInit["body"]): unknown {
  return typeof body === "string" ? JSON.parse(body) : body;
}

function requestPath(input: RequestInfo | URL): string {
  return new URL(String(input), "http://localhost").pathname;
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = requestPath(input);
  if (init?.method === "GET" && path === paths.profileSettings) {
    return Promise.resolve(
      jsonResponse({ ...defaultUserProfileSettings, timezone: profileTimeZone }),
    );
  }
  if (init?.method === "POST" && wishlistResponses.has(path)) {
    return Promise.resolve(jsonResponse(wishlistResponses.get(path)));
  }
  return Promise.reject(new Error(`unexpected fetch ${init?.method} ${String(input)}`));
}

function sentMutations() {
  return fetchMock.mock.calls
    .filter(([input]) => requestPath(input) !== paths.profileSettings)
    .map(([input, init]) => ({
      body: parseJsonBody(init?.body),
      method: init?.method,
      path: requestPath(input),
    }));
}

beforeEach(() => {
  retryMock.mockReset();
  profileTimeZone = defaultUserProfileSettings.timezone;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeOutcomes(
  overrides: Partial<NonNullable<CancelledFollowUpView["outcomes"]>> = {},
): NonNullable<CancelledFollowUpView["outcomes"]> {
  return {
    borrowed: 0,
    inLibrary: 0,
    reordered: 0,
    totalBooksCount: 0,
    unresolved: 0,
    wishlist: 0,
    ...overrides,
  };
}

describe("where the cancelled books ended up", () => {
  it("stays out entirely until a book has been cancelled", () => {
    renderBlocks({ outcomes: null });

    expect(screen.queryByText("Що сталося далі")).not.toBeInTheDocument();
  });

  it("heads the block with the distinct books that carry a cancellation", () => {
    renderBlocks({
      outcomes: makeOutcomes({ inLibrary: 5, totalBooksCount: 7, wishlist: 2 }),
    });

    expect(screen.getByText("Що сталося далі")).toBeInTheDocument();
    expect(screen.getByText("7 книг зі скасуванням")).toBeInTheDocument();
  });

  it("names every outcome that has books behind it", () => {
    renderBlocks({
      outcomes: makeOutcomes({
        borrowed: 4,
        inLibrary: 3,
        reordered: 1,
        totalBooksCount: 11,
        unresolved: 1,
        wishlist: 2,
      }),
    });

    expect(screen.getByText("3 уже у бібліотеці")).toBeInTheDocument();
    expect(screen.getByText("1 замовлена повторно")).toBeInTheDocument();
    expect(screen.getByText("2 повернуті у список бажань")).toBeInTheDocument();
    expect(screen.getByText("4 позичені в когось")).toBeInTheDocument();
    expect(screen.getByText("1 без наступного кроку")).toBeInTheDocument();
  });

  it("leaves out an outcome that no book landed in", () => {
    renderBlocks({
      outcomes: makeOutcomes({ inLibrary: 5, totalBooksCount: 7, wishlist: 2 }),
    });

    expect(screen.getByText("5 уже у бібліотеці")).toBeInTheDocument();
    expect(screen.getByText("2 повернуті у список бажань")).toBeInTheDocument();
    expect(screen.queryByText(/замовлена повторно|замовлених повторно/)).not.toBeInTheDocument();
    expect(screen.queryByText(/без наступного кроку/)).not.toBeInTheDocument();
    expect(screen.queryByText(/позичен/)).not.toBeInTheDocument();
  });

  it("carries no actions, so the decision block stays the only place to act", () => {
    renderBlocks({ outcomes: makeOutcomes({ totalBooksCount: 3, unresolved: 3 }) });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("stands on its own when nothing needs a decision any more", () => {
    renderBlocks({
      outcomes: makeOutcomes({ inLibrary: 5, totalBooksCount: 7, wishlist: 2 }),
      plans: null,
      unresolved: null,
    });

    expect(screen.getByText("Що сталося далі")).toBeInTheDocument();
    expect(screen.queryByText("Потребують рішення")).not.toBeInTheDocument();
    expect(screen.queryByText("Впливають на плани")).not.toBeInTheDocument();
  });

  it("comes before the blocks a reader can act on", () => {
    renderBlocks({
      outcomes: makeOutcomes({ totalBooksCount: 1, unresolved: 1 }),
      plans: { books: [makePlanBook()], booksCount: 1 },
      unresolved: { books: [makeUnresolvedBook()], booksCount: 1 },
    });

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Що сталося далі", "Потребують рішення", "Впливають на плани"]);
  });
});

describe("a follow-up request that failed", () => {
  it("says the follow-up could not be loaded instead of leaving the column silent", () => {
    renderFailedBlocks();

    expect(screen.getByText("Скасовані книги")).toBeInTheDocument();
    expect(
      screen.getByText("Не вдалося дізнатись, які скасовані книги ще чекають на рішення."),
    ).toBeInTheDocument();
  });

  it("retries the request from the block", async () => {
    renderFailedBlocks();

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(retryMock).toHaveBeenCalledOnce();
  });

  it("keeps the decision, plan and outcome blocks out while the request is failed", () => {
    renderFailedBlocks();

    expect(screen.queryByText("Що сталося далі")).not.toBeInTheDocument();
    expect(screen.queryByText("Потребують рішення")).not.toBeInTheDocument();
    expect(screen.queryByText("Впливають на плани")).not.toBeInTheDocument();
  });
});

describe("books that need a decision", () => {
  it("stays out entirely while every cancelled book moved on", () => {
    renderBlocks({ plans: null, unresolved: null });

    expect(screen.queryByText("Потребують рішення")).not.toBeInTheDocument();
  });

  it("counts the undecided books and dates each preview", () => {
    renderBlocks({
      plans: null,
      unresolved: { books: [makeUnresolvedBook()], booksCount: 5 },
    });

    expect(screen.getByText("Потребують рішення")).toBeInTheDocument();
    expect(screen.getByText("5 книг")).toBeInTheDocument();
    expect(
      screen.getByText("після скасування залишились без наступного кроку"),
    ).toBeInTheDocument();
    expect(screen.getByText("Скасовано 10 серп. 2026 р.")).toBeInTheDocument();
  });

  it("dates each preview by the profile settings zone, not the Kyiv fallback", async () => {
    profileTimeZone = "America/New_York";
    renderBlocks({
      plans: null,
      unresolved: {
        books: [makeUnresolvedBook({ cancelledAt: "2026-08-10T03:00:00.000Z" })],
        booksCount: 1,
      },
    });

    expect(await screen.findByText("Скасовано 9 серп. 2026 р.")).toBeInTheDocument();
  });

  it("keeps the cancellation reason next to the date", () => {
    renderBlocks({
      plans: null,
      unresolved: {
        books: [makeUnresolvedBook({ cancelReason: "Немає в наявності" })],
        booksCount: 1,
      },
    });

    expect(screen.getByText(/Немає в наявності/)).toBeInTheDocument();
  });

  it("sends one book back to the wishlist", async () => {
    renderBlocks({
      plans: null,
      unresolved: { books: [makeUnresolvedBook()], booksCount: 1 },
    });

    await userEvent.click(screen.getByRole("button", { name: "Повернути у список бажань" }));

    await waitFor(() =>
      expect(sentMutations()).toEqual([{ body: {}, method: "POST", path: paths.wantToBuy }]),
    );
  });

  it("offers the bulk action only once more than one book is waiting", () => {
    renderBlocks({
      plans: null,
      unresolved: { books: [makeUnresolvedBook()], booksCount: 1 },
    });

    expect(
      screen.queryByRole("button", { name: "Повернути всі у список бажань" }),
    ).not.toBeInTheDocument();
  });

  it("asks the server to resolve the whole set for the bulk action", async () => {
    renderBlocks({
      plans: null,
      unresolved: {
        books: [makeUnresolvedBook(), makeUnresolvedBook({ id: "book-2", title: "Друга" })],
        booksCount: 2,
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Повернути всі у список бажань" }));

    await waitFor(() =>
      expect(sentMutations()).toEqual([
        { body: undefined, method: "POST", path: paths.returnAllToWishlist },
      ]),
    );
  });
});

describe("books the plans count on", () => {
  it("stays out when no undecided book touches a plan", () => {
    renderBlocks({
      plans: null,
      unresolved: { books: [makeUnresolvedBook()], booksCount: 1 },
    });

    expect(screen.queryByText("Впливають на плани")).not.toBeInTheDocument();
  });

  it("renders a book once with every context it touches", () => {
    renderBlocks({
      plans: {
        books: [
          makePlanBook({
            contexts: [
              { kind: "queue" },
              { goalName: "Осіннє читання", goalsCount: 1, kind: "goal", riskLevel: "high" },
            ],
          }),
        ],
        booksCount: 1,
      },
      unresolved: null,
    });

    expect(screen.getByText("Впливають на плани")).toBeInTheDocument();
    expect(
      screen.getByText("Черга читання · Ціль «Осіннє читання» · високий ризик"),
    ).toBeInTheDocument();
  });

  it("counts several goals instead of naming one", () => {
    renderBlocks({
      plans: {
        books: [
          makePlanBook({
            contexts: [{ goalName: null, goalsCount: 2, kind: "goal", riskLevel: "none" }],
          }),
        ],
        booksCount: 1,
      },
      unresolved: null,
    });

    expect(screen.getByText("2 активні цілі")).toBeInTheDocument();
  });

  it("says how many books it could not fit", () => {
    renderBlocks({
      plans: {
        books: [
          makePlanBook(),
          makePlanBook({ id: "plan-2", title: "Друга" }),
          makePlanBook({ id: "plan-3", title: "Третя" }),
        ],
        booksCount: 5,
      },
      unresolved: null,
    });

    expect(screen.getByText("Ще 2 книги впливають на плани")).toBeInTheDocument();
  });
});
