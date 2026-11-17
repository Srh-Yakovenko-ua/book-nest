import type { SettingsView, UpdateSettingsInput } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { settingsKeys } from "./settings-keys";

const READER_DAY_FIELDS = [
  "timezone",
  "weekStartDay",
] as const satisfies readonly (keyof UpdateSettingsInput)[];

async function settingsSaved(
  queryClient: QueryClient,
  { input, settings }: { input: UpdateSettingsInput; settings: SettingsView },
): Promise<void> {
  queryClient.setQueryData(settingsKeys.root, settings);

  const movesReaderDays = READER_DAY_FIELDS.some((field) => input[field] !== undefined);
  if (!movesReaderDays) return;

  const matchesSettings = matchesAnyKeyPrefix(settingsKeys.root);
  await queryClient.invalidateQueries({ predicate: (query) => !matchesSettings(query) });
}

export const settingsChangeEffects = { settingsSaved };
