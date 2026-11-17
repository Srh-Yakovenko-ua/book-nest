import type { UserView } from "@app/shared";

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/features/auth";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { BookForm } from "./book-form";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const titleLabel = messages.books.fields.title;

const DRAFTED_TITLE = "Тіні забутих предків";

const DRAFT_KEYS = {
  legacyCreate: "book-form-draft:create",
  userACreate: "book-form-draft:user:user-a:create",
} as const;

const READERS = {
  a: reader({ email: "a@book-nest.net", id: "user-a" }),
  b: reader({ email: "b@book-nest.net", id: "user-b" }),
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

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

function signIn(user: UserView) {
  useAuthStore.getState().setSession("access-token", user);
}

function storeEnglishDraft(storageKey: string) {
  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      authorSelections: [],
      loanContactSelection: null,
      locale: "en",
      publisherEdited: false,
      publisherSelection: null,
      seriesSelection: null,
      values: { title: DRAFTED_TITLE },
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const path = String(input);
    if (path.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (path.includes("/api/publishers/recent")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(
      jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => {
    useAuthStore.getState().clearSession();
  });
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookForm draft scope", () => {
  it("does not restore another account's create draft", () => {
    storeEnglishDraft(DRAFT_KEYS.userACreate);
    signIn(READERS.b);

    renderWithProviders(<BookForm mode="create" />);

    expect(screen.getByLabelText(titleLabel)).toHaveValue("");
  });

  it("restores the signed-in account's own create draft", () => {
    storeEnglishDraft(DRAFT_KEYS.userACreate);
    signIn(READERS.a);

    renderWithProviders(<BookForm mode="create" />);

    expect(screen.getByLabelText(titleLabel)).toHaveValue(DRAFTED_TITLE);
  });

  it("does not restore a legacy unscoped draft", () => {
    storeEnglishDraft(DRAFT_KEYS.legacyCreate);
    signIn(READERS.a);

    renderWithProviders(<BookForm mode="create" />);

    expect(screen.getByLabelText(titleLabel)).toHaveValue("");
  });
});
