"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useLayoutEffect, useRef, useState } from "react";

const OVERFLOW_TOLERANCE_PX = 1;

type ClampedText<TElement extends HTMLElement> = {
  isClamped: boolean;
  ref: RefObject<Nullable<TElement>>;
};

export function useIsTextClamped<TElement extends HTMLElement>(
  text: string,
): ClampedText<TElement> {
  const ref = useRef<Nullable<TElement>>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const measure = () => {
      setIsClamped(element.scrollHeight > element.clientHeight + OVERFLOW_TOLERANCE_PX);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [text]);

  return { isClamped, ref };
}
