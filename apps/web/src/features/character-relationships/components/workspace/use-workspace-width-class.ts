"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useState } from "react";

const WORKSPACE_WIDTH = {
  compactBelow: 640,
  wideFrom: 1180,
} as const;

export type WorkspaceWidthClass = "compact" | "medium" | "wide";

export function toWorkspaceWidthClass(width: number): WorkspaceWidthClass {
  if (width < WORKSPACE_WIDTH.compactBelow) return "compact";
  return width >= WORKSPACE_WIDTH.wideFrom ? "wide" : "medium";
}

export function useWorkspaceWidthClass(): {
  element: Nullable<HTMLElement>;
  ref: (element: Nullable<HTMLElement>) => void;
  widthClass: WorkspaceWidthClass;
} {
  const [element, setElement] = useState<Nullable<HTMLElement>>(null);
  const [widthClass, setWidthClass] = useState<WorkspaceWidthClass>("medium");

  useEffect(() => {
    if (element === null) return;
    const observer = new ResizeObserver(() =>
      setWidthClass(toWorkspaceWidthClass(element.clientWidth)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { element, ref: setElement, widthClass };
}
