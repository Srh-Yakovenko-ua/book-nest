"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MILLISECONDS_PER_SECOND = 1000;
const TRANSITION_GRACE_MS = 50;

type AnimatedHeight<TContent extends HTMLElement> = {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  contentRef: RefObject<Nullable<TContent>>;
  isClamped: boolean;
};

type AnimatedHeightOptions<TContent extends HTMLElement> = {
  collapsedHeight?: (content: TContent) => number;
  contentKey?: number | string;
  expanded: boolean;
};

export function useAnimatedHeight<TContent extends HTMLElement>({
  collapsedHeight,
  contentKey,
  expanded,
}: AnimatedHeightOptions<TContent>): AnimatedHeight<TContent> {
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const contentRef = useRef<Nullable<TContent>>(null);
  const collapsedHeightRef = useRef(collapsedHeight);
  const restingHeightRef = useRef<Nullable<number>>(null);
  const previousExpandedRef = useRef<Nullable<boolean>>(null);
  const animatingRef = useRef(false);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    collapsedHeightRef.current = collapsedHeight;
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (container === null || content === null) return;

    let cancelSettleTimer: (() => void) | undefined;

    const measureClamp = (): Nullable<number> => {
      const collapsed = collapsedHeightRef.current?.(content);
      if (collapsed === undefined) return null;
      return Math.min(collapsed, content.scrollHeight);
    };

    const settle = (clamp: Nullable<number>) => {
      container.style.height = clamp === null ? "auto" : `${clamp}px`;
    };

    const transitionMs = () => {
      const declared = getComputedStyle(container).transitionDuration.split(",")[0]?.trim() ?? "0s";
      const value = Number.parseFloat(declared);
      if (Number.isNaN(value)) return 0;
      return declared.endsWith("ms") ? value : value * MILLISECONDS_PER_SECOND;
    };

    const animate = (clamp: Nullable<number>, from: number, to: number) => {
      container.style.height = `${from}px`;
      void container.offsetHeight;
      container.style.height = `${to}px`;
      animatingRef.current = true;
      const timer = window.setTimeout(() => {
        animatingRef.current = false;
        settle(clamp);
      }, transitionMs() + TRANSITION_GRACE_MS);
      cancelSettleTimer = () => window.clearTimeout(timer);
    };

    const sync = () => {
      const clamp = measureClamp();
      setIsClamped(clamp !== null && content.scrollHeight > clamp + 1);
      const resting = expanded ? null : clamp;
      const to = resting ?? content.scrollHeight;
      const from = animatingRef.current
        ? container.getBoundingClientRect().height
        : restingHeightRef.current;
      restingHeightRef.current = to;
      const toggled =
        previousExpandedRef.current !== null && previousExpandedRef.current !== expanded;
      previousExpandedRef.current = expanded;
      if (!toggled || from === null || from === to) {
        settle(resting);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        settle(resting);
        return;
      }
      animate(resting, from, to);
    };

    sync();

    const observer = new ResizeObserver(() => {
      const clamp = measureClamp();
      setIsClamped(clamp !== null && content.scrollHeight > clamp + 1);
      const resting = expanded ? null : clamp;
      restingHeightRef.current = resting ?? content.scrollHeight;
      if (animatingRef.current) return;
      settle(resting);
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      cancelSettleTimer?.();
    };
  }, [contentKey, expanded]);

  return { containerRef, contentRef, isClamped };
}
