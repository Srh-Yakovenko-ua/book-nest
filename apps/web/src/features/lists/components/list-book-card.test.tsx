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
    expect(screen.getByText("Позиція 2")).toBeInTheDocument();
  });

  it("hides the position badge when the list is not sorted by position", () => {
    renderCard({ position: 2, title: "Друга книга" }, { showPosition: false });

    expect(screen.queryByText("Позиція 2")).not.toBeInTheDocument();
  });

  it("offers view, queue, other-list, reorder and remove actions", async () => {
    renderCard({ title: "Книга" });

    await openMenu("Книга");

    expect(screen.getByRole("link", { name: "Переглянути книгу" })).toBeInTheDocument();
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

  it("disables both reorder actions and explains why when reordering is unavailable", async () => {
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3, canReorder: false });

    expect(
      screen.queryByRole("button", { name: "Змінити порядок книги «Книга»" }),
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
    expect(
      screen.getByText(
        "Щоб змінити порядок книг, виберіть сортування «Позиція в списку» та скиньте пошук і фільтри.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the drag handle while reordering is possible", () => {
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3 });

    expect(
      screen.getByRole("button", { name: "Змінити порядок книги «Книга»" }),
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

describe("ListBookCard call to action", () => {
  const ctaByStatus: [ReadingStatus, string][] = [
    ["dnf", "Переглянути книгу"],
    ["finished", "Переглянути книгу"],
    ["not_started", "Почати читання"],
    ["paused", "Відновити читання"],
    ["reading", "Продовжити читання"],
    ["rereading", "Продовжити читання"],
    ["want_to_read", "Почати читання"],
  ];

  it.each(ctaByStatus)("renders the %s call to action", (readingStatus, expected) => {
    renderCard({ readingStatus, title: "Книга" });

    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it("starts reading from the call to action", async () => {
    const onStartReading = vi.fn();
    renderCard({ readingStatus: "not_started", title: "Книга" }, { onStartReading });

    await userEvent.click(screen.getByRole("button", { name: "Почати читання" }));

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

    expect(screen.getByRole("img", { name: "rating 8" })).toBeInTheDocument();
  });
});
