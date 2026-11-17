"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useLayoutEffect, useRef } from "react";

const COMMAND_INPUT_SELECTOR = "[cmdk-input]";

export function useCommandInputExpanded({
  anchorRef,
  expanded,
}: {
  anchorRef: RefObject<Nullable<HTMLElement>>;
  expanded: boolean;
}) {
  const listIdRef = useRef<Nullable<string>>(null);

  useLayoutEffect(() => {
    const input = anchorRef.current?.querySelector(COMMAND_INPUT_SELECTOR);
    if (input === null || input === undefined) return;
    listIdRef.current ??= input.getAttribute("aria-controls");
    input.setAttribute("aria-expanded", String(expanded));
    if (expanded && listIdRef.current !== null) {
      input.setAttribute("aria-controls", listIdRef.current);
      return;
    }
    input.removeAttribute("aria-controls");
  }, [anchorRef, expanded]);
}
