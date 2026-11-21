"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useState } from "react";

const WORKSPACE_WIDTH = {
  compactBelow: 640,
  person: { gap: 12, graphMin: 820, panel: 360 },
  wideFrom: 1180,
} as const;

export type WorkspaceWidthClass = "compact" | "medium" | "wide";

export function toPersonWidthClass(innerWidth: number): WorkspaceWidthClass {
  if (innerWidth < WORKSPACE_WIDTH.compactBelow) return "compact";
  const { gap, graphMin, panel } = WORKSPACE_WIDTH.person;
  return innerWidth >= graphMin + gap + panel ? "wide" : "medium";
}

export function toWorkspaceWidthClass(width: number): WorkspaceWidthClass {
  if (width < WORKSPACE_WIDTH.compactBelow) return "compact";
  return width >= WORKSPACE_WIDTH.wideFrom ? "wide" : "medium";
}

export function useWorkspaceWidthClass(): {
  element: Nullable<HTMLElement>;
  personWidthClass: WorkspaceWidthClass;
  ref: (element: Nullable<HTMLElement>) => void;
  widthClass: WorkspaceWidthClass;
} {
  const [element, setElement] = useState<Nullable<HTMLElement>>(null);
  const [widthClass, setWidthClass] = useState<WorkspaceWidthClass>("medium");
  const [personWidthClass, setPersonWidthClass] = useState<WorkspaceWidthClass>("medium");

  useEffect(() => {
    if (element === null) return;
    const observer = new ResizeObserver(() => {
      const styles = getComputedStyle(element);
      const padding =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      setWidthClass(toWorkspaceWidthClass(element.clientWidth));
      setPersonWidthClass(toPersonWidthClass(element.clientWidth - (padding || 0)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { element, personWidthClass, ref: setElement, widthClass };
}
