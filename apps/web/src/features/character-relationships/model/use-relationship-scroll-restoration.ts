"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { BookTabScrollScope } from "@/lib/book-tab-scroll-anchor";

import { captureBookTabScrollAnchor, resolveBookTabScrollTop } from "@/lib/book-tab-scroll-anchor";

import type { RelationshipScrollEntry } from "./relationship-scroll-anchor";

import { RELATIONSHIP_SCROLL, relationshipScrollMemory } from "./relationship-scroll-anchor";

type RelationshipScrollReader = () => Nullable<RelationshipScrollEntry>;

type RelationshipScrollRefs = {
  readerRef: RefObject<Nullable<RelationshipScrollReader>>;
  restorableKeyRef: RefObject<Nullable<string>>;
};

type UseRelationshipScrollRestorationInput = {
  containerRef: RefObject<Nullable<HTMLElement>>;
  isFetching: boolean;
  isResultsRendered: boolean;
  renderedCount: number;
  scrollScope: BookTabScrollScope;
};

export function useRelationshipScrollRestoration({
  containerRef,
  isFetching,
  isResultsRendered,
  renderedCount,
  scrollScope,
}: UseRelationshipScrollRestorationInput): () => void {
  const { bookId, criteriaKey } = scrollScope;
  const [mountEntry] = useState(() => relationshipScrollMemory.read(scrollScope));
  const restorableKeyRef = useRef<Nullable<string>>(criteriaKey);
  const previousCriteriaKeyRef = useRef(criteriaKey);
  const readerRef = useRef<Nullable<RelationshipScrollReader>>(null);
  const isReadyToRestore =
    isResultsRendered && (!isFetching || renderedCount >= (mountEntry?.renderedCount ?? 0));

  useLayoutEffect(() => {
    if (restorableKeyRef.current !== criteriaKey) restorableKeyRef.current = null;
    const container = containerRef.current;
    if (!isReadyToRestore || container === null || restorableKeyRef.current === null) return;

    restorableKeyRef.current = null;
    if (mountEntry === null) return;
    relationshipScrollMemory.forget(mountEntry.anchor);

    const top = resolveBookTabScrollTop({
      anchor: mountEntry.anchor,
      cardAttribute: RELATIONSHIP_SCROLL.cardAttribute,
      container,
      scope: { bookId, criteriaKey },
      scrollY: window.scrollY,
    });
    if (top !== null) window.scrollTo({ behavior: "instant", top });
  }, [bookId, containerRef, criteriaKey, isReadyToRestore, mountEntry]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    readerRef.current =
      isResultsRendered && container !== null
        ? () => {
            const anchor = captureBookTabScrollAnchor({
              cardAttribute: RELATIONSHIP_SCROLL.cardAttribute,
              container,
              scope: { bookId, criteriaKey },
              scrollY: window.scrollY,
            });
            return anchor === null ? null : { anchor, renderedCount };
          }
        : null;
  }, [bookId, containerRef, criteriaKey, isResultsRendered, renderedCount]);

  useLayoutEffect(() => {
    const persist = () => persistRelationshipScroll({ readerRef, restorableKeyRef });
    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, []);

  useEffect(() => {
    if (previousCriteriaKeyRef.current === criteriaKey) return;
    previousCriteriaKeyRef.current = criteriaKey;
    const resultsStart = containerRef.current;
    if (resultsStart !== null && isAboveScrollMargin(resultsStart)) {
      resultsStart.scrollIntoView({ block: "start" });
    }
  }, [containerRef, criteriaKey]);

  return () => persistRelationshipScroll({ readerRef, restorableKeyRef });
}

function isAboveScrollMargin(element: HTMLElement): boolean {
  const scrollMargin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return element.getBoundingClientRect().top < scrollMargin;
}

function persistRelationshipScroll({ readerRef, restorableKeyRef }: RelationshipScrollRefs): void {
  if (restorableKeyRef.current !== null) return;
  const entry = readerRef.current?.() ?? null;
  if (entry !== null) relationshipScrollMemory.save(entry);
}
