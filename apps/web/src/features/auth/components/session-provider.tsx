"use client";

import { type ReactNode, useEffect } from "react";

import { registerAuthBridge } from "@/lib/auth-bridge";

import { singleFlightRefresh } from "../lib/single-flight-refresh";
import { useAuthStore } from "../model/auth-store";

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onRefreshFailed: () => useAuthStore.getState().clearSession(),
  refresh: singleFlightRefresh,
});

let bootstrapped = false;

export function SessionProvider({ children }: { children: ReactNode }) {
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
