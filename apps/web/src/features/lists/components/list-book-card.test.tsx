import "@testing-library/jest-dom/vitest";

import type { ListBookView, ReadingStatus } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { ListBookItemProps } from "../model/list-book-item";

import { listBookReorder } from "../model/list-reorder";
import { makeListBookView } from "../model/lists.fixtures";
import { ListBookCard } from "./list-book-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const labels: LibraryBookLabels = {
  ageBadge18Plus: "18+",
  borrowedFrom: (name) => `Borrowed from ${name}`,
  formatLabel: (value) => `format:${value}`,
  genreName: (key) => key,
  lentTo: (name) => `Lent to ${name}`,
  ownershipLabel: (value) => `ownership:${value}`,
  pagesText: (value) => `${value} стор.`,
  progressAriaLabel: (current, total) => `${current}/${total}`,
  progressUnit: "стор.",
  ratingLabel: (value) => `rating ${value}`,
  seriesPosition: (position, total) => `${position} of ${total}`,
  statusLabel: (value) => `status:${value}`,
};

async function openMenu(title: string) {
  await userEvent.click(screen.getByRole("button", { name: `Дії з книгою: ${title}` }));
}

function renderCard(
  bookOverrides: Partial<ListBookView> = {},
  options: Partial<ListBookItemProps> & { bookCount?: number; canReorder?: boolean } = {},
) {
  const { bookCount = 3, canReorder = true, ...overrides } = options;
  const book = makeListBookView(bookOverrides);
  return renderWithProviders(
    <ListBookCard
      book={book}
      isPending={false}
      labels={labels}
      onAddToQueue={vi.fn()}
      onMove={vi.fn()}
      onRemove={vi.fn()}
      onStartReading={vi.fn()}
      onToggleFavorite={vi.fn()}
      reorder={listBookReorder({ bookCount, canReorder, position: book.position })}
      showPosition
      {...overrides}
    />,
  );
}

describe("ListBookCard", () => {
  it("shows the book title and its position badge", () => {
    renderCard({ position: 2, title: "Друга книга" });

    expect(screen.getByRole("link", { name: "Друга книга" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Змінити порядок книги «Друга книга» · позиція 2" }),
    ).toHaveTextContent("#2");
  });

  it("hides the position badge when the list is not sorted by position", () => {
    renderCard({ position: 2, title: "Друга книга" }, { showPosition: false });

    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  it("offers queue, other-list, reorder and remove actions without a view link", async () => {
    renderCard({ title: "Книга" });

    await openMenu("Книга");

    expect(screen.queryByRole("link", { name: "Переглянути книгу" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Додати в чергу" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Додати до іншого списку" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Перемістити вище" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Перемістити нижче" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Прибрати зі списку" })).toBeInTheDocument();
  });

  it("disables moving up for the first book in the list", async () => {
    renderCard({ position: 1, title: "Книга" }, { bookCount: 3 });

    await openMenu("Книга");

    expect(screen.getByRole("menuitem", { name: "Перемістити вище" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Перемістити нижче" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables moving down for the last book in the list", async () => {
    renderCard({ position: 3, title: "Книга" }, { bookCount: 3 });

    await openMenu("Книга");

    expect(screen.getByRole("menuitem", { name: "Перемістити нижче" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("hides the drag handle and disables both reorder actions when reordering is unavailable", async () => {
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3, canReorder: false });

    expect(
      screen.queryByRole("button", { name: /^Змінити порядок книги «Книга»/u }),
    ).not.toBeInTheDocument();

    await openMenu("Книга");

    expect(screen.getByRole("menuitem", { name: "Перемістити вище" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Перемістити нижче" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the drag handle while reordering is possible", () => {
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3 });

    expect(
      screen.getByRole("button", { name: /^Змінити порядок книги «Книга»/u }),
    ).toBeInTheDocument();
  });

  it("moves a book up through the menu", async () => {
    const onMove = vi.fn();
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3, onMove });

    await openMenu("Книга");
    await userEvent.click(screen.getByRole("menuitem", { name: "Перемістити вище" }));

    expect(onMove).toHaveBeenCalledWith("up");
  });

  it("removes a book through the menu", async () => {
    const onRemove = vi.fn();
    renderCard({ title: "Книга" }, { onRemove });

    await openMenu("Книга");
    await userEvent.click(screen.getByRole("menuitem", { name: "Прибрати зі списку" }));

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("adds an out-of-queue book to the reading queue", async () => {
    const onAddToQueue = vi.fn();
    renderCard({ isInReadingQueue: false, title: "Книга" }, { onAddToQueue });

    await openMenu("Книга");
    await userEvent.click(screen.getByRole("menuitem", { name: "Додати в чергу" }));

    expect(onAddToQueue).toHaveBeenCalledOnce();
  });

  it("marks a queued book and links to the queue instead of adding it", async () => {
    renderCard({ isInReadingQueue: true, title: "Книга" });

    expect(screen.getByText("У черзі")).toBeInTheDocument();

    await openMenu("Книга");

    expect(screen.getByRole("link", { name: "Перейти до черги" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Додати в чергу" })).not.toBeInTheDocument();
  });
});

describe("ListBookCard reading action", () => {
  const withAction: [ReadingStatus, string][] = [
    ["not_started", "Почати читання"],
    ["paused", "Відновити читання"],
    ["want_to_read", "Почати читання"],
  ];
  const withoutAction: ReadingStatus[] = ["dnf", "finished", "reading", "rereading"];

  it.each(withAction)(
    "offers the %s reading action in the menu",
    async (readingStatus, expected) => {
      renderCard({ readingStatus, title: "Книга" });

      await openMenu("Книга");

      expect(screen.getByRole("menuitem", { name: expected })).toBeInTheDocument();
    },
  );

  it.each(withoutAction)("offers no reading action for %s", async (readingStatus) => {
    renderCard({ readingStatus, title: "Книга" });

    await openMenu("Книга");

    expect(screen.queryByRole("menuitem", { name: /читання/ })).not.toBeInTheDocument();
  });

  it.each(withAction)("keeps the %s action out of the card body", (readingStatus, label) => {
    renderCard({ readingStatus, title: "Книга" });

    expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
  });

  it("starts reading from the menu", async () => {
    const onStartReading = vi.fn();
    renderCard({ readingStatus: "not_started", title: "Книга" }, { onStartReading });

    await openMenu("Книга");
    await userEvent.click(screen.getByRole("menuitem", { name: "Почати читання" }));

    expect(onStartReading).toHaveBeenCalledOnce();
  });
});

describe("ListBookCard partial data", () => {
  it("falls back to an unknown author label", () => {
    renderCard({ authors: [], title: "Книга" });

    expect(screen.getAllByText("Автор невідомий").length).toBeGreaterThan(0);
  });

  it("omits the page count instead of showing zero pages", () => {
    renderCard({ pagesCount: null, title: "Книга" });

    expect(screen.queryByText(/стор\./)).not.toBeInTheDocument();
  });

  it("omits the rating block when the book has no rating", () => {
    renderCard({ readingProgress: null, title: "Книга" });

    expect(screen.queryByRole("img", { name: /rating/ })).not.toBeInTheDocument();
  });

  it("renders the rating when the book has one", () => {
    renderCard({
      readingProgress: {
        abandonedAt: null,
        currentPage: null,
        finishedAt: null,
        impression: null,
        lastProgressUpdateAt: null,
        note: null,
        pausedAt: null,
        rating: 8,
        startedAt: null,
      },
      title: "Книга",
    });

    expect(screen.getAllByRole("img", { name: "rating 8" }).length).toBeGreaterThan(0);
  });
});
