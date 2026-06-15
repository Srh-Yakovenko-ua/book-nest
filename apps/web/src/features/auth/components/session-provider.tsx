"use client";

import { type ReactNode, useEffect } from "react";

import { registerAuthBridge } from "@/lib/auth-bridge";

import { refreshSession } from "../api/session";
import { useAuthStore } from "../model/auth-store";

registerAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onRefreshFailed: () => useAuthStore.getState().clearSession(),
  refresh: async () => {
    const result = await refreshSession();
    useAuthStore.getState().setSession(result.accessToken, result.user);
    return result.accessToken;
  },
});

let bootstrapped = false;

export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    const { clearSession, setSession, setStatus } = useAuthStore.getState();
    setStatus("loading");

    void refreshSession()
      .then((result) => setSession(result.accessToken, result.user))
      .catch(() => clearSession());
  }, []);

  return children;
}

export function useSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return { accessToken, status, user };
}
