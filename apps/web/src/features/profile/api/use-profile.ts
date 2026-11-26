import type { ProfileView } from "@app/shared";

import { ProfileViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { profileControllerGetProfile } from "@/shared/api/generated/endpoints/profile/profile";

import { profileKeys } from "./profile-keys";

export function useProfile() {
  return useQuery({
    queryFn: async ({ signal }): Promise<ProfileView> =>
      ProfileViewSchema.parse(await profileControllerGetProfile({ signal })),
    queryKey: profileKeys.root,
  });
}
