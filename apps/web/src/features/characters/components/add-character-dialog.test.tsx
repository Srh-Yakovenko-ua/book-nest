import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import {
  makeCharacterDetails,
  makeCharacterGlobalSummary,
  makeCharacterSummary,
  makeCharacterSummaryPage,
} from "../model/characters.fixtures";
import { AddCharacterDialog } from "./add-character-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const DEBOUNCE_SETTLE_MS = 500;

const book = makeBookView({ id: "book-1" });
const fetchMock = vi.fn();

let respondToLookup: (url: string) => Promise<Response> | Response;
let respondToSuggestions: () => Response;
let respondToDuplicates: () => Response;

function createBody(): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    ([, init]) => (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
  return call === undefined
    ? undefined
    : (JSON.parse(String(call[1].body)) as Record<string, unknown>);
}

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  const controls: { resolve?: (response: Response) => void } = {};
  const promise = new Promise<Response>((resolve) => {
    controls.resolve = resolve;
  });
  return { promise, resolve: (response) => controls.resolve?.(response) };
}

function duplicateRequestUrls(): string[] {
  return requestUrls().filter((url) => url.includes("/duplicate-candidates"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lookupRequestUrls(): string[] {
  return requestUrls().filter((url) => url.includes("/book-1/characters?"));
}

function paramOf(url: string | undefined, name: string): null | string {
  if (url === undefined) return null;
  return new URL(url, "http://localhost").searchParams.get(name);
}

function renderDialog(readingContext = {}) {
  const onOpenChange = vi.fn();
  const onOpenDetails = vi.fn();
  const view = renderWithProviders(
    <AddCharacterDialog
      book={book}
      onOpenChange={onOpenChange}
      onOpenDetails={onOpenDetails}
      open
      readingContext={readingContext}
    />,
  );
  return { ...view, onOpenChange, onOpenDetails };
}

function requestUrls(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === "GET")
    .map(([input]) => String(input));
}

async function search(text: string) {
  await userEvent.type(screen.getByRole("textbox", { name: "Пошук персонажів" }), text);
}

async function settleDebounce() {
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));
}

function suggestionRequestUrls(): string[] {
  return requestUrls().filter((url) => url.includes("/character-suggestions"));
}

beforeEach(() => {
  respondToLookup = () => jsonResponse(makeCharacterSummaryPage([]));
  respondToSuggestions = () => jsonResponse({ suggestions: [] });
  respondToDuplicates = () => jsonResponse({ candidates: [] });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/character-suggestions")) return Promise.resolve(respondToSuggestions());
    if (url.includes("/duplicate-candidates")) return Promise.resolve(respondToDuplicates());
    if (method === "GET" && url.includes("/characters?")) {
      return Promise.resolve(respondToLookup(url));
    }
    if (method === "POST") return Promise.resolve(jsonResponse(makeCharacterDetails(), 201));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddCharacterDialog search", () => {
  it("shows the hint and asks the server for nothing below two characters", async () => {
    renderDialog();

    expect(
      screen.getByText("Введіть щонайменше дві літери, щоб почати пошук."),
    ).toBeInTheDocument();
    expect(requestUrls()).toHaveLength(0);

    await search("G");
    await settleDebounce();

    expect(requestUrls()).toHaveLength(0);
    expect(
      screen.getByText("Введіть щонайменше дві літери, щоб почати пошук."),
    ).toBeInTheDocument();
  });

  it("sends one normalized query to the in-book lookup and the suggestions", async () => {
    renderDialog();

    await search("  Ger   alt  ");

    await waitFor(() => expect(lookupRequestUrls()).toHaveLength(1));
    await waitFor(() => expect(suggestionRequestUrls()).toHaveLength(1));
    expect(paramOf(lookupRequestUrls()[0], "search")).toBe("Ger alt");
    expect(paramOf(suggestionRequestUrls()[0], "q")).toBe("Ger alt");
  });

  it("never renders a slower query's rows as the results of the next query", async () => {
    const held = deferredResponse();
    respondToLookup = (url) =>
      paramOf(url, "search") === "Ger"
        ? held.promise
        : jsonResponse(makeCharacterSummaryPage([makeCharacterSummary({ name: "Geralt" })]));

    renderDialog();

    await search("Ger");
    await waitFor(() => expect(lookupRequestUrls()).toHaveLength(1));

    await search("alt");
    expect(await screen.findByText("Geralt")).toBeInTheDocument();

    held.resolve(jsonResponse(makeCharacterSummaryPage([makeCharacterSummary({ name: "Triss" })])));
    await settleDebounce();

    expect(screen.queryByText("Triss")).not.toBeInTheDocument();
    expect(screen.getByText("Geralt")).toBeInTheDocument();
  });

  it("forwards the reading context to both lookups", async () => {
    renderDialog({ contextBookId: "book-1", contextPage: 42 });

    await search("Geralt");

    await waitFor(() => expect(suggestionRequestUrls()).toHaveLength(1));
    for (const url of [lookupRequestUrls()[0], suggestionRequestUrls()[0]]) {
      expect(paramOf(url, "contextBookId")).toBe("book-1");
      expect(paramOf(url, "contextPage")).toBe("42");
    }
  });
});

describe("AddCharacterDialog intent sections", () => {
  it("opens a character that is already in this book", async () => {
    respondToLookup = () =>
      jsonResponse(
        makeCharacterSummaryPage([makeCharacterSummary({ characterId: "char-9", name: "Geralt" })]),
      );
    const { onOpenChange, onOpenDetails } = renderDialog();

    await search("Geralt");

    expect(await screen.findByText("Уже в цій книзі")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Відкрити" }));

    expect(onOpenDetails).toHaveBeenCalledWith("char-9");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("links a reusable character without navigating", async () => {
    respondToSuggestions = () =>
      jsonResponse({ suggestions: [makeCharacterGlobalSummary({ id: "char-7" })] });
    const { onOpenDetails } = renderDialog();

    await search("Geralt");

    expect(await screen.findByText("З інших книг")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ characterId: "char-7", mode: "existing" });
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("creates the normalized query without a second screen", async () => {
    renderDialog();

    await search("  Ger   alt  ");

    const createRow = await screen.findByRole("button", { name: "Створити «Ger alt»" });
    await userEvent.click(createRow);

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ mode: "new" });
    expect(createBody()?.character).toMatchObject({ name: "Ger alt" });
    expect(createBody()?.bookProfile).toMatchObject({
      description: null,
      importance: "not_specified",
      isPovCharacter: false,
      roles: [],
      status: "not_specified",
    });
  });

  it("keeps one screen with no back control and no second create button", async () => {
    renderDialog();

    await search("Geralt");
    await screen.findByRole("button", { name: "Створити «Geralt»" });

    expect(screen.queryByRole("button", { name: "Назад" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Ім’я" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Створити/ })).toHaveLength(1);
  });

  it("ends create and link in the same state", async () => {
    const {
      onOpenChange: onCloseAfterCreate,
      onOpenDetails: onDetailsAfterCreate,
      unmount,
    } = renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Створити «Geralt»" }));

    await waitFor(() => expect(onCloseAfterCreate).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Персонажа додано");
    expect(onDetailsAfterCreate).not.toHaveBeenCalled();

    unmount();
    vi.clearAllMocks();
    respondToSuggestions = () =>
      jsonResponse({ suggestions: [makeCharacterGlobalSummary({ id: "char-7" })] });

    const { onOpenChange: onCloseAfterLink, onOpenDetails: onDetailsAfterLink } = renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Додати" }));

    await waitFor(() => expect(onCloseAfterLink).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Персонажа додано");
    expect(onDetailsAfterLink).not.toHaveBeenCalled();
  });
});

describe("AddCharacterDialog duplicate guard", () => {
  it("checks duplicates once per create press and never while typing", async () => {
    renderDialog();

    await search("Geralt");
    await screen.findByRole("button", { name: "Створити «Geralt»" });

    expect(duplicateRequestUrls()).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Створити «Geralt»" }));

    await waitFor(() => expect(duplicateRequestUrls()).toHaveLength(1));
    expect(paramOf(duplicateRequestUrls()[0], "name")).toBe("Geralt");
  });

  it("warns inline without repeating a candidate that is already visible", async () => {
    respondToSuggestions = () =>
      jsonResponse({
        suggestions: [makeCharacterGlobalSummary({ id: "char-7", name: "Geralt of Rivia" })],
      });
    respondToDuplicates = () =>
      jsonResponse({
        candidates: [
          makeCharacterGlobalSummary({ id: "char-7", name: "Geralt of Rivia" }),
          makeCharacterGlobalSummary({ id: "char-5", name: "Geralt the Elder" }),
        ],
      });
    const { onOpenChange } = renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Створити «Geralt»" }));

    expect(await screen.findByText("Можливо, цей персонаж уже існує.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Пошук персонажів" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(createBody()).toBeUndefined();

    expect(screen.getAllByText("Geralt of Rivia")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Переглянути" })).toHaveLength(1);
    expect(screen.getByText("Geralt the Elder")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Додати" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Створити «Geralt»" })).not.toBeInTheDocument();
  });

  it("creates anyway from the inline warning", async () => {
    respondToDuplicates = () =>
      jsonResponse({ candidates: [makeCharacterGlobalSummary({ id: "char-5" })] });
    const { onOpenChange } = renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Створити «Geralt»" }));

    await userEvent.click(await screen.findByRole("button", { name: "Все одно створити" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ mode: "new" });
    expect(createBody()?.character).toMatchObject({ name: "Geralt" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("reviews an unknown candidate instead of linking it blindly", async () => {
    respondToDuplicates = () =>
      jsonResponse({ candidates: [makeCharacterGlobalSummary({ id: "char-5" })] });
    const { onOpenDetails } = renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Створити «Geralt»" }));

    await userEvent.click(await screen.findByRole("button", { name: "Переглянути" }));

    expect(onOpenDetails).toHaveBeenCalledWith("char-5");
    expect(createBody()).toBeUndefined();
  });

  it("admits that the duplicate check failed instead of creating blindly", async () => {
    respondToDuplicates = () => jsonResponse({ message: "boom" }, 500);
    renderDialog();

    await search("Geralt");
    await userEvent.click(await screen.findByRole("button", { name: "Створити «Geralt»" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Не вдалося перевірити, чи такий персонаж уже існує. Спробуйте ще раз.",
      ),
    );
    expect(createBody()).toBeUndefined();
  });
});
