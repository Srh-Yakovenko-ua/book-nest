"use client";

import { useQueryStates } from "nuqs";
import { useEffect, useEffectEvent } from "react";

import { useProfileTimeZone } from "@/features/settings";

import {
  defaultReadingCalendarMonth,
  parseReadingCalendarMonth,
  parseReadingCalendarYear,
  readingCalendarCurrentYear,
  readingCalendarParsers,
} from "./reading-calendar-params";
import { todayIsoDay } from "./statistics-period";

export type UseReadingCalendarParamsResult = {
  currentYear: number;
  month: string;
  setMonth: (month: string) => void;
  setYear: (year: number) => void;
  today: string;
  year: number;
};

export function useReadingCalendarParams(): UseReadingCalendarParamsResult {
  const [params, setParams] = useQueryStates(readingCalendarParsers, { history: "push" });
  const today = todayIsoDay(useProfileTimeZone());
  const currentYear = readingCalendarCurrentYear(today);
  const requestedYear =
    params.year === null ? null : parseReadingCalendarYear({ currentYear, value: params.year });
  const year = requestedYear ?? currentYear;
  const requestedMonth =
    params.month === null ? null : parseReadingCalendarMonth({ today, value: params.month, year });
  const isYearInvalid = params.year !== null && requestedYear === null;
  const isMonthInvalid = params.month !== null && requestedMonth === null;

  const dropInvalidParams = useEffectEvent(() => {
    void setParams(
      {
        ...(isYearInvalid ? { year: null } : {}),
        ...(isMonthInvalid ? { month: null } : {}),
      },
      { history: "replace" },
    );
  });

  useEffect(() => {
    if (isYearInvalid || isMonthInvalid) dropInvalidParams();
  }, [isMonthInvalid, isYearInvalid, params.month, params.year]);

  return {
    currentYear,
    month: requestedMonth ?? defaultReadingCalendarMonth({ today, year }),
    setMonth: (month) => void setParams({ month }),
    setYear: (nextYear) => void setParams({ month: null, year: String(nextYear) }),
    today,
    year,
  };
}
