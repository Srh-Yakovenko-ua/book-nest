import type { UserIdentity } from "../model/auth-store";

import { useAuthStore } from "../model/auth-store";

function identityChanged(identity: UserIdentity): void {
  useAuthStore.getState().updateUser(identity);
}

export const sessionEffects = { identityChanged };
