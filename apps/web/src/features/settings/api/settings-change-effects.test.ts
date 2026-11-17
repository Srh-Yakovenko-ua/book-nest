import type { SettingsView, UpdateSettingsInput } from "@app/shared";
import type { QueryKey } from "@tanstack/react-query";

import { defaultUserProfileSettings } from "@app/shared";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { deliveryKeys } from "@/features/delivery/api/delivery-keys";
import { loanKeys } from "@/features/loans/api/loan-keys";
import { goalKeys } from "@/features/reading-goals/api/goal-keys";
import { statisticsKeys } from "@/features/statistics/api/statistics-keys";
import { staleFlags } from "@/test-query-cache";

import { settingsChangeEffects } from "./settings-change-effects";
import { settingsKeys } from "./settings-keys";

const SAVES = {
  accentColor: {
    input: { accentColor: "green" },
    settings: { ...defaultUserProfileSettings, accentColor: "green" },
  },
  timezone: {
    input: { timezone: "America/New_York" },
    settings: { ...defaultUserProfileSettings, timezone: "America/New_York" },
  },
  weekStartDay: {
    input: { weekStartDay: "sunday" },
    settings: { ...defaultUserProfileSettings, weekStartDay: "sunday" },
  },
} as const satisfies Record<string, { input: UpdateSettingsInput; settings: SettingsView }>;

const DEPENDENT_KEYS = [
  statisticsKeys.overview({ year: 2026 }),
  deliveryKeys.inTransit.summary,
  loanKeys.summary,
  goalKeys.overview,
  ["/api/books", "list", { page: 1 }],
] as const satisfies readonly QueryKey[];

function seededClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(settingsKeys.root, defaultUserProfileSettings);
  for (const key of DEPENDENT_KEYS) client.setQueryData(key, {});
  return client;
}

describe("settingsChangeEffects", () => {
  it.each(["accentColor", "timezone", "weekStartDay"] as const)(
    "stores the returned settings as fresh after a %s save",
    async (field) => {
      const client = seededClient();

      await settingsChangeEffects.settingsSaved(client, SAVES[field]);

      expect(client.getQueryData(settingsKeys.root)).toEqual(SAVES[field].settings);
      expect(staleFlags(client, [settingsKeys.root])).toEqual([false]);
    },
  );

  it.each(["timezone", "weekStartDay"] as const)(
    "refreshes statistics, deliveries, loans, goals and books after a %s save",
    async (field) => {
      const client = seededClient();

      await settingsChangeEffects.settingsSaved(client, SAVES[field]);

      expect(staleFlags(client, DEPENDENT_KEYS)).toEqual([true, true, true, true, true]);
    },
  );

  it("leaves statistics, deliveries, loans, goals and books fresh after an accent color save", async () => {
    const client = seededClient();

    await settingsChangeEffects.settingsSaved(client, SAVES.accentColor);

    expect(staleFlags(client, DEPENDENT_KEYS)).toEqual([false, false, false, false, false]);
  });
});
