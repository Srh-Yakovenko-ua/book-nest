"use client";

import type { ValueOf } from "@app/shared";

import { defaultUserProfileSettings, WEEK_STARTS_ON } from "@app/shared";

import { useSettings } from "../api/use-settings";

export type WeekStartsOn = ValueOf<typeof WEEK_STARTS_ON>;

export function useWeekStartsOn(): WeekStartsOn {
  const settings = useSettings();
  const weekStartDay = settings.data?.weekStartDay ?? defaultUserProfileSettings.weekStartDay;

  return WEEK_STARTS_ON[weekStartDay];
}
