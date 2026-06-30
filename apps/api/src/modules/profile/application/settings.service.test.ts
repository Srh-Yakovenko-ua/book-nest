import type { UpdateSettingsInput } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";
import type { SettingsRepository } from "../infrastructure/settings.repository.js";

import { SettingsService } from "./settings.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildService(overrides: { findByUserId?: null | UserProfileSettingsModel } = {}): {
  repository: {
    findByUserId: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  service: SettingsService;
} {
  const repository = {
    findByUserId: vi.fn().mockResolvedValue(overrides.findByUserId ?? null),
    upsert: vi.fn().mockResolvedValue(settingsRow()),
  };

  const service = new SettingsService(repository as unknown as SettingsRepository);

  return { repository, service };
}

function settingsRow(overrides: Partial<UserProfileSettingsModel> = {}): UserProfileSettingsModel {
  return {
    accentColor: "green",
    borrowedBookReminders: true,
    confirmBeforeDelete: false,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dateFormat: "YYYY-MM-DD",
    deliveryReminders: false,
    id: "22222222-2222-4222-8222-222222222222",
    language: "en",
    libraryViewMode: "list",
    monthlyReadingReport: true,
    readingGoalReminders: true,
    readingReminders: true,
    themeMode: "dark",
    timezone: "Europe/London",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    weeklyReadingSummary: true,
    weekStartDay: "monday",
    ...overrides,
  };
}

describe("SettingsService.getSettings", () => {
  it("returns the defaults unchanged when no row exists", async () => {
    const { service } = buildService({ findByUserId: null });

    const result = await service.getSettings(USER_ID);

    expect(result).toEqual(defaultUserProfileSettings);
  });

  it("does not write when no row exists", async () => {
    const { repository, service } = buildService({ findByUserId: null });

    await service.getSettings(USER_ID);

    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("maps an existing row to the SettingsView shape", async () => {
    const { service } = buildService({ findByUserId: settingsRow() });

    const result = await service.getSettings(USER_ID);

    expect(result).toEqual({
      accentColor: "green",
      confirmBeforeDelete: false,
      dateFormat: "YYYY-MM-DD",
      emailNotifications: {
        borrowedBookReminders: true,
        deliveryReminders: false,
        monthlyReadingReport: true,
        readingGoalReminders: true,
        readingReminders: true,
        weeklyReadingSummary: true,
      },
      language: "en",
      libraryViewMode: "list",
      themeMode: "dark",
      timezone: "Europe/London",
      weekStartDay: "monday",
    });
  });

  it("does not expose id, userId, createdAt or updatedAt", async () => {
    const { service } = buildService({ findByUserId: settingsRow() });

    const result = await service.getSettings(USER_ID);

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
  });
});

describe("SettingsService.updateSettings", () => {
  it("flattens a partial emailNotifications into only the provided boolean column", async () => {
    const { repository, service } = buildService();
    const input: UpdateSettingsInput = { emailNotifications: { weeklyReadingSummary: true } };

    await service.updateSettings(USER_ID, input);

    expect(repository.upsert).toHaveBeenCalledWith(USER_ID, { weeklyReadingSummary: true });
  });

  it("applies only present top-level keys and omits undefined ones", async () => {
    const { repository, service } = buildService();
    const input: UpdateSettingsInput = { accentColor: "blue", themeMode: "light" };

    await service.updateSettings(USER_ID, input);

    expect(repository.upsert).toHaveBeenCalledWith(USER_ID, {
      accentColor: "blue",
      themeMode: "light",
    });
  });

  it("returns the mapped SettingsView from the upserted row", async () => {
    const { service } = buildService();

    const result = await service.updateSettings(USER_ID, { themeMode: "dark" });

    expect(result).toEqual({
      accentColor: "green",
      confirmBeforeDelete: false,
      dateFormat: "YYYY-MM-DD",
      emailNotifications: {
        borrowedBookReminders: true,
        deliveryReminders: false,
        monthlyReadingReport: true,
        readingGoalReminders: true,
        readingReminders: true,
        weeklyReadingSummary: true,
      },
      language: "en",
      libraryViewMode: "list",
      themeMode: "dark",
      timezone: "Europe/London",
      weekStartDay: "monday",
    });
  });

  it("combines a top-level key and a nested partial in a single upsert payload", async () => {
    const { repository, service } = buildService();
    const input: UpdateSettingsInput = {
      emailNotifications: { deliveryReminders: false },
      themeMode: "dark",
    };

    await service.updateSettings(USER_ID, input);

    expect(repository.upsert).toHaveBeenCalledWith(USER_ID, {
      deliveryReminders: false,
      themeMode: "dark",
    });
  });
});
