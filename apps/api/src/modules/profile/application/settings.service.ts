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
  const { emailNotifications, ...columns } = input;

  return { ...columns, ...emailNotifications };
}
