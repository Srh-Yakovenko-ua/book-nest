import type { Nullable } from "@app/shared";

import { defaultUserProfileSettings, StoredLoanReminderLeadDaysSchema } from "@app/shared";
import { formatInTimeZone } from "date-fns-tz";

export type ReminderSettings = {
  borrowedBookReminders: boolean;
  deliveryReminders: boolean;
  loanReminderLeadDays: number;
};

const LOCAL_HOUR_FORMAT = "H";

export function resolveDeliveryEmailPreference(settings: Nullable<ReminderSettings>): boolean {
  return (
    settings?.deliveryReminders ?? defaultUserProfileSettings.emailNotifications.deliveryReminders
  );
}

export function resolveLoanEmailPreference(settings: Nullable<ReminderSettings>): boolean {
  return (
    settings?.borrowedBookReminders ??
    defaultUserProfileSettings.emailNotifications.borrowedBookReminders
  );
}

export function resolveLoanReminderLeadDays(settings: Nullable<ReminderSettings>): number {
  return StoredLoanReminderLeadDaysSchema.parse(
    settings?.loanReminderLeadDays ?? defaultUserProfileSettings.loanReminderLeadDays,
  );
}

export function resolveLocalHour({
  now,
  timezone,
}: {
  now: Date;
  timezone: string;
}): Nullable<number> {
  try {
    const localHour = Number.parseInt(formatInTimeZone(now, timezone, LOCAL_HOUR_FORMAT), 10);
    return Number.isNaN(localHour) ? null : localHour;
  } catch {
    return null;
  }
}

export function resolveManualTestEmailPreference(settings: Nullable<ReminderSettings>): boolean {
  return resolveLoanEmailPreference(settings) || resolveDeliveryEmailPreference(settings);
}
