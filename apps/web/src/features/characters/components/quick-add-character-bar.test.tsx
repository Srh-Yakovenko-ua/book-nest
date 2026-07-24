import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test-utils";

import { characterKeys } from "../api/character-keys";
import { makeCharacterDetails, makeCharacterGlobalSummary } from "../model/characters.fixtures";
import { QuickAddCharacterBar } from "./quick-add-character-bar";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToDuplicates: () => Response;

function createBody(): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/books/book-1/characters") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
  return call === undefined
    ? undefined
    : (JSON.parse(String(call[1].body)) as Record<string, unknown>);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderBar(
  props: Partial<Parameters<typeof QuickAddCharacterBar>[0]> = {},
  queryClient = createTestQueryClient(),
) {
  return renderWithProviders(
    <QuickAddCharacterBar
      bookId="book-1"
      onLinkExisting={vi.fn()}
      onMoreFields={vi.fn()}
      {...props}
    />,
    { queryClient },
  );
}

beforeEach(() => {
  respondToDuplicates = () => jsonResponse({ candidates: [] });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/duplicate-candidates")) return Promise.resolve(respondToDuplicates());
    if (method === "POST" && url.includes("/api/books/book-1/characters")) {
      return Promise.resolve(jsonResponse(makeCharacterDetails(), 201));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("QuickAddCharacterBar duplicate suggestion", () => {
  it("offers to reuse an existing character or create a new one when a name matches", async () => {
    respondToDuplicates = () =>
      jsonResponse({
        candidates: [makeCharacterGlobalSummary({ id: "char-9", name: "Ґеральт із Рівії" })],
      });
    const onLinkExisting = vi.fn();
    renderBar({ onLinkExisting });

    await userEvent.type(screen.getByLabelText("Ім'я персонажа"), "Ґеральт");

    expect(
      await screen.findByText("Можливо, цей персонаж уже існує.", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ґеральт із Рівії")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Все одно створити" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Використати" }));

    expect(onLinkExisting).toHaveBeenCalledWith("char-9");
  });

  it("does not surface a suggestion while nothing matches the typed name", async () => {
    renderBar();

    await userEvent.type(screen.getByLabelText("Ім'я персонажа"), "Йеннефер");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/duplicate-candidates"),
        expect.anything(),
      );
    });
    expect(screen.queryByText("Можливо, цей персонаж уже існує.")).not.toBeInTheDocument();
  });
});

describe("QuickAddCharacterBar quick capture", () => {
  it("creates a character from just a name and note with a minimal new-mode payload", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderBar({}, queryClient);

    await userEvent.type(screen.getByLabelText("Ім'я персонажа"), "Йеннефер");
    await userEvent.type(screen.getByLabelText("Короткий нотаток"), "Чародійка");
    await userEvent.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() => expect(createBody()).toBeDefined());

    const body = createBody();
    expect(body?.mode).toBe("new");
    expect(body?.character).toMatchObject({ name: "Йеннефер" });
    expect(body?.bookProfile).toMatchObject({ description: "Чародійка" });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: characterKeys.all }),
    );
  });

  it("keeps focus in the name field after submitting with Enter", async () => {
    renderBar();

    const nameInput = screen.getByLabelText("Ім'я персонажа");
    await userEvent.type(nameInput, "Ґеральт{Enter}");

    await waitFor(() => expect(nameInput).toHaveValue(""));
    expect(nameInput).toHaveFocus();
  });
});
