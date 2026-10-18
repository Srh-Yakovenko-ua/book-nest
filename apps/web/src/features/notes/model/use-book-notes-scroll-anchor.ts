"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { createRef, useLayoutEffect, useRef, useState } from "react";

import type { BookNotesScrollAnchor, BookNotesScrollScope } from "./book-notes-scroll-anchor";

import {
  captureBookNotesScrollAnchor,
  resolveBookNotesScrollTop,
} from "./book-notes-scroll-anchor";

export type BookNotesScrollMemory = {
  anchorRef: RefObject<Nullable<BookNotesScrollAnchor>>;
  capture: () => void;
  readerRef: RefObject<Nullable<BookNotesScrollAnchorReader>>;
};

type BookNotesScrollAnchorReader = () => Nullable<BookNotesScrollAnchor>;

type UseBookNotesScrollAnchorInput = BookNotesScrollScope & {
  containerRef: RefObject<Nullable<HTMLElement>>;
  isListRendered: boolean;
  memory: BookNotesScrollMemory;
};

export function createBookNotesScrollMemory(): BookNotesScrollMemory {
  const anchorRef = createRef<Nullable<BookNotesScrollAnchor>>();
  const readerRef = createRef<Nullable<BookNotesScrollAnchorReader>>();

  return {
    anchorRef,
    capture: () => {
      const readAnchor = readerRef.current;
      anchorRef.current = readAnchor === null ? null : readAnchor();
    },
    readerRef,
  };
}

export function useBookNotesScrollAnchor({
  bookId,
  containerRef,
  criteriaKey,
  isListRendered,
  memory,
}: UseBookNotesScrollAnchorInput): void {
  const { anchorRef, readerRef } = memory;
  const restorableCriteriaKey = useRef<Nullable<string>>(criteriaKey);

  useLayoutEffect(() => {
    if (restorableCriteriaKey.current !== criteriaKey) restorableCriteriaKey.current = null;
    const container = containerRef.current;
    if (!isListRendered || container === null || restorableCriteriaKey.current === null) return;

    restorableCriteriaKey.current = null;
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (anchor === null) return;

    const top = resolveBookNotesScrollTop({
      anchor,
      container,
      scope: { bookId, criteriaKey },
      scrollY: window.scrollY,
    });
    if (top !== null) window.scrollTo({ behavior: "instant", top });
  }, [anchorRef, bookId, containerRef, criteriaKey, isListRendered]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!isListRendered || container === null) return;

    readerRef.current = () =>
      captureBookNotesScrollAnchor({
        container,
        scope: { bookId, criteriaKey },
        scrollY: window.scrollY,
      });
    return () => {
      readerRef.current = null;
    };
  }, [bookId, containerRef, criteriaKey, isListRendered, readerRef]);
}

export function useBookNotesScrollMemory(bookId: string): BookNotesScrollMemory {
  const [memory] = useState(createBookNotesScrollMemory);

  useLayoutEffect(
    () => () => {
      memory.anchorRef.current = null;
    },
    [bookId, memory],
  );

  return memory;
}
