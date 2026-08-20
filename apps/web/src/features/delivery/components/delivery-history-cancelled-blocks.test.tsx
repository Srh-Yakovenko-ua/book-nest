import "@testing-library/jest-dom/vitest";

import type { CancelledFollowUpBook, CancelledFollowUpView, CancelledPlanBook } from "@app/shared";
import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { DeliveryHistoryCancelledBlocks } from "./delivery-history-sidebar";

const retryMock = vi.fn();
const returnAllMock = vi.fn();
const wantToBuyMock = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/shared/api/generated/endpoints/delivery-read/delivery-read", () => ({
  cancelledFollowUpControllerReturnAllToWishlist: (...args: unknown[]) => returnAllMock(...args),
}));

vi.mock("@/shared/api/generated/endpoints/books/books", () => ({
  bookOwnershipControllerMarkBought: vi.fn(),
  bookOwnershipControllerMarkOwned: vi.fn(),
  bookOwnershipControllerRemoveFromWishlist: vi.fn(),
  bookOwnershipControllerRemoveOwned: vi.fn(),
  bookOwnershipControllerWantToBuy: (...args: unknown[]) => wantToBuyMock(...args),
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

beforeEach(() => {
  retryMock.mockReset();
  returnAllMock.mockReset();
  wantToBuyMock.mockReset();
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
    wantToBuyMock.mockResolvedValue({ id: "book-1", ownershipStatus: "want_to_buy" });
    renderBlocks({
      plans: null,
      unresolved: { books: [makeUnresolvedBook()], booksCount: 1 },
    });

    await userEvent.click(screen.getByRole("button", { name: "Повернути у список бажань" }));

    await waitFor(() => expect(wantToBuyMock).toHaveBeenCalledWith("book-1", {}));
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
    returnAllMock.mockResolvedValue({ updatedCount: 2 });
    renderBlocks({
      plans: null,
      unresolved: {
        books: [makeUnresolvedBook(), makeUnresolvedBook({ id: "book-2", title: "Друга" })],
        booksCount: 2,
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Повернути всі у список бажань" }));

    await waitFor(() => expect(returnAllMock).toHaveBeenCalledOnce());
    expect(returnAllMock.mock.calls[0]?.[0]).toBeUndefined();
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
