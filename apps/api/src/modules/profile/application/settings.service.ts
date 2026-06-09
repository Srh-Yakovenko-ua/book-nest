import {
  defaultUserProfileSettings,
  type SettingsView,
  type UpdateSettingsInput,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { toSettingsView } from "../domain/settings.mapper.js";
import { SettingsRepository } from "../infrastructure/settings.repository.js";

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(userId: string): Promise<SettingsView> {
    const settings = await this.settingsRepository.findByUserId(userId);
    if (settings === null) {
      return defaultUserProfileSettings;
    }

    return toSettingsView(settings);
  }

  async updateSettings(userId: string, input: UpdateSettingsInput): Promise<SettingsView> {
    const updated = await this.settingsRepository.upsert(userId, buildUpsertData(input));

    return toSettingsView(updated);
  }
}

function buildUpsertData(
  input: UpdateSettingsInput,
): Omit<Prisma.UserProfileSettingsUncheckedCreateInput, "userId"> {
  const data: Omit<Prisma.UserProfileSettingsUncheckedCreateInput, "userId"> = {};

  if (input.themeMode !== undefined) data.themeMode = input.themeMode;
  if (input.accentColor !== undefined) data.accentColor = input.accentColor;
  if (input.language !== undefined) data.language = input.language;
  if (input.dateFormat !== undefined) data.dateFormat = input.dateFormat;
  if (input.weekStartDay !== undefined) data.weekStartDay = input.weekStartDay;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.libraryViewMode !== undefined) data.libraryViewMode = input.libraryViewMode;
  if (input.confirmBeforeDelete !== undefined) data.confirmBeforeDelete = input.confirmBeforeDelete;

  const notifications = input.emailNotifications;
  if (notifications !== undefined) {
    if (notifications.readingReminders !== undefined)
      data.readingReminders = notifications.readingReminders;
    if (notifications.readingGoalReminders !== undefined)
      data.readingGoalReminders = notifications.readingGoalReminders;
    if (notifications.borrowedBookReminders !== undefined)
      data.borrowedBookReminders = notifications.borrowedBookReminders;
    if (notifications.deliveryReminders !== undefined)
      data.deliveryReminders = notifications.deliveryReminders;
    if (notifications.weeklyReadingSummary !== undefined)
      data.weeklyReadingSummary = notifications.weeklyReadingSummary;
    if (notifications.monthlyReadingReport !== undefined)
      data.monthlyReadingReport = notifications.monthlyReadingReport;
  }

  return data;
}
