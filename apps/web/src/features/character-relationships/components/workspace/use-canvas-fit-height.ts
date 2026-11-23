"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useEffect, useLayoutEffect, useRef } from "react";

import { toCanvasFitHeight } from "../../model/workspace/graph-canvas-fit";

export function useCanvasFitHeight(enabled: boolean): RefObject<Nullable<HTMLDivElement>> {
  const elementRef = useRef<Nullable<HTMLDivElement>>(null);

  useLayoutEffect(() => {
    applyFitHeight({ element: elementRef.current, enabled });
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || element === null) return;
    let frame: Nullable<number> = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        applyFitHeight({ element, enabled: true });
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  return elementRef;
}

function applyFitHeight({
  element,
  enabled,
}: {
  element: Nullable<HTMLElement>;
  enabled: boolean;
}): void {
  if (element === null) return;
  if (!enabled) {
    element.style.removeProperty("height");
    return;
  }
  const height = `${measureFitHeight(element)}px`;
  if (element.style.height !== height) element.style.height = height;
}

function findScrollRoot(element: HTMLElement): Nullable<HTMLElement> {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node === document.body) return null;
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

function measureFitHeight(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const root = findScrollRoot(element);
  if (root === null) {
    return toCanvasFitHeight({
      contained: false,
      offsetTop: rect.top + window.scrollY,
      paddingBottom: 0,
      viewportHeight: window.innerHeight,
    });
  }
  return toCanvasFitHeight({
    contained: true,
    offsetTop: rect.top - root.getBoundingClientRect().top + root.scrollTop,
    paddingBottom: Number.parseFloat(getComputedStyle(root).paddingBottom) || 0,
    viewportHeight: root.clientHeight,
  });
}
