import type { UserView } from "@app/shared";

import { create } from "zustand";

export type SessionStatus = "authenticated" | "loading" | "unauthenticated";

export type UserIdentity = Pick<UserView, "name" | "nickname">;

type AuthState = {
  accessToken: null | string;
  clearSession: () => void;
  setSession: (accessToken: string, user: UserView) => void;
  setStatus: (status: SessionStatus) => void;
  status: SessionStatus;
  updateUser: (identity: UserIdentity) => void;
  user: null | UserView;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  clearSession: () => set({ accessToken: null, status: "unauthenticated", user: null }),
  setSession: (accessToken, user) => set({ accessToken, status: "authenticated", user }),
  setStatus: (status) => set({ status }),
  status: "loading",
  updateUser: (identity) =>
    set((state) => (state.user === null ? state : { user: { ...state.user, ...identity } })),
  user: null,
}));
