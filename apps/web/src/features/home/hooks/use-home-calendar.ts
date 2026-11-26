"use client";

import type { Nullable } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useProfileTimeZone, useSettings, useWeekStartsOn } from "@/features/settings";

import type { HomeCalendar } from "../model/home-calendar";

import { homeDayChangeEffects } from "../api/home-day-change-effects";
import {
  homeCalendar,
  isSameCalendarSlot,
  millisecondsUntilNextBoundary,
} from "../model/home-calendar";

export function useHomeCalendar(): HomeCalendar {
  const profileTimeZone = useProfileTimeZone();
  const weekStartsOn = useWeekStartsOn();
  const settings = useSettings();
  const hasResolvedSettings = !settings.isPending;
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const calendar = homeCalendar({ now, timeZone: profileTimeZone, weekStartsOn });
  const { timeZone } = calendar;
  const datedPeriod = `${calendar.today}:${calendar.weekStart}`;
  const observedPeriod = useRef<Nullable<string>>(hasResolvedSettings ? datedPeriod : null);

  const refreshOnReturn = useEffectEvent(() => {
    const current = new Date();
    setNow((previous) =>
      isSameCalendarSlot({ left: previous, right: current, timeZone }) ? previous : current,
    );
  });

  useEffect(() => {
    const current = new Date();
    const delay = isSameCalendarSlot({ left: now, right: current, timeZone })
      ? millisecondsUntilNextBoundary({ now: current, timeZone })
      : 0;
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [now, timeZone]);

  useEffect(() => {
    const onFocus = () => refreshOnReturn();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOnReturn();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!hasResolvedSettings) return;
    const previousPeriod = observedPeriod.current;
    observedPeriod.current = datedPeriod;
    if (previousPeriod === null || previousPeriod === datedPeriod) return;
    void homeDayChangeEffects.localDayChanged(queryClient);
  }, [datedPeriod, hasResolvedSettings, queryClient]);

  return calendar;
}
