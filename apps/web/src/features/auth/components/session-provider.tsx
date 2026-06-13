"use client";

import { type ReactNode, useEffect, useRef } from "react";

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

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
