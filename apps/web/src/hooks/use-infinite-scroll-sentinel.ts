"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useRef, useState } from "react";

const SENTINEL = {
  rootMargin: "480px 0px",
  threshold: 0,
} as const;

export type InfiniteScrollState = "error" | "idle" | "loading" | "none";

type UseInfiniteScrollSentinelParams = {
  enabled: boolean;
  onLoadMore: () => void;
};

export function useInfiniteScrollSentinel({
  enabled,
  onLoadMore,
}: UseInfiniteScrollSentinelParams): (element: Nullable<HTMLElement>) => void {
  const [sentinel, setSentinel] = useState<Nullable<HTMLElement>>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    if (sentinel === null) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsIntersecting(entries.some((entry) => entry.isIntersecting));
      },
      { rootMargin: SENTINEL.rootMargin, threshold: SENTINEL.threshold },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  useEffect(() => {
    if (!enabled || !isIntersecting) return;
    onLoadMoreRef.current();
  }, [enabled, isIntersecting]);

  return setSentinel;
}
