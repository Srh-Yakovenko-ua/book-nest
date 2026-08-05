import { type SettingsView, SettingsViewSchema } from "@app/shared";

import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";

export function toSettingsView(settings: UserProfileSettingsModel): SettingsView {
  return SettingsViewSchema.parse({
    accentColor: settings.accentColor,
    confirmBeforeDelete: settings.confirmBeforeDelete,
    dateFormat: settings.dateFormat,
    emailNotifications: {
      borrowedBookReminders: settings.borrowedBookReminders,
      deliveryReminders: settings.deliveryReminders,
      monthlyReadingReport: settings.monthlyReadingReport,
      readingGoalReminders: settings.readingGoalReminders,
      readingReminders: settings.readingReminders,
      weeklyReadingSummary: settings.weeklyReadingSummary,
    },
    language: settings.language,
    libraryViewMode: settings.libraryViewMode,
    loanReminderLeadDays: settings.loanReminderLeadDays,
    themeMode: settings.themeMode,
    timezone: settings.timezone,
    weekStartDay: settings.weekStartDay,
  });
}
