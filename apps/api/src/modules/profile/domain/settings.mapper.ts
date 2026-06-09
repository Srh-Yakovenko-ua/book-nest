import {
  AccentColorSchema,
  DateFormatSchema,
  InterfaceLanguageSchema,
  LibraryViewModeSchema,
  type SettingsView,
  ThemeModeSchema,
  WeekStartDaySchema,
} from "@app/shared";

import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";

export function toSettingsView(settings: UserProfileSettingsModel): SettingsView {
  return {
    accentColor: AccentColorSchema.parse(settings.accentColor),
    confirmBeforeDelete: settings.confirmBeforeDelete,
    dateFormat: DateFormatSchema.parse(settings.dateFormat),
    emailNotifications: {
      borrowedBookReminders: settings.borrowedBookReminders,
      deliveryReminders: settings.deliveryReminders,
      monthlyReadingReport: settings.monthlyReadingReport,
      readingGoalReminders: settings.readingGoalReminders,
      readingReminders: settings.readingReminders,
      weeklyReadingSummary: settings.weeklyReadingSummary,
    },
    language: InterfaceLanguageSchema.parse(settings.language),
    libraryViewMode: LibraryViewModeSchema.parse(settings.libraryViewMode),
    themeMode: ThemeModeSchema.parse(settings.themeMode),
    timezone: settings.timezone,
    weekStartDay: WeekStartDaySchema.parse(settings.weekStartDay),
  };
}
