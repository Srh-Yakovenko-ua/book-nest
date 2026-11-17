import type { CompletedReadRef } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { completedReadFixture, statisticsIds } from "../../model/statistics.fixtures";
import { CompletedReadsList } from "./completed-reads-list";

const text = messages.statistics.details;

const TOTAL_READS = 45;

type ListState = { hasMore: boolean; isLoadingMore: boolean; pages: ReadsPage[] };

type ReadsPage = { items: CompletedReadRef[]; totalCount: number };

function readsPage(firstNumber: number, count: number): ReadsPage {
  const items = Array.from({ length: count }, (_, index) => {
    const number = firstNumber + index;
    return completedReadFixture({
      book: {
        bookId: statisticsIds.bookId,
        bookState: "active",
        coverThumbUrl: null,
        title: `Book ${number}`,
      },
      readingCycleId: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    });
  });
  return { items, totalCount: TOTAL_READS };
}

const PAGES = {
  first: readsPage(1, 20),
  last: readsPage(41, 5),
  second: readsPage(21, 20),
};

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1280);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function loadMoreButton(): HTMLElement {
  return screen.getByRole("button", { name: text.bucket.loadMore });
}

function readTrigger(title: string): HTMLElement {
  return screen.getByRole("button", { name: text.completedRead.open.replace("{title}", title) });
}

function renderList(onLoadMore: () => void, state: ListState) {
  const list = (next: ListState) => (
    <CompletedReadsList emptyTitle={text.subset.empty} onLoadMore={onLoadMore} {...next} />
  );
  const { rerender } = renderWithProviders(list(state));
  return { rerenderList: (next: ListState) => rerender(list(next)) };
}

describe("CompletedReadsList load more", () => {
  it("keeps focus on the load-more button and marks it unavailable while the next page loads", async () => {
    const user = userEvent.setup();
    const { rerenderList } = renderList(vi.fn(), {
      hasMore: true,
      isLoadingMore: false,
      pages: [PAGES.first],
    });

    loadMoreButton().focus();
    await user.keyboard("{Enter}");
    rerenderList({ hasMore: true, isLoadingMore: true, pages: [PAGES.first] });

    const button = loadMoreButton();
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("does not ask for another page when the button is activated again while one is loading", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const { rerenderList } = renderList(onLoadMore, {
      hasMore: true,
      isLoadingMore: false,
      pages: [PAGES.first],
    });

    loadMoreButton().focus();
    await user.keyboard("{Enter}");
    rerenderList({ hasMore: true, isLoadingMore: true, pages: [PAGES.first] });
    loadMoreButton().focus();
    await user.keyboard("{Enter}");

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the first read of the page that just arrived", async () => {
    const user = userEvent.setup();
    const { rerenderList } = renderList(vi.fn(), {
      hasMore: true,
      isLoadingMore: false,
      pages: [PAGES.first],
    });

    loadMoreButton().focus();
    await user.keyboard("{Enter}");
    rerenderList({ hasMore: true, isLoadingMore: true, pages: [PAGES.first] });
    rerenderList({ hasMore: true, isLoadingMore: false, pages: [PAGES.first, PAGES.second] });

    await waitFor(() => expect(readTrigger("Book 21")).toHaveFocus());
  });

  it("leaves focus on the first read of the last page once there is nothing more to load", async () => {
    const user = userEvent.setup();
    const { rerenderList } = renderList(vi.fn(), {
      hasMore: true,
      isLoadingMore: false,
      pages: [PAGES.first],
    });

    loadMoreButton().focus();
    await user.keyboard("{Enter}");
    rerenderList({ hasMore: true, isLoadingMore: true, pages: [PAGES.first] });
    rerenderList({ hasMore: true, isLoadingMore: false, pages: [PAGES.first, PAGES.second] });
    await waitFor(() => expect(readTrigger("Book 21")).toHaveFocus());
    loadMoreButton().focus();
    await user.keyboard("{Enter}");
    rerenderList({ hasMore: true, isLoadingMore: true, pages: [PAGES.first, PAGES.second] });
    rerenderList({
      hasMore: false,
      isLoadingMore: false,
      pages: [PAGES.first, PAGES.second, PAGES.last],
    });

    await waitFor(() => expect(readTrigger("Book 41")).toHaveFocus());
    expect(screen.queryByRole("button", { name: text.bucket.loadMore })).not.toBeInTheDocument();
  });
});
