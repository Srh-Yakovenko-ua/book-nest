import type { UserView } from "@app/shared";

import { create } from "zustand";

export type SessionStatus = "authenticated" | "loading" | "unauthenticated";

type AuthState = {
  accessToken: null | string;
  clearSession: () => void;
  setSession: (accessToken: string, user: UserView) => void;
  setStatus: (status: SessionStatus) => void;
  status: SessionStatus;
  user: null | UserView;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  clearSession: () => set({ accessToken: null, status: "unauthenticated", user: null }),
  setSession: (accessToken, user) => set({ accessToken, status: "authenticated", user }),
  setStatus: (status) => set({ status }),
  status: "loading",
  user: null,
}));
