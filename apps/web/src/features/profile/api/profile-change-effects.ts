import type { ProfileView } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { sessionEffects } from "@/features/auth/api/session-effects";

import { profileKeys } from "./profile-keys";

function profileSaved(queryClient: QueryClient, profile: ProfileView): void {
  queryClient.setQueryData(profileKeys.root, profile);
  sessionEffects.identityChanged({ name: profile.name, nickname: profile.nickname });
}

export const profileChangeEffects = { profileSaved };
