import "@testing-library/jest-dom/vitest";

import type { ReadingQueueItemView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { LibraryBookLabels } from "../model/library-book";

import { makeBookView } from "./book-details.fixtures";
import { ReadingQueueList } from "./reading-queue-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const item = messages.readingQueue.item;
const priority = messages.books.organization.priority;

const labels: LibraryBookLabels = {
  ageBadge18Plus: "18+",
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

function articleAt(index: number): HTMLElement {
  const article = screen.getAllByRole("article")[index];
  if (article === undefined) throw new Error(`no queue item at index ${index}`);
  return article;
}

function queueItem(
  position: number,
  overrides: Parameters<typeof makeBookView>[0],
): ReadingQueueItemView {
  return { book: makeBookView(overrides), position };
}

function renderList(items: ReadingQueueItemView[], overrides: Record<string, unknown> = {}) {
  return renderWithProviders(
    <ReadingQueueList
      canMove
      draggable={false}
      filtered={false}
      items={items}
      labels={labels}
      onDragCommit={vi.fn()}
      onMove={vi.fn()}
      onRemove={vi.fn()}
      onReorderLocal={vi.fn()}
      onStartReading={vi.fn()}
      {...overrides}
    />,
  );
}

function threeItems(): ReadingQueueItemView[] {
  return [
    queueItem(1, { authors: [{ id: "a-1", name: "Перший Автор" }], id: "book-1", title: "Перша" }),
    queueItem(2, { authors: [{ id: "a-2", name: "Другий Автор" }], id: "book-2", title: "Друга" }),
    queueItem(3, { authors: [{ id: "a-3", name: "Третій Автор" }], id: "book-3", title: "Третя" }),
  ];
}

describe("ReadingQueueList", () => {
  it("shows the position, title and author for each queued book", () => {
    renderList(threeItems());

    const first = articleAt(0);
    expect(within(first).getByText("#1")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Перша" })).toBeInTheDocument();
    expect(within(first).getByText("Перший Автор")).toBeInTheDocument();
  });

  it("marks the currently reading book and its ownership status", () => {
    renderList([
      queueItem(1, {
        id: "book-1",
        ownershipStatus: "owned",
        readingStatus: "reading",
        title: "Перша",
      }),
    ]);

    const first = articleAt(0);
    expect(within(first).getByText(item.readingNow)).toBeInTheDocument();
    expect(within(first).getByText("ownership:owned")).toBeInTheDocument();
  });

  it("offers a start reading action on the first item", () => {
    renderList(threeItems());

    const first = articleAt(0);
    expect(within(first).getByRole("button", { name: item.startReading })).toBeInTheDocument();
  });

  it("shows the inline start-reading button only for the first item", async () => {
    renderList(threeItems());

    const first = articleAt(0);
    expect(within(first).getByRole("button", { name: item.startReading })).toHaveTextContent(
      item.startReading,
    );

    const second = articleAt(1);
    expect(
      within(second).queryByRole("button", { name: item.startReading }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(second).getByRole("button", { name: /Більше дій/ }));
    expect(await screen.findByRole("menuitem", { name: item.startReading })).toBeInTheDocument();
  });

  it("shows the priority reason for a high-priority book", () => {
    renderList([
      queueItem(1, {
        id: "book-1",
        queuePriority: "high",
        queuePriorityReason: "book_club",
        title: "Перша",
      }),
    ]);

    const first = articleAt(0);
    expect(within(first).getByText(priority.high.label)).toBeInTheDocument();
    expect(within(first).getByText(priority.reason.options.bookClub)).toBeInTheDocument();
  });

  it("renders the ownership status with the same tone as the library card", () => {
    renderList([queueItem(1, { id: "book-1", ownershipStatus: "in_transit", title: "Перша" })]);

    const badge = screen.getByText("ownership:in_transit").closest('[data-slot="status-badge"]');
    expect(badge).toHaveAttribute("data-tone", "info");
  });

  it("calls onStartReading with the chosen item", async () => {
    const onStartReading = vi.fn();
    const items = threeItems();
    renderList(items, { onStartReading });

    const second = articleAt(1);
    await userEvent.click(within(second).getByRole("button", { name: /Більше дій/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: item.startReading }));

    expect(onStartReading).toHaveBeenCalledWith(items[1]);
  });

  it("disables moving the first item up", async () => {
    renderList(threeItems());

    const first = articleAt(0);
    await userEvent.click(within(first).getByRole("button", { name: /Більше дій/ }));

    expect(await screen.findByRole("menuitem", { name: item.moveUp })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: item.moveDown })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables moving the last item down", async () => {
    renderList(threeItems());

    const last = articleAt(2);
    await userEvent.click(within(last).getByRole("button", { name: /Більше дій/ }));

    expect(await screen.findByRole("menuitem", { name: item.moveDown })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("moves an item up through the more menu", async () => {
    const onMove = vi.fn();
    const items = threeItems();
    renderList(items, { onMove });

    const second = articleAt(1);
    await userEvent.click(within(second).getByRole("button", { name: /Більше дій/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: item.moveUp }));

    expect(onMove).toHaveBeenCalledWith([items[1], items[0], items[2]]);
  });
});
