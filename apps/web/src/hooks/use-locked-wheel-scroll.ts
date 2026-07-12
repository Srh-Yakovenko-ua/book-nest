"use client";

import { useCallback, useEffect, useRef } from "react";

const WHEEL_LINE_HEIGHT_PX = 16;

export function useLockedWheelScroll(onAfterScroll?: () => void) {
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const onAfterScrollRef = useRef(onAfterScroll);

  useEffect(() => {
    onAfterScrollRef.current = onAfterScroll;
  });

  const handleWheel = useCallback((event: WheelEvent) => {
    const element = scrollElementRef.current;
    if (element === null) return;
    event.preventDefault();
    const step = event.deltaMode === 1 ? event.deltaY * WHEEL_LINE_HEIGHT_PX : event.deltaY;
    element.scrollTop += step;
    onAfterScrollRef.current?.();
  }, []);

  return useCallback(
    (element: HTMLDivElement | null) => {
      const previous = scrollElementRef.current;
      if (previous !== null) previous.removeEventListener("wheel", handleWheel);
      scrollElementRef.current = element;
      if (element === null) return;
      element.addEventListener("wheel", handleWheel, { passive: false });
    },
    [handleWheel],
  );
}
