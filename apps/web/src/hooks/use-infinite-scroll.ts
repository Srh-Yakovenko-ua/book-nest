"use client";

import { useCallback, useEffect, useRef } from "react";

import { useLockedWheelScroll } from "@/hooks/use-locked-wheel-scroll";

const LOAD_MORE_THRESHOLD_PX = 160;

type UseInfiniteScrollParams = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  itemCount: number;
  onLoadMore: () => void;
};

export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  itemCount,
  onLoadMore,
}: UseInfiniteScrollParams) {
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  const maybeLoadMore = useCallback(() => {
    const element = scrollElementRef.current;
    if (element === null || !hasNextPage || isFetchingNextPage) return;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceToBottom <= LOAD_MORE_THRESHOLD_PX) onLoadMoreRef.current();
  }, [hasNextPage, isFetchingNextPage]);

  const attachWheel = useLockedWheelScroll(maybeLoadMore);

  const scrollRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollElementRef.current = element;
      attachWheel(element);
      if (element !== null) maybeLoadMore();
    },
    [attachWheel, maybeLoadMore],
  );

  useEffect(() => {
    maybeLoadMore();
  }, [maybeLoadMore, itemCount]);

  return { onScroll: maybeLoadMore, scrollRef };
}
