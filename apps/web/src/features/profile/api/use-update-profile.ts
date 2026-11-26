import type { ProfileView, UpdateProfileInput } from "@app/shared";

import { ProfileViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileControllerUpdateProfile } from "@/shared/api/generated/endpoints/profile/profile";

import { profileChangeEffects } from "./profile-change-effects";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<ProfileView> =>
      ProfileViewSchema.parse(await profileControllerUpdateProfile(input)),
    onSuccess: (profile) => {
      profileChangeEffects.profileSaved(queryClient, profile);
    },
  });
}
