import type { UserView } from "@app/shared";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "./auth-store";

const SIGNED_IN_USER: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: "1990-05-17",
  email: "olena@book.nest",
  emailVerified: true,
  id: "user-1",
  name: "Olena",
  nickname: "olena_reads",
  role: "user",
};

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, status: "loading", user: null });
});

describe("useAuthStore updateUser", () => {
  it("replaces the name and nickname and keeps the other user fields", () => {
    useAuthStore.getState().setSession("token-1", SIGNED_IN_USER);

    useAuthStore.getState().updateUser({ name: "Olena Petrenko", nickname: "petrenko" });

    expect(useAuthStore.getState().user).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      dateOfBirth: "1990-05-17",
      email: "olena@book.nest",
      emailVerified: true,
      id: "user-1",
      name: "Olena Petrenko",
      nickname: "petrenko",
      role: "user",
    });
  });

  it("clears the nickname when the update removes it", () => {
    useAuthStore.getState().setSession("token-1", SIGNED_IN_USER);

    useAuthStore.getState().updateUser({ name: "Olena", nickname: null });

    expect(useAuthStore.getState().user?.nickname).toBeNull();
  });

  it("keeps the access token and the session status", () => {
    useAuthStore.getState().setSession("token-1", SIGNED_IN_USER);

    useAuthStore.getState().updateUser({ name: "Olena Petrenko", nickname: "petrenko" });

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "token-1",
      status: "authenticated",
    });
  });

  it("leaves a signed-out session without a user", () => {
    useAuthStore.getState().clearSession();

    useAuthStore.getState().updateUser({ name: "Olena Petrenko", nickname: "petrenko" });

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      status: "unauthenticated",
      user: null,
    });
  });

  it("does not notify subscribers when nobody is signed in", () => {
    const listener = vi.fn();
    const unsubscribe = useAuthStore.subscribe(listener);

    useAuthStore.getState().updateUser({ name: "Olena Petrenko", nickname: "petrenko" });
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});
