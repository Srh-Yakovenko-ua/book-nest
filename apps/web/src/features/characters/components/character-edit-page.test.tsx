import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterEditPage } from "./character-edit-page";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const character = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({
      bookId: "book-1",
      description: "Опис у книзі",
      importance: "central",
      status: "active",
    }),
  ],
  gender: "male",
  name: "Ґеральт",
  species: "Відьмак",
});

const fetchMock = vi.fn();

let bookPatchStatus: number;

function bookPatchBody() {
  return patchBody((url) => url.includes("/api/books/"));
}

function globalPatchBody() {
  return patchBody((url) => url.includes("/api/characters/") && !url.includes("/api/books/"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function patchBody(predicate: (url: string) => boolean): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH" && predicate(String(url)),
  ) as [string, RequestInit] | undefined;
  return call === undefined
    ? undefined
    : (JSON.parse(String(call[1].body)) as Record<string, unknown>);
}

function patchCount(): number {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH",
  ).length;
}

function renderEdit(search = "bookId=book-1") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharacterEditPage characterId="char-1" />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  bookPatchStatus = 200;

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(character));
    }
    if (method === "PATCH" && url.includes("/api/books/")) {
      return Promise.resolve(
        bookPatchStatus === 200
          ? jsonResponse(character)
          : jsonResponse({ message: "boom" }, bookPatchStatus),
      );
    }
    if (method === "PATCH") return Promise.resolve(jsonResponse(character));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterEditPage scope orchestration", () => {
  it("keeps save disabled until something actually changes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("button", { name: /Зберегти/ })).toBeDisabled();
  });

  it("sends only the global update when only a global field changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    expect(globalPatchBody()).toHaveProperty("name", "Ґеральт із Рівії");
    expect(bookPatchBody()).toBeUndefined();
  });

  it("sends only the book update when only a book field changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("description", "Опис у книзі ще трохи");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("sends both updates when both scopes changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(globalPatchBody()).toBeDefined();
  });

  it("keeps the failed scope dirty and does not resend the saved one on retry", async () => {
    bookPatchStatus = 500;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: "Дані в цій книзі" }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(screen.getByRole("textbox", { name: "Дані в цій книзі" })).toHaveValue(
      "Опис у книзі ще трохи",
    );
    expect(push).not.toHaveBeenCalled();

    bookPatchStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(3));
  });
});

describe("CharacterEditPage without a book context", () => {
  it("shows only the shared section", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
  });
});
