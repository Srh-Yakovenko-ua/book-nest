import type { SettingsView, UpdateSettingsInput } from "@app/shared";

import { SettingsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { settingsControllerUpdateSettings } from "@/shared/api/generated/endpoints/profile/profile";

import { settingsChangeEffects } from "./settings-change-effects";

const SETTINGS_SAVE_SCOPE = { id: "settings-save" } as const;

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSettingsInput): Promise<SettingsView> =>
      SettingsViewSchema.parse(await settingsControllerUpdateSettings(input)),
    onSuccess: (settings, input) => {
      void settingsChangeEffects.settingsSaved(queryClient, { input, settings });
    },
    scope: SETTINGS_SAVE_SCOPE,
  });
}
