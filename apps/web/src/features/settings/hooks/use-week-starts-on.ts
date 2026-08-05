"use client";

import type { WeekStartDay } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";

import { useSettings } from "../api/use-settings";

export type WeekStartsOn = 0 | 1;

const WEEK_STARTS_ON: Record<WeekStartDay, WeekStartsOn> = {
  monday: 1,
  sunday: 0,
};

export function useWeekStartsOn(): WeekStartsOn {
  const settings = useSettings();
  const weekStartDay = settings.data?.weekStartDay ?? defaultUserProfileSettings.weekStartDay;

  return WEEK_STARTS_ON[weekStartDay];
}
