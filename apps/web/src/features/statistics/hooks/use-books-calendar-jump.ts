"use client";

import type { Nullable } from "@app/shared";
import type { Ref, RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { isDateInMonth } from "../model/statistics-calendar";

export type BooksCalendarJumpTarget = { date: string; ref: Ref<HTMLButtonElement> };

type BooksCalendarJump = { date: string; requestId: number };

const BOOKS_CALENDAR_JUMP = {
  highlightAttribute: "data-jump-highlight",
  highlightMs: 1600,
  reducedMotionQuery: "(prefers-reduced-motion: reduce)",
} as const;

export function useBooksCalendarJump({
  isCalendarCurrent,
  month,
  sectionRef,
  setMonth,
}: {
  isCalendarCurrent: boolean;
  month: string;
  sectionRef: RefObject<Nullable<HTMLElement>>;
  setMonth: (month: string) => void;
}) {
  const [jump, setJump] = useState<Nullable<BooksCalendarJump>>(null);
  const [observedMonth, setObservedMonth] = useState(month);
  const requestCount = useRef(0);
  const dayRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [mountedDayTarget, setMountedDayTarget] = useState<Nullable<HTMLButtonElement>>(null);
  const [attachDayTarget] = useState(() => (element: Nullable<HTMLButtonElement>) => {
    dayRef.current = element;
    setMountedDayTarget(element);
  });

  if (observedMonth !== month) {
    setObservedMonth(month);
    if (jump !== null && !isDateInMonth(jump.date, month)) setJump(null);
  }

  const readyJump =
    jump !== null && isCalendarCurrent && isDateInMonth(jump.date, month) ? jump : null;
  const readyRequestId = readyJump?.requestId ?? null;

  useEffect(() => {
    if (readyRequestId === null) return;
    const dayTarget = dayRef.current;
    const target = dayTarget ?? sectionRef.current;
    if (target === null) return;
    const isMotionReduced = window.matchMedia(BOOKS_CALENDAR_JUMP.reducedMotionQuery).matches;
    target.scrollIntoView({
      behavior: isMotionReduced ? "auto" : "smooth",
      block: dayTarget === null ? "start" : "center",
    });
    target.focus({ preventScroll: true });
    target.toggleAttribute(BOOKS_CALENDAR_JUMP.highlightAttribute, true);
    const highlightTimer = window.setTimeout(() => setJump(null), BOOKS_CALENDAR_JUMP.highlightMs);
    return () => {
      window.clearTimeout(highlightTimer);
      target.toggleAttribute(BOOKS_CALENDAR_JUMP.highlightAttribute, false);
    };
  }, [mountedDayTarget, readyRequestId, sectionRef]);

  return {
    dayTarget: readyJump === null ? null : { date: readyJump.date, ref: attachDayTarget },
    showInBooksCalendar: (date: string) => {
      const targetMonth = date.slice(0, 7);
      if (targetMonth !== month) setMonth(targetMonth);
      requestCount.current += 1;
      setJump({ date, requestId: requestCount.current });
    },
  };
}
