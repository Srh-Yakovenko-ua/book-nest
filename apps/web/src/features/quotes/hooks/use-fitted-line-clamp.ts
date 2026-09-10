"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useLayoutEffect, useRef, useState } from "react";

const QUOTE_TEXT_FIT = {
  defaultLines: 5,
  from: "(min-width: 48rem)",
  overflowTolerancePx: 1,
} as const;

type Fit = {
  isClamped: boolean;
  lines: number;
};

type FittedLineClamp<TElement extends HTMLElement> = Fit & {
  ref: RefObject<Nullable<TElement>>;
};

export function useFittedLineClamp<TElement extends HTMLElement>(
  text: string,
  fitTo?: Nullable<HTMLElement>,
): FittedLineClamp<TElement> {
  const ref = useRef<Nullable<TElement>>(null);
  const [isClamped, setIsClamped] = useState(false);
  const [lines, setLines] = useState<number>(QUOTE_TEXT_FIT.defaultLines);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const fit = readFit(element, fitTo ?? null);
    setIsClamped(fit.isClamped);
    setLines(fit.lines);
  }, [fitTo, isClamped, lines, text]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const container = fitTo ?? null;

    const observer = new ResizeObserver(() => {
      const fit = readFit(element, container);
      setIsClamped(fit.isClamped);
      setLines(fit.lines);
    });

    observer.observe(element);
    if (container !== null) {
      observer.observe(container);
      for (const child of container.children) observer.observe(child);
    }

    return () => observer.disconnect();
  }, [fitTo, text]);

  return { isClamped, lines, ref };
}

function fitLines(element: HTMLElement, container: Nullable<HTMLElement>): number {
  if (container === null) return QUOTE_TEXT_FIT.defaultLines;
  if (!window.matchMedia(QUOTE_TEXT_FIT.from).matches) return QUOTE_TEXT_FIT.defaultLines;

  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return QUOTE_TEXT_FIT.defaultLines;

  const freeSpace = freeSpaceIn(container);
  if (freeSpace === null) return QUOTE_TEXT_FIT.defaultLines;

  return Math.max(1, Math.floor((element.clientHeight + freeSpace) / lineHeight));
}

function freeSpaceIn(container: HTMLElement): Nullable<number> {
  const children = [...container.children];
  if (children.length === 0) return null;

  const style = getComputedStyle(container);
  const contentBottom =
    container.getBoundingClientRect().bottom -
    Number.parseFloat(style.paddingBottom) -
    Number.parseFloat(style.borderBottomWidth);
  const filledTo = children.reduce(
    (lowest, child) => Math.max(lowest, child.getBoundingClientRect().bottom),
    Number.NEGATIVE_INFINITY,
  );

  return contentBottom - filledTo;
}

function readFit(element: HTMLElement, container: Nullable<HTMLElement>): Fit {
  return {
    isClamped: element.scrollHeight > element.clientHeight + QUOTE_TEXT_FIT.overflowTolerancePx,
    lines: fitLines(element, container),
  };
}
