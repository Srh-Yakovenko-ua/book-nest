"use client";

import { useAuthStore } from "../model/auth-store";

type GuardedSession =
  { kind: "checking" } | { kind: "signed-in"; userId: string } | { kind: "signed-out" };

export function useGuardedSession(): GuardedSession {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  if (status === "unauthenticated") return { kind: "signed-out" };
  if (status === "loading" || userId === null) return { kind: "checking" };
  return { kind: "signed-in", userId };
}
