"use client";

import type { Nullable } from "@app/shared";

import { useState } from "react";

export function useAppendedPageFocus<TItem>({
  onLoadMore,
  pages,
}: {
  onLoadMore: () => void;
  pages: readonly { items: readonly TItem[] }[];
}) {
  const [awaitedPageIndex, setAwaitedPageIndex] = useState<Nullable<number>>(null);
  const firstAppendedItem =
    awaitedPageIndex === null ? undefined : pages[awaitedPageIndex]?.items[0];

  return {
    focusRefFor: (item: TItem) =>
      item === firstAppendedItem
        ? (element: Nullable<HTMLElement>) => {
            if (element === null) return;
            element.focus();
            setAwaitedPageIndex(null);
          }
        : undefined,
    loadMore: () => {
      setAwaitedPageIndex(pages.length);
      onLoadMore();
    },
  };
}
