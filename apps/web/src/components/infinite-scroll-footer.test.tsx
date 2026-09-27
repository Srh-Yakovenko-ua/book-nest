import { describe, expect, it, vi } from "vitest";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { mockIntersectionObserver, renderWithProviders, screen, userEvent } from "@/test-utils";

import { InfiniteScrollFooter } from "./infinite-scroll-footer";

const LABELS = {
  allShown: "Показано всі жанри",
  error: "Не вдалося завантажити ще",
  retry: "Спробувати ще раз",
} as const;

const viewport = mockIntersectionObserver();

function renderFooter(state: InfiniteScrollState, allShownLabel?: string) {
  const onLoadMore = vi.fn();
  const view = renderWithProviders(
    <InfiniteScrollFooter
      {...(allShownLabel === undefined ? {} : { allShownLabel })}
      errorLabel={LABELS.error}
      onLoadMore={onLoadMore}
      state={state}
    />,
  );

  return { ...view, onLoadMore };
}

describe("InfiniteScrollFooter", () => {
  it("renders nothing when there is no next page", () => {
    renderFooter("none");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the all-shown label when there is no next page", () => {
    renderFooter("none", LABELS.allShown);

    expect(screen.getByText(LABELS.allShown)).toBeInTheDocument();
  });

  it("loads more once when the idle sentinel enters the viewport", () => {
    const { onLoadMore } = renderFooter("idle");

    viewport.enterViewport();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not load more while a page is already loading", () => {
    const { onLoadMore } = renderFooter("loading");

    viewport.enterViewport();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("loads the next page again when loading settles while the sentinel stays visible", () => {
    const { onLoadMore, rerender } = renderFooter("loading");

    viewport.enterViewport();
    expect(onLoadMore).not.toHaveBeenCalled();

    rerender(
      <InfiniteScrollFooter errorLabel={LABELS.error} onLoadMore={onLoadMore} state="idle" />,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <InfiniteScrollFooter errorLabel={LABELS.error} onLoadMore={onLoadMore} state="loading" />,
    );
    rerender(
      <InfiniteScrollFooter errorLabel={LABELS.error} onLoadMore={onLoadMore} state="idle" />,
    );

    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("retries from the error state", async () => {
    const user = userEvent.setup();
    const { onLoadMore } = renderFooter("error");

    expect(screen.getByRole("alert")).toHaveTextContent(LABELS.error);

    await user.click(screen.getByRole("button"));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
