"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";
import { useEffect, useEffectEvent } from "react";

import { useProfileTimeZone } from "@/features/settings";
import { todayIsoDay } from "@/lib/iso-day";

import {
  defaultReadingCalendarMonth,
  parseReadingCalendarDay,
  parseReadingCalendarMonth,
  parseReadingCalendarYear,
  readingCalendarCurrentYear,
  readingCalendarParsers,
  toMonthKey,
} from "./reading-calendar-params";

export type UseReadingCalendarParamsResult = {
  currentYear: number;
  day: Nullable<string>;
  month: string;
  selectDay: (date: string) => void;
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
  const month = requestedMonth ?? defaultReadingCalendarMonth({ today, year });
  const requestedDay =
    params.day === null ? null : parseReadingCalendarDay({ month, today, value: params.day });
  const isYearInvalid = params.year !== null && requestedYear === null;
  const isMonthInvalid = params.month !== null && requestedMonth === null;
  const isDayInvalid = params.day !== null && requestedDay === null;

  const dropInvalidParams = useEffectEvent(() => {
    void setParams(
      {
        ...(isYearInvalid ? { year: null } : {}),
        ...(isMonthInvalid ? { month: null } : {}),
        ...(isDayInvalid ? { day: null } : {}),
      },
      { history: "replace" },
    );
  });

  useEffect(() => {
    if (isYearInvalid || isMonthInvalid || isDayInvalid) dropInvalidParams();
  }, [isDayInvalid, isMonthInvalid, isYearInvalid, params.day, params.month, params.year]);

  return {
    currentYear,
    day: requestedDay,
    month,
    selectDay: (date) => {
      const dayMonth = toMonthKey(date);
      void setParams(
        { day: date, month: dayMonth },
        { history: dayMonth === month ? "replace" : "push" },
      );
    },
    setMonth: (nextMonth) => void setParams({ day: null, month: nextMonth }),
    setYear: (nextYear) => void setParams({ day: null, month: null, year: String(nextYear) }),
    today,
    year,
  };
}
