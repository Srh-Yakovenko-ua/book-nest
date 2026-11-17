import type { UserView } from "@app/shared";

import { act, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/books",
  useRouter: () => router,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { useAuthStore } from "../model/auth-store";
import { AuthGuard } from "./auth-guard";

const readers = {
  first: {
    createdAt: "2026-01-01T00:00:00.000Z",
    dateOfBirth: null,
    email: "first-reader@book.nest",
    emailVerified: true,
    id: "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b",
    name: "First Reader",
    nickname: null,
    role: "user",
  },
  second: {
    createdAt: "2026-02-01T00:00:00.000Z",
    dateOfBirth: null,
    email: "second-reader@book.nest",
    emailVerified: true,
    id: "0b7e9d4c-3f2a-4c1b-8d5e-7a6f5e4d3c2b",
    name: "Second Reader",
    nickname: null,
    role: "user",
  },
} satisfies Record<string, UserView>;

const probe = { mount: vi.fn(), unmount: vi.fn() };

function DraftProbe() {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    probe.mount();
    return () => {
      probe.unmount();
    };
  }, []);

  return (
    <input aria-label="Draft" onChange={(event) => setDraft(event.target.value)} value={draft} />
  );
}

function mountGuardedProbe() {
  renderWithProviders(
    <AuthGuard>
      <DraftProbe />
    </AuthGuard>,
  );
}

beforeEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard", () => {
  it("starts the signed-in content afresh when another reader signs in", async () => {
    mountGuardedProbe();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    await userEvent.type(screen.getByRole("textbox", { name: "Draft" }), "draft");

    act(() => useAuthStore.getState().setSession("token-b", readers.second));

    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("");
    expect(probe.mount).toHaveBeenCalledTimes(2);
    expect(probe.unmount).toHaveBeenCalledTimes(1);
  });

  it("mounts the content once when the session check resolves to a reader", () => {
    mountGuardedProbe();

    act(() => useAuthStore.getState().setSession("token-a", readers.first));

    expect(screen.getByRole("textbox", { name: "Draft" })).toBeInTheDocument();
    expect(probe.mount).toHaveBeenCalledTimes(1);
    expect(probe.unmount).not.toHaveBeenCalled();
  });

  it("removes the content and sends the reader to login when the session ends", () => {
    mountGuardedProbe();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));

    act(() => useAuthStore.getState().clearSession());

    expect(screen.queryByRole("textbox", { name: "Draft" })).not.toBeInTheDocument();
    expect(probe.mount).toHaveBeenCalledTimes(1);
    expect(probe.unmount).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/login?from=%2Fbooks");
  });

  it("keeps the unsaved input when the same reader gets a rotated token", async () => {
    mountGuardedProbe();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    await userEvent.type(screen.getByRole("textbox", { name: "Draft" }), "draft");

    act(() => useAuthStore.getState().setSession("token-a-rotated", { ...readers.first }));

    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("draft");
    expect(probe.mount).toHaveBeenCalledTimes(1);
  });
});
