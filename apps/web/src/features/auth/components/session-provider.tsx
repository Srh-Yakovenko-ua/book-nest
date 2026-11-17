"use client";

import { type ReactNode, useEffect } from "react";

import { registerAuthBridge } from "@/lib/auth-bridge";

import { useClearPreviousUserState } from "../hooks/use-clear-previous-user-state";
import { singleFlightRefresh } from "../lib/single-flight-refresh";
import { useAuthStore } from "../model/auth-store";

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getUserId: () => useAuthStore.getState().user?.id ?? null,
  onRefreshFailed: () => useAuthStore.getState().clearSession(),
  refresh: singleFlightRefresh,
});

let bootstrapped = false;

export function SessionProvider({ children }: { children: ReactNode }) {
  useClearPreviousUserState();

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    const { clearSession, setStatus } = useAuthStore.getState();
    setStatus("loading");

    void singleFlightRefresh().catch(() => clearSession());
  }, []);

  return children;
}

export function useSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return { accessToken, status, user };
}
