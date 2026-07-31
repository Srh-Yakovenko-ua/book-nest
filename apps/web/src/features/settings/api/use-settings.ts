import type { SettingsView } from "@app/shared";

import { SettingsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { settingsControllerGetSettings } from "@/shared/api/generated/endpoints/profile/profile";

import { settingsKeys } from "./settings-keys";

export function useSettings() {
  return useQuery({
    queryFn: async ({ signal }): Promise<SettingsView> =>
      SettingsViewSchema.parse(await settingsControllerGetSettings({ signal })),
    queryKey: settingsKeys.root,
  });
}
