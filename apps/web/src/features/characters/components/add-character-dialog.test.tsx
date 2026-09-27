import "@testing-library/jest-dom/vitest";
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

const book = makeBookView({ id: "book-1" });
const fetchMock = vi.fn();

let respondToRoster: () => Response;
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(onOpenDetails = vi.fn()) {
  const view = renderWithProviders(
    <AddCharacterDialog
      book={book}
      onOpenChange={vi.fn()}
      onOpenDetails={onOpenDetails}
      open
      readingContext={{}}
    />,
  );
  return { ...view, onOpenDetails };
}

async function search(text: string) {
  await userEvent.type(screen.getByLabelText("Пошук персонажів"), text);
}

beforeEach(() => {
  respondToRoster = () => jsonResponse(makeCharacterSummaryPage([]));
  respondToSuggestions = () => jsonResponse({ suggestions: [] });
  respondToDuplicates = () => jsonResponse({ candidates: [] });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/character-suggestions")) return Promise.resolve(respondToSuggestions());
    if (url.includes("/duplicate-candidates")) return Promise.resolve(respondToDuplicates());
    if (method === "GET" && url.includes("/characters?")) return Promise.resolve(respondToRoster());
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
  it("waits for a meaningful query instead of listing everything", async () => {
    renderDialog();

    expect(
      screen.getByText("Введіть щонайменше дві літери, щоб почати пошук."),
    ).toBeInTheDocument();

    await search("Ґ");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).includes("/suggestions")),
      ).toHaveLength(0),
    );
  });

  it("offers Відкрити for a character that is already in this book", async () => {
    respondToRoster = () =>
      jsonResponse(makeCharacterSummaryPage([makeCharacterSummary({ characterId: "char-9" })]));
    const { onOpenDetails } = renderDialog();

    await search("Ґер");

    expect(await screen.findByText("Уже в цій книзі")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Відкрити" }));

    expect(onOpenDetails).toHaveBeenCalledWith("char-9");
  });

  it("links a reusable character from another book without opening details", async () => {
    respondToSuggestions = () =>
      jsonResponse({ suggestions: [makeCharacterGlobalSummary({ id: "char-7" })] });
    const { onOpenDetails } = renderDialog();

    await search("Ґер");

    expect(await screen.findByText("З інших книг")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Додати" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ characterId: "char-7", mode: "existing" });
    expect(onOpenDetails).not.toHaveBeenCalled();
  });
});

describe("AddCharacterDialog minimal create", () => {
  it("shows only the name and the short note, and carries the query into the name", async () => {
    renderDialog();

    await search("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveValue("Ґеральт");
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа в цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Важливість")).not.toBeInTheDocument();
    expect(screen.queryByText("Статус")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "POV-персонаж" })).not.toBeInTheDocument();
  });

  it("blocks an empty name and sends nothing", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    expect(await screen.findByText("Вкажіть ім'я")).toBeInTheDocument();
    expect(createBody()).toBeUndefined();
  });

  it("creates with unspecified importance and status, then opens the new character", async () => {
    const { onOpenDetails } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), "Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ mode: "new" });
    expect(createBody()?.bookProfile).toMatchObject({
      importance: "not_specified",
      status: "not_specified",
    });
    expect(createBody()?.character).toMatchObject({ name: "Ґеральт" });
    await waitFor(() => expect(onOpenDetails).toHaveBeenCalledWith("char-1"));
  });

  it("keeps the draft when going back to the search", async () => {
    renderDialog();

    await search("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));
    await userEvent.click(screen.getByRole("button", { name: "Назад" }));

    expect(screen.getByLabelText("Пошук персонажів")).toHaveValue("Ґеральт");
  });
});

describe("AddCharacterDialog duplicate guard", () => {
  it("stays advisory and lets the user create anyway", async () => {
    respondToDuplicates = () =>
      jsonResponse({ candidates: [makeCharacterGlobalSummary({ id: "char-5" })] });
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), "Ґеральт");

    expect(await screen.findByText("Можливо, цей персонаж уже існує.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Все одно створити нового" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ mode: "new" });
  });

  it("links the candidate instead of creating a duplicate", async () => {
    respondToDuplicates = () =>
      jsonResponse({ candidates: [makeCharacterGlobalSummary({ id: "char-5" })] });
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити нового" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), "Ґеральт");

    await screen.findByText("Можливо, цей персонаж уже існує.");
    await userEvent.click(screen.getByRole("button", { name: "Використати" }));

    await waitFor(() => expect(createBody()).toBeDefined());
    expect(createBody()).toMatchObject({ characterId: "char-5", mode: "existing" });
  });
});
