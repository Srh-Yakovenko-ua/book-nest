import type { UserView } from "@app/shared";

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/features/auth";
import { renderWithProviders } from "@/test-utils";

import { BookFormDraftCleanup } from "../components/book-form-draft-cleanup";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const DRAFT_KEYS = {
  legacyCreate: "book-form-draft:create",
  legacyEdit: "book-form-draft:edit:book-1",
  userACreate: "book-form-draft:user:user-a:create",
  userBCreate: "book-form-draft:user:user-b:create",
} as const;

const UNRELATED_KEY = "theme";

const READERS = {
  a: reader({ email: "a@book-nest.net", id: "user-a" }),
  b: reader({ email: "b@book-nest.net", id: "user-b" }),
};

function reader({ email, id }: { email: string; id: string }): UserView {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    dateOfBirth: null,
    email,
    emailVerified: true,
    id,
    name: "Reader",
    nickname: null,
    role: "user",
  };
}

function seedDrafts(...keys: string[]) {
  for (const key of keys) sessionStorage.setItem(key, "{}");
}

function seedEveryDraftAndUnrelatedKey() {
  seedDrafts(...Object.values(DRAFT_KEYS));
  sessionStorage.setItem(UNRELATED_KEY, "dark");
}

function signIn(user: UserView, accessToken = "access-token") {
  useAuthStore.getState().setSession(accessToken, user);
}

function signOut() {
  useAuthStore.getState().clearSession();
}

function storedKeys(): Set<string> {
  const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
    sessionStorage.key(index),
  );
  return new Set(keys.flatMap((key) => (key === null ? [] : [key])));
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ accessToken: null, status: "loading", user: null });
});

afterEach(() => {
  sessionStorage.clear();
});

describe("BookFormDraftCleanup on a session change", () => {
  it("keeps the reader's drafts when the session ends, removing only legacy ones", () => {
    signIn(READERS.a);
    renderWithProviders(<BookFormDraftCleanup />);
    seedDrafts(DRAFT_KEYS.userACreate, DRAFT_KEYS.legacyCreate, DRAFT_KEYS.legacyEdit);

    act(() => {
      signOut();
    });

    expect(storedKeys()).toEqual(new Set([DRAFT_KEYS.userACreate]));
  });

  it("drops the previous account's drafts when another account signs in", () => {
    signIn(READERS.a);
    seedDrafts(DRAFT_KEYS.userACreate);
    renderWithProviders(<BookFormDraftCleanup />);
    seedDrafts(DRAFT_KEYS.userBCreate);

    act(() => {
      signIn(READERS.b);
    });

    expect(storedKeys()).toEqual(new Set([DRAFT_KEYS.userBCreate]));
  });

  it("keeps the user's drafts on a token refresh", () => {
    signIn(READERS.a);
    seedDrafts(DRAFT_KEYS.userACreate);
    renderWithProviders(<BookFormDraftCleanup />);
    seedDrafts(DRAFT_KEYS.userBCreate);

    act(() => {
      signIn(reader({ email: "a@book-nest.net", id: "user-a" }), "refreshed-access-token");
    });

    expect(storedKeys()).toEqual(new Set([DRAFT_KEYS.userACreate, DRAFT_KEYS.userBCreate]));
  });

  it("keeps the reader's draft when the session is lost and after the same reader signs back in", () => {
    signIn(READERS.a);
    seedDrafts(DRAFT_KEYS.userACreate);
    renderWithProviders(<BookFormDraftCleanup />);

    act(() => {
      signOut();
    });
    act(() => {
      signIn(READERS.a);
    });

    expect(sessionStorage.getItem(DRAFT_KEYS.userACreate)).not.toBeNull();
  });

  it("removes the previous reader's draft when another reader signs in after a sign-out", () => {
    signIn(READERS.a);
    seedDrafts(DRAFT_KEYS.userACreate);
    renderWithProviders(<BookFormDraftCleanup />);

    act(() => {
      signOut();
    });

    expect(sessionStorage.getItem(DRAFT_KEYS.userACreate)).not.toBeNull();

    act(() => {
      signIn(READERS.b);
    });

    expect(sessionStorage.getItem(DRAFT_KEYS.userACreate)).toBeNull();
  });

  it("touches nothing while the session reloads for the same reader", () => {
    signIn(READERS.a);
    renderWithProviders(<BookFormDraftCleanup />);
    seedDrafts(DRAFT_KEYS.userBCreate);

    act(() => {
      useAuthStore.getState().setStatus("loading");
    });
    act(() => {
      signIn(READERS.a);
    });

    expect(sessionStorage.getItem(DRAFT_KEYS.userBCreate)).not.toBeNull();
  });
});

describe("BookFormDraftCleanup on mount", () => {
  it("removes legacy unscoped drafts on mount once the session is known", () => {
    signIn(READERS.a);
    seedEveryDraftAndUnrelatedKey();

    renderWithProviders(<BookFormDraftCleanup />);

    expect(storedKeys()).toEqual(new Set([DRAFT_KEYS.userACreate, UNRELATED_KEY]));
  });

  it("removes only legacy drafts when it mounts with nobody signed in", () => {
    signOut();
    seedEveryDraftAndUnrelatedKey();

    renderWithProviders(<BookFormDraftCleanup />);

    expect(storedKeys()).toEqual(
      new Set([DRAFT_KEYS.userACreate, DRAFT_KEYS.userBCreate, UNRELATED_KEY]),
    );
  });

  it("waits for the session bootstrap, then removes only legacy drafts when nobody signs in", () => {
    seedEveryDraftAndUnrelatedKey();
    renderWithProviders(<BookFormDraftCleanup />);

    expect(storedKeys()).toEqual(new Set([...Object.values(DRAFT_KEYS), UNRELATED_KEY]));

    act(() => {
      signOut();
    });

    expect(storedKeys()).toEqual(
      new Set([DRAFT_KEYS.userACreate, DRAFT_KEYS.userBCreate, UNRELATED_KEY]),
    );
  });
});
