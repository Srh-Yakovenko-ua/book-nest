import "@testing-library/jest-dom/vitest";

import type { BookView, NoteView, SeriesView } from "@app/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { QueryObserver } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { makeSeriesView } from "@/features/series/model/series.fixtures";
import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import type { NoteEntityRef } from "../model/note-entity";

import { notesKeys } from "../api/notes-keys";
import { makeBookNote, makeSeriesNote, NOTE_FIXTURE } from "../model/notes.fixtures";
import { NoteFormDialog } from "./note-form-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type DialogTarget = ComponentProps<typeof NoteFormDialog>["target"];

type WriteCall = { body: Record<string, unknown>; method: string; url: string };

const NAMES = {
  bookGroup: "Книга",
  books: "Ваші книги",
  bookSearch: "Пошук книги за назвою або автором",
  change: "Змінити",
  chapter: "Розділ (необовʼязково)",
  createTitle: "Додати нотатку",
  editTitle: "Редагувати нотатку",
  page: "Сторінка (необовʼязково)",
  removeLocation: "Прибрати збережене місце",
  restoreLocation: "Повернути збережене місце",
  savedLocation: "Збережене місце",
  seriesGroup: "Серія",
  seriesSearch: "Пошук серії за назвою або автором",
  submitCreate: "Зберегти нотатку",
  submitEdit: "Зберегти зміни",
  text: "Текст нотатки",
} as const;

const DRAFT = "Пророцтво ще повернеться у третій частині.";

const LIBRARY: { books: BookView[]; series: SeriesView[] } = {
  books: [
    makeBookView({
      authors: [{ id: "author-1", name: "Френк Герберт" }],
      id: "book-1",
      title: "Дюна",
    }),
    makeBookView({
      authors: [{ id: "author-2", name: "Урсула Ле Гуїн" }],
      id: "book-2",
      title: "Чарівник Земномор'я",
    }),
  ],
  series: [
    makeSeriesView({
      authors: [{ id: "author-1", name: "Френк Герберт" }],
      id: "series-1",
      name: "Хроніки Дюни",
    }),
    makeSeriesView({
      authors: [{ id: "author-3", name: "Ребекка Яррос" }],
      id: "series-2",
      name: "Емпіреї",
    }),
  ],
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToWrite: (call: WriteCall) => Promise<Response>;

function bookEntity(note: NoteView): NoteEntityRef {
  if (note.book === null) throw new Error("book note without book");
  return { book: note.book, type: "book" };
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function DialogHarness({ target }: { target: DialogTarget }) {
  const [open, setOpen] = useState(true);
  return <NoteFormDialog onOpenChange={setOpen} open={open} target={target} />;
}

function hangingBookNotesQuery(queryClient: QueryClient): () => void {
  const observer = new QueryObserver(queryClient, {
    queryFn: () => new Promise<never>(() => undefined),
    queryKey: notesKeys.byBook("book-1"),
  });
  return observer.subscribe(() => undefined);
}

function invalidatedKeys(spy: MockInstance<QueryClient["invalidateQueries"]>): QueryKey[] {
  return spy.mock.calls.flatMap(([filters]) =>
    filters?.queryKey === undefined ? [] : [filters.queryKey],
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function noteFromWrite(call: WriteCall): NoteView {
  const base = call.url.startsWith("/api/series/") ? makeSeriesNote() : makeBookNote();
  return { ...base, ...call.body } as NoteView;
}

async function onlyWrite(): Promise<WriteCall> {
  await waitFor(() => expect(writes()).toHaveLength(1));
  const [call] = writes();
  if (call === undefined) throw new Error("no write request was sent");
  return call;
}

function page(items: unknown[]): Response {
  return jsonResponse({ items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length });
}

async function pickBook(title: RegExp) {
  await userEvent.click(await screen.findByRole("radio", { name: title }));
}

async function pickSeries(name: RegExp) {
  await userEvent.click(await screen.findByRole("radio", { name }));
}

function renderDialog(target: DialogTarget, queryClient?: QueryClient) {
  return renderWithProviders(<DialogHarness target={target} />, { queryClient });
}

function seriesEntity(note: NoteView): NoteEntityRef {
  if (note.series === null) throw new Error("series note without series");
  return { series: note.series, type: "series" };
}

async function submit(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

function writes(): WriteCall[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      body:
        init?.body === undefined ? {} : (JSON.parse(String(init.body)) as Record<string, unknown>),
      method: String(init?.method ?? "GET").toUpperCase(),
      url: String(input),
    }))
    .filter((call) => call.method !== "GET");
}

beforeEach(() => {
  respondToWrite = (call) => Promise.resolve(jsonResponse(noteFromWrite(call)));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.startsWith("/api/books?"))
      return Promise.resolve(page(LIBRARY.books));
    if (method === "GET" && url.startsWith("/api/series?"))
      return Promise.resolve(page(LIBRARY.series));
    if (method !== "GET") {
      const body =
        init?.body === undefined ? {} : (JSON.parse(String(init.body)) as Record<string, unknown>);
      return respondToWrite({ body, method, url });
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NoteFormDialog book create", () => {
  it("opens straight on the book picker without an entity-type step", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    const dialog = await screen.findByRole("dialog", { name: NAMES.createTitle });
    expect(within(dialog).getByRole("group", { name: NAMES.bookGroup })).toContainElement(
      within(dialog).getByRole("textbox", { name: NAMES.bookSearch }),
    );
    expect(
      within(dialog).queryByRole("textbox", { name: NAMES.seriesSearch }),
    ).not.toBeInTheDocument();
  });

  it("posts the note with chapter and page to the picked book", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), `  ${DRAFT}  `);
    await userEvent.type(screen.getByLabelText(NAMES.chapter), "Розділ III");
    await userEvent.type(screen.getByLabelText(NAMES.page), "87");
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/api/books/book-1/notes");
    expect(call.body).toEqual({
      category: null,
      chapter: "Розділ III",
      customCategory: null,
      isFavorite: false,
      isPinned: false,
      isSpoiler: false,
      page: 87,
      text: DRAFT,
    });
  });

  it("sends null chapter and page when the book location is left empty", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.body).toMatchObject({ chapter: null, page: null });
  });

  it("sends the chosen flags", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await userEvent.click(screen.getByRole("switch", { name: "Це спойлер" }));
    await userEvent.click(screen.getByRole("switch", { name: "Закріпити нотатку" }));
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.body).toMatchObject({ isFavorite: false, isPinned: true, isSpoiler: true });
  });

  it("closes the dialog once the note is saved", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Нотатку додано.");
  });

  it("refuses to submit without a book", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    await screen.findByRole("radio", { name: /Дюна/ });

    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    expect(await screen.findByText("Оберіть книгу.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it("refuses to submit a blank note", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), "   ");
    await submit(NAMES.submitCreate);

    expect(await screen.findByText("Введіть текст нотатки.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
});

describe("NoteFormDialog series create", () => {
  it("shows no chapter or page inputs", async () => {
    renderDialog({ entityType: "series", mode: "pick" });

    await screen.findByRole("radio", { name: /Хроніки Дюни/ });

    expect(screen.queryByLabelText(NAMES.chapter)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(NAMES.page)).not.toBeInTheDocument();
  });

  it("posts to the picked series without chapter or page keys", async () => {
    renderDialog({ entityType: "series", mode: "pick" });

    await pickSeries(/Емпіреї/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/api/series/series-2/notes");
    expect(call.body).toEqual({
      category: null,
      customCategory: null,
      isFavorite: false,
      isPinned: false,
      isSpoiler: false,
      text: DRAFT,
    });
  });

  it("names the entity group and search after the series", async () => {
    renderDialog({ entityType: "series", mode: "pick" });

    await screen.findByRole("radio", { name: /Хроніки Дюни/ });

    expect(screen.getByRole("group", { name: NAMES.seriesGroup })).toContainElement(
      screen.getByRole("textbox", { name: NAMES.seriesSearch }),
    );
    expect(screen.getByRole("radiogroup", { name: "Ваші серії" })).toBeInTheDocument();
  });
});

describe("NoteFormDialog changing the picked entity", () => {
  it("keeps the typed draft when the picker is reopened with Змінити", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await pickBook(/Дюна/);

    await userEvent.click(screen.getByRole("button", { name: NAMES.change }));

    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveValue(DRAFT);
    expect(await screen.findByRole("radio", { name: /Дюна/ })).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: NAMES.books })).toBeInTheDocument();
  });

  it("sends the draft to the newly picked book after Змінити", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await userEvent.type(screen.getByLabelText(NAMES.chapter), "Пролог");
    await pickBook(/Дюна/);

    await userEvent.click(screen.getByRole("button", { name: NAMES.change }));
    await pickBook(/Чарівник/);
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.url).toBe("/api/books/book-2/notes");
    expect(call.body).toMatchObject({ chapter: "Пролог", text: DRAFT });
  });

  it("keeps the draft when the series picker is reopened", async () => {
    renderDialog({ entityType: "series", mode: "pick" });
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await pickSeries(/Хроніки Дюни/);

    await userEvent.click(screen.getByRole("button", { name: NAMES.change }));

    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveValue(DRAFT);
    expect(await screen.findByRole("radio", { name: /Хроніки Дюни/ })).toBeChecked();
  });
});

describe("NoteFormDialog failed submit", () => {
  beforeEach(() => {
    respondToWrite = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
  });

  it("keeps the dialog open and reports the failure", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);

    await submit(NAMES.submitCreate);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Не вдалося зберегти нотатку. Спробуйте ще раз."),
    );
    expect(screen.getByRole("dialog", { name: NAMES.createTitle })).toBeInTheDocument();
  });

  it("keeps the typed text and location", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await userEvent.type(screen.getByLabelText(NAMES.chapter), "Розділ III");
    await userEvent.type(screen.getByLabelText(NAMES.page), "87");

    await submit(NAMES.submitCreate);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveValue(DRAFT);
    expect(screen.getByLabelText(NAMES.chapter)).toHaveValue("Розділ III");
    expect(screen.getByLabelText(NAMES.page)).toHaveValue(87);
  });

  it("keeps the picked series and resends to it on retry", async () => {
    renderDialog({ entityType: "series", mode: "pick" });
    await pickSeries(/Емпіреї/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    respondToWrite = (call) => Promise.resolve(jsonResponse(noteFromWrite(call)));
    await submit(NAMES.submitCreate);

    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes().map((call) => call.url)).toEqual([
      "/api/series/series-2/notes",
      "/api/series/series-2/notes",
    ]);
    expect(writes()[1]?.body).toMatchObject({ text: DRAFT });
  });
});

describe("NoteFormDialog submitting state", () => {
  it("disables submit while the request is in flight", async () => {
    const pending = deferredResponse();
    respondToWrite = () => pending.promise;
    renderDialog({ entityType: "book", mode: "pick" });
    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);

    await submit(NAMES.submitCreate);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: NAMES.submitCreate })).toBeDisabled(),
    );
    pending.resolve(jsonResponse(makeBookNote()));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sends a single request when submit is clicked twice", async () => {
    const pending = deferredResponse();
    respondToWrite = () => pending.promise;
    renderDialog({ entityType: "book", mode: "pick" });
    await pickBook(/Дюна/);
    await userEvent.type(screen.getByRole("textbox", { name: NAMES.text }), DRAFT);

    await userEvent.dblClick(screen.getByRole("button", { name: NAMES.submitCreate }));
    pending.resolve(jsonResponse(makeBookNote()));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes()).toHaveLength(1);
  });
});

describe("NoteFormDialog closing without waiting for refetches", () => {
  it("closes after a create while an invalidated query is still refetching", async () => {
    const queryClient = createTestQueryClient();
    const unsubscribe = hangingBookNotesQuery(queryClient);
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "preselected" }, queryClient);

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Нотатку додано.");
    unsubscribe();
  });

  it("closes after an edit while an invalidated query is still refetching", async () => {
    const queryClient = createTestQueryClient();
    const unsubscribe = hangingBookNotesQuery(queryClient);
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note }, queryClient);

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), " Ще.");
    await submit(NAMES.submitEdit);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    unsubscribe();
  });
});

describe("NoteFormDialog book edit", () => {
  it("shows the linked book read-only, without a picker", async () => {
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    const group = await screen.findByRole("group", { name: NAMES.bookGroup });
    expect(within(group).getByText("Дюна")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: NAMES.bookSearch })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: NAMES.change })).not.toBeInTheDocument();
  });

  it("titles the dialog for editing", async () => {
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    expect(await screen.findByRole("dialog", { name: NAMES.editTitle })).toBeInTheDocument();
  });

  it("prefills the form from the note", async () => {
    const note = makeBookNote({ chapter: "Розділ III", page: 87 });
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    expect(await screen.findByRole("textbox", { name: NAMES.text })).toHaveValue(NOTE_FIXTURE.text);
    expect(screen.getByLabelText(NAMES.chapter)).toHaveValue("Розділ III");
    expect(screen.getByLabelText(NAMES.page)).toHaveValue(87);
  });

  it("patches the note without any book reference", async () => {
    const note = makeBookNote({ chapter: "Розділ III", page: 87 });
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), " Оновлено.");
    await submit(NAMES.submitEdit);

    const call = await onlyWrite();
    expect(call.method).toBe("PATCH");
    expect(call.url).toBe("/api/notes/note-1");
    expect(call.body).toEqual({
      category: "characters",
      chapter: "Розділ III",
      customCategory: null,
      isFavorite: false,
      isPinned: false,
      isSpoiler: false,
      page: 87,
      text: `${NOTE_FIXTURE.text} Оновлено.`,
    });
  });

  it("reports a failed edit and keeps the dialog open", async () => {
    respondToWrite = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), " Оновлено.");
    await submit(NAMES.submitEdit);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Не вдалося оновити нотатку. Спробуйте ще раз."),
    );
    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveValue(
      `${NOTE_FIXTURE.text} Оновлено.`,
    );
  });
});

describe("NoteFormDialog series edit", () => {
  it("shows the linked series read-only, without a picker", async () => {
    const note = makeSeriesNote();
    renderDialog({ entity: seriesEntity(note), mode: "edit", note });

    const group = await screen.findByRole("group", { name: NAMES.seriesGroup });
    expect(within(group).getByText("Хроніки Дюни")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: NAMES.seriesSearch })).not.toBeInTheDocument();
  });

  it("patches the note without any series reference", async () => {
    const note = makeSeriesNote();
    renderDialog({ entity: seriesEntity(note), mode: "edit", note });

    await submit(NAMES.submitEdit);

    const call = await onlyWrite();
    expect(call.body).not.toHaveProperty("seriesId");
    expect(call.body).not.toHaveProperty("series");
    expect(call.body).not.toHaveProperty("bookId");
  });

  it("offers no saved-location section when the note has none", async () => {
    const note = makeSeriesNote();
    renderDialog({ entity: seriesEntity(note), mode: "edit", note });

    await screen.findByRole("dialog", { name: NAMES.editTitle });

    expect(screen.queryByRole("region", { name: NAMES.savedLocation })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(NAMES.chapter)).not.toBeInTheDocument();
  });
});

describe("NoteFormDialog legacy series location", () => {
  const legacyNote = () => makeSeriesNote({ chapter: "Том 2", page: 12 });

  function renderLegacy() {
    const note = legacyNote();
    renderDialog({ entity: seriesEntity(note), mode: "edit", note });
  }

  it("shows the saved location read-only instead of chapter and page inputs", async () => {
    renderLegacy();

    const section = await screen.findByRole("region", { name: NAMES.savedLocation });
    expect(within(section).getByText(/Том 2/)).toBeInTheDocument();
    expect(screen.queryByLabelText(NAMES.chapter)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(NAMES.page)).not.toBeInTheDocument();
  });

  it("leaves chapter and page out of an ordinary save", async () => {
    renderLegacy();

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), " Оновлено.");
    await submit(NAMES.submitEdit);

    const call = await onlyWrite();
    expect(call.body).not.toHaveProperty("chapter");
    expect(call.body).not.toHaveProperty("page");
    expect(call.body).toMatchObject({ text: `${NOTE_FIXTURE.text} Оновлено.` });
  });

  it("clears chapter and page once the saved location is removed", async () => {
    renderLegacy();

    await userEvent.click(await screen.findByRole("button", { name: NAMES.removeLocation }));
    await submit(NAMES.submitEdit);

    const call = await onlyWrite();
    expect(call.body).toMatchObject({ chapter: null, page: null });
  });

  it("offers to restore the location after removing it", async () => {
    renderLegacy();

    await userEvent.click(await screen.findByRole("button", { name: NAMES.removeLocation }));

    expect(screen.getByRole("button", { name: NAMES.restoreLocation })).toBeInTheDocument();
    expect(screen.getByText("Збережене місце буде прибрано після збереження.")).toBeInTheDocument();
  });

  it("leaves chapter and page untouched when removal is undone before saving", async () => {
    renderLegacy();

    await userEvent.click(await screen.findByRole("button", { name: NAMES.removeLocation }));
    await userEvent.click(screen.getByRole("button", { name: NAMES.restoreLocation }));
    await submit(NAMES.submitEdit);

    const call = await onlyWrite();
    expect(call.body).not.toHaveProperty("chapter");
    expect(call.body).not.toHaveProperty("page");
  });
});

describe("NoteFormDialog preselected entity", () => {
  it("opens with the series already chosen and no picker", async () => {
    const note = makeSeriesNote();
    renderDialog({ entity: seriesEntity(note), mode: "preselected" });

    const dialog = await screen.findByRole("dialog", { name: NAMES.createTitle });
    expect(within(dialog).getByText("Хроніки Дюни")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("posts to the preselected book", async () => {
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "preselected" });

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);

    const call = await onlyWrite();
    expect(call.url).toBe("/api/books/book-1/notes");
  });
});

describe("NoteFormDialog invalidation", () => {
  const KEYS = {
    bookDetails: ["/api/notes", "book", "book-1"],
    booksFacets: ["/api/notes", "archive", "books", "facets"],
    booksList: ["/api/notes", "archive", "books", "list"],
    booksOverview: ["/api/notes", "archive", "books", "overview"],
    booksSummary: ["/api/notes", "archive", "books", "summary"],
    seriesDetails: ["/api/notes", "series", "series-1"],
    seriesFacets: ["/api/notes", "archive", "series", "facets"],
    seriesList: ["/api/notes", "archive", "series", "list"],
    seriesOverview: ["/api/notes", "archive", "series", "overview"],
    seriesSummary: ["/api/notes", "archive", "series", "summary"],
  } as const;

  async function saveAndCollect(target: DialogTarget, submitName: string) {
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderDialog(target, queryClient);

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), " Ще.");
    await submit(submitName);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    return invalidatedKeys(spy);
  }

  it("refreshes the Books page list, facets, summary, overview and the book Details after a book create", async () => {
    const note = makeBookNote();

    const keys = await saveAndCollect(
      { entity: bookEntity(note), mode: "preselected" },
      NAMES.submitCreate,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        KEYS.booksList,
        KEYS.booksFacets,
        KEYS.booksSummary,
        KEYS.booksOverview,
        KEYS.bookDetails,
      ]),
    );
  });

  it("leaves the Series page list, facets and summary alone after a book create", async () => {
    const note = makeBookNote();

    const keys = await saveAndCollect(
      { entity: bookEntity(note), mode: "preselected" },
      NAMES.submitCreate,
    );

    expect(keys).not.toContainEqual(KEYS.seriesList);
    expect(keys).not.toContainEqual(KEYS.seriesFacets);
    expect(keys).not.toContainEqual(KEYS.seriesSummary);
  });

  it("refreshes the Series page list, facets, summary, overview and the series Details after a series create", async () => {
    const note = makeSeriesNote();

    const keys = await saveAndCollect(
      { entity: seriesEntity(note), mode: "preselected" },
      NAMES.submitCreate,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        KEYS.seriesList,
        KEYS.seriesFacets,
        KEYS.seriesSummary,
        KEYS.seriesOverview,
        KEYS.seriesDetails,
      ]),
    );
  });

  it("leaves every Books page query alone after a series create", async () => {
    const note = makeSeriesNote();

    const keys = await saveAndCollect(
      { entity: seriesEntity(note), mode: "preselected" },
      NAMES.submitCreate,
    );

    expect(keys).not.toContainEqual(KEYS.booksList);
    expect(keys).not.toContainEqual(KEYS.booksFacets);
    expect(keys).not.toContainEqual(KEYS.booksSummary);
    expect(keys).not.toContainEqual(KEYS.booksOverview);
  });

  it("refreshes the owner page list and Details but not the summary after an edit", async () => {
    const note = makeBookNote();

    const keys = await saveAndCollect(
      { entity: bookEntity(note), mode: "edit", note },
      NAMES.submitEdit,
    );

    expect(keys).toEqual(expect.arrayContaining([KEYS.booksList, KEYS.bookDetails]));
    expect(keys).not.toContainEqual(KEYS.booksSummary);
  });

  it("invalidates nothing when the create fails", async () => {
    respondToWrite = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "preselected" }, queryClient);

    await userEvent.type(await screen.findByRole("textbox", { name: NAMES.text }), DRAFT);
    await submit(NAMES.submitCreate);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("NoteFormDialog focus", () => {
  it("starts on the book search when the book has to be picked", async () => {
    renderDialog({ entityType: "book", mode: "pick" });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: NAMES.bookSearch })).toHaveFocus(),
    );
  });

  it("starts on the series search when the series has to be picked", async () => {
    renderDialog({ entityType: "series", mode: "pick" });

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: NAMES.seriesSearch })).toHaveFocus(),
    );
  });

  it("starts on the note text when editing", async () => {
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note });

    await waitFor(() => expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveFocus());
  });

  it("starts on the note text when the entity is preselected", async () => {
    const note = makeSeriesNote();
    renderDialog({ entity: seriesEntity(note), mode: "preselected" });

    await waitFor(() => expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveFocus());
  });

  it("wraps Tab from the last control back into the dialog", async () => {
    const note = makeBookNote();
    renderDialog({ entity: bookEntity(note), mode: "edit", note });
    const dialog = await screen.findByRole("dialog", { name: NAMES.editTitle });
    const controls = within(dialog).getAllByRole("button");
    const last = controls.at(-1);
    if (last === undefined) throw new Error("the dialog has no buttons");
    last.focus();

    await userEvent.tab();

    expect(last).not.toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("keeps focus on the Tab target after a keyboard pick collapses the book list", async () => {
    renderDialog({ entityType: "book", mode: "pick" });
    const firstRow = await screen.findByRole("radio", { name: /Дюна/ });
    firstRow.focus();

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard(" ");
    await userEvent.tab();

    expect(screen.queryByRole("radiogroup", { name: NAMES.books })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveFocus();
  });

  it("keeps focus on the Tab target after a keyboard pick collapses the series list", async () => {
    renderDialog({ entityType: "series", mode: "pick" });
    const firstRow = await screen.findByRole("radio", { name: /Хроніки Дюни/ });
    firstRow.focus();

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard(" ");
    await userEvent.tab();

    expect(screen.queryByRole("radio", { name: /Емпіреї/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: NAMES.text })).toHaveFocus();
  });
});
