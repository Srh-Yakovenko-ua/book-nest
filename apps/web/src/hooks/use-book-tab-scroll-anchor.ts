"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { createRef, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  BookTabCardAttribute,
  BookTabScrollAnchor,
  BookTabScrollScope,
} from "@/lib/book-tab-scroll-anchor";

import { captureBookTabScrollAnchor, resolveBookTabScrollTop } from "@/lib/book-tab-scroll-anchor";

export type BookTabScrollMemory = {
  anchorRef: RefObject<Nullable<BookTabScrollAnchor>>;
  capture: () => void;
  readerRef: RefObject<Nullable<BookTabScrollAnchorReader>>;
};

type BookTabScrollAnchorReader = () => Nullable<BookTabScrollAnchor>;

type UseBookTabScrollAnchorInput = BookTabScrollScope & {
  cardAttribute: BookTabCardAttribute;
  containerRef: RefObject<Nullable<HTMLElement>>;
  isListRendered: boolean;
  memory: BookTabScrollMemory;
};

export function createBookTabScrollMemory(): BookTabScrollMemory {
  const anchorRef = createRef<Nullable<BookTabScrollAnchor>>();
  const readerRef = createRef<Nullable<BookTabScrollAnchorReader>>();

  return {
    anchorRef,
    capture: () => {
      const readAnchor = readerRef.current;
      anchorRef.current = readAnchor === null ? null : readAnchor();
    },
    readerRef,
  };
}

export function useBookTabScrollAnchor({
  bookId,
  cardAttribute,
  containerRef,
  criteriaKey,
  isListRendered,
  memory,
}: UseBookTabScrollAnchorInput): void {
  const { anchorRef, readerRef } = memory;
  const restorableCriteriaKey = useRef<Nullable<string>>(criteriaKey);
  const previousCriteriaKey = useRef(criteriaKey);

  useLayoutEffect(() => {
    if (restorableCriteriaKey.current !== criteriaKey) restorableCriteriaKey.current = null;
    const container = containerRef.current;
    if (!isListRendered || container === null || restorableCriteriaKey.current === null) return;

    restorableCriteriaKey.current = null;
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (anchor === null) return;

    const top = resolveBookTabScrollTop({
      anchor,
      cardAttribute,
      container,
      scope: { bookId, criteriaKey },
      scrollY: window.scrollY,
    });
    if (top !== null) window.scrollTo({ behavior: "instant", top });
  }, [anchorRef, bookId, cardAttribute, containerRef, criteriaKey, isListRendered]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!isListRendered || container === null) return;

    readerRef.current = () =>
      captureBookTabScrollAnchor({
        cardAttribute,
        container,
        scope: { bookId, criteriaKey },
        scrollY: window.scrollY,
      });
    return () => {
      readerRef.current = null;
    };
  }, [bookId, cardAttribute, containerRef, criteriaKey, isListRendered, readerRef]);

  useEffect(() => {
    if (previousCriteriaKey.current === criteriaKey) return;
    previousCriteriaKey.current = criteriaKey;
    const resultsStart = containerRef.current;
    if (resultsStart !== null && isAboveScrollMargin(resultsStart)) {
      resultsStart.scrollIntoView({ block: "start" });
    }
  }, [containerRef, criteriaKey]);
}

export function useBookTabScrollMemory(bookId: string): BookTabScrollMemory {
  const [memory] = useState(createBookTabScrollMemory);

  useLayoutEffect(
    () => () => {
      memory.anchorRef.current = null;
    },
    [bookId, memory],
  );

  return memory;
}

function isAboveScrollMargin(element: HTMLElement): boolean {
  const scrollMargin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return element.getBoundingClientRect().top < scrollMargin;
}
