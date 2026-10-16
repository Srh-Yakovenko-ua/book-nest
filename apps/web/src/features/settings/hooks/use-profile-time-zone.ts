"use client";

import { defaultUserProfileSettings } from "@app/shared";

import { useSettings } from "../api/use-settings";

export function useProfileTimeZone(): string {
  const settings = useSettings();

  return settings.data?.timezone ?? defaultUserProfileSettings.timezone;
}
