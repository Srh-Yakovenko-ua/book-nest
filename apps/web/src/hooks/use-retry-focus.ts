"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useRef, useState } from "react";

type RetryFocusTargetRef = RefObject<Nullable<HTMLElement>>;

export function useRetryFocus(targetRef: RetryFocusTargetRef) {
  const hasRetriedRef = useRef(false);
  const retryButtonElementRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [attachRetryButton] = useState(() => (button: Nullable<HTMLButtonElement>) => {
    retryButtonElementRef.current = button;
    if (button === null || !hasRetriedRef.current) return;
    if (focusStayedOnTarget(targetRef)) button.focus();
  });

  return {
    retryButtonRef: attachRetryButton,
    withRetryFocus: (onRetry: () => void) => () => {
      const retryButton = retryButtonElementRef.current;
      if (retryButton !== null && retryButton === document.activeElement) {
        targetRef.current?.focus();
      }
      hasRetriedRef.current = true;
      onRetry();
    },
  };
}

function focusStayedOnTarget(targetRef: RetryFocusTargetRef) {
  const { activeElement } = document;
  return activeElement === document.body || targetRef.current?.contains(activeElement) === true;
}
