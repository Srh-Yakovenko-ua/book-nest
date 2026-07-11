import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeListBookView } from "../model/lists.fixtures";
import { ListBookCard } from "./list-book-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const labels: LibraryBookLabels = {
  borrowedFrom: (name) => `Borrowed from ${name}`,
  formatLabel: (value) => `format:${value}`,
  genreName: (key) => key,
  lentTo: (name) => `Lent to ${name}`,
  ownershipLabel: (value) => `ownership:${value}`,
  pagesText: (value) => `${value} p`,
  progressAriaLabel: (current, total) => `${current}/${total}`,
  progressUnit: "p",
  ratingLabel: (value) => `rating ${value}`,
  seriesPosition: (position, total) => `${position} of ${total}`,
  statusLabel: (value) => `status:${value}`,
};

async function openMenu(title: string) {
  await userEvent.click(screen.getByRole("button", { name: `Дії з книгою: ${title}` }));
}

function renderCard(
  bookOverrides: Parameters<typeof makeListBookView>[0] = {},
  props: Record<string, unknown> & { bookCount?: number; canReorder?: boolean } = {},
) {
  const { bookCount = 3, canReorder = true, ...handlers } = props;
  return renderWithProviders(
    <ListBookCard
      book={makeListBookView(bookOverrides)}
      bookCount={bookCount}
      canReorder={canReorder}
      labels={labels}
      onAddToQueue={vi.fn()}
      onMove={vi.fn()}
      onRemove={vi.fn()}
      {...handlers}
    />,
  );
}

describe("ListBookCard", () => {
  it("shows the book title and its position badge", () => {
    renderCard({ position: 2, title: "Друга книга" });

    expect(screen.getByRole("link", { name: "Друга книга" })).toBeInTheDocument();
    expect(screen.getByText("Позиція 2")).toBeInTheDocument();
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

  it("disables both reorder actions when reordering is unavailable", async () => {
    renderCard({ position: 2, title: "Книга" }, { bookCount: 3, canReorder: false });

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
