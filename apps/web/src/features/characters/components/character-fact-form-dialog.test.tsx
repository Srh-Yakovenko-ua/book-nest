import "@testing-library/jest-dom/vitest";
import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { CHARACTER_FACT_ERROR_CODES } from "@app/shared";
import { act, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { CharacterFactFormTarget } from "../model/character-fact-form-schema";

import { makeCharacterFact } from "../model/characters.fixtures";
import { CharacterFactFormDialog } from "./character-fact-form-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const PATHS = {
  book: "/api/books/book-1",
  chapters: "/api/books/book-1/chapters",
  fact: "/api/books/book-1/characters/char-1/facts/fact-1",
  facts: "/api/books/book-1/characters/char-1/facts",
} as const;

const EDIT_TARGET = {
  fact: makeCharacterFact({
    chapter: "Розділ 3",
    id: "fact-1",
    page: 42,
    text: "Носить два мечі.",
    title: "Два мечі",
  }),
  mode: "edit",
} as const satisfies CharacterFactFormTarget;

const PAGE_BEHIND_TEXT = "Сторінка персонажа під формою";

const FALLBACK_FOCUS_LABEL = "Кнопка на сторінці";

const HISTORY_STATES = {
  characterPage: { page: "character" },
  guardedCharacterPage: { characterFactDraftGuard: true, page: "character" },
  previousPage: { page: "previous" },
} as const;

const CLOSE_WAYS = [
  {
    close: () => userEvent.click(screen.getByRole("button", { name: "Скасувати" })),
    name: "Cancel",
  },
  {
    close: () => userEvent.click(screen.getByRole("button", { name: "Close" })),
    name: "the close button",
  },
  { close: () => userEvent.keyboard("{Escape}"), name: "Escape" },
  {
    close: () =>
      userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByText(PAGE_BEHIND_TEXT)),
    name: "a click outside",
  },
];

const fields = {
  chapter: () => screen.getByRole("textbox", { name: /^Розділ/ }),
  page: () => screen.getByRole("spinbutton", { name: /^Сторінка/ }),
  text: () => screen.getByRole("textbox", { name: "Текст" }),
  title: () => screen.getByRole("textbox", { name: "Назва" }),
};

type SaveRequest = { body: unknown; method: string; path: string };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToBook: () => Promise<Response>;
let respondToSave: () => Promise<Response>;
let saveRequests: SaveRequest[];

function bookWithPages(pagesCount: Nullable<number>): Response {
  return jsonResponse(makeBookView({ pagesCount }));
}

function deferredResponse() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function FactFormHarness({
  onClose,
  target,
}: {
  onClose: () => void;
  target: CharacterFactFormTarget;
}) {
  const [open, setOpen] = useState(true);
  const returnFocusRef = useRef<Nullable<HTMLElement>>(null);
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <p>{PAGE_BEHIND_TEXT}</p>
      <button ref={fallbackFocusRef} type="button">
        {FALLBACK_FOCUS_LABEL}
      </button>
      <CharacterFactFormDialog
        fallbackFocusRef={fallbackFocusRef}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        open={open}
        returnFocusRef={returnFocusRef}
        scope={{ bookId: "book-1", characterId: "char-1" }}
        target={target}
      />
    </>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function pressBack() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderForm(target: CharacterFactFormTarget = { mode: "create" }) {
  const onClose = vi.fn();
  renderWithProviders(<FactFormHarness onClose={onClose} target={target} />);
  return { onClose };
}

async function typeNewFact({ page, title }: { page?: string; title: string }) {
  await userEvent.type(fields.title(), title);
  await userEvent.type(fields.text(), "Кобила відьмака.");
  if (page !== undefined) await userEvent.type(fields.page(), page);
}

function unloadIsBlocked(): boolean {
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  return unload.defaultPrevented;
}

beforeEach(() => {
  saveRequests = [];
  respondToBook = () => Promise.resolve(bookWithPages(336));
  respondToSave = () => Promise.resolve(jsonResponse(makeCharacterFact(), 201));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    if (method === "GET" && url.pathname === PATHS.book) return respondToBook();
    if (method === "GET" && url.pathname === PATHS.chapters) {
      return Promise.resolve(jsonResponse({ chapters: [] }));
    }
    const isSave =
      (method === "POST" && url.pathname === PATHS.facts) ||
      (method === "PATCH" && url.pathname === PATHS.fact);
    if (isSave) {
      saveRequests.push({ body: JSON.parse(String(init?.body)), method, path: url.pathname });
      return respondToSave();
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterFactFormDialog validation", () => {
  it("asks for a title and a text before a fact can be added", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    expect(await screen.findByText("Введіть назву факту.")).toBeInTheDocument();
    expect(screen.getByText("Введіть текст факту.")).toBeInTheDocument();
    expect(saveRequests).toEqual([]);
  });

  it("treats a title of spaces only as missing", async () => {
    renderForm();
    await typeNewFact({ title: "   " });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    expect(await screen.findByText("Введіть назву факту.")).toBeInTheDocument();
    expect(saveRequests).toEqual([]);
  });

  it("names the length limit when a stored title is longer than allowed", async () => {
    renderForm({ ...EDIT_TARGET, fact: { ...EDIT_TARGET.fact, title: "м".repeat(121) } });
    await userEvent.type(fields.text(), " Срібний для чудовиськ.");

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(
      await screen.findByText("Назва не може бути довшою за 120 символів."),
    ).toBeInTheDocument();
    expect(saveRequests).toEqual([]);
  });

  it("rejects a page past the last page of the book", async () => {
    renderForm();

    await userEvent.type(fields.page(), "337");
    await userEvent.tab();

    expect(await screen.findByText("У книзі лише 336 сторінок.")).toBeInTheDocument();
  });

  it("accepts the last page of the book", async () => {
    renderForm();
    await typeNewFact({ page: "337", title: "Плотва" });
    await userEvent.tab();
    await screen.findByText("У книзі лише 336 сторінок.");
    await userEvent.clear(fields.page());
    await userEvent.type(fields.page(), "336");

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() => expect(saveRequests).toHaveLength(1));
    expect(saveRequests[0]?.body).toMatchObject({ page: 336 });
  });

  it("rechecks a typed page once the page count of the book arrives", async () => {
    const book = deferredResponse();
    respondToBook = () => book.promise;
    renderForm();
    await userEvent.type(fields.page(), "400");
    await userEvent.tab();

    book.release(bookWithPages(336));

    expect(await screen.findByText("У книзі лише 336 сторінок.")).toBeInTheDocument();
  });

  it("rejects a page past the technical limit when the book has no page count", async () => {
    respondToBook = () => Promise.resolve(bookWithPages(null));
    renderForm();

    await userEvent.type(fields.page(), "2147483648");
    await userEvent.tab();

    expect(await screen.findByText("Номер сторінки завеликий.")).toBeInTheDocument();
  });
});

describe("CharacterFactFormDialog saving", () => {
  it("adds the fact with trimmed values and closes", async () => {
    const { onClose } = renderForm();
    await typeNewFact({ page: "5", title: "  Плотва  " });
    await userEvent.type(fields.chapter(), "Розділ 2");

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(saveRequests).toEqual([
      {
        body: { chapter: "Розділ 2", page: 5, text: "Кобила відьмака.", title: "Плотва" },
        method: "POST",
        path: PATHS.facts,
      },
    ]);
    expect(screen.queryByRole("dialog", { name: "Новий факт" })).not.toBeInTheDocument();
  });

  it("focuses the fallback control after saving a form opened without a trigger", async () => {
    renderForm();
    await typeNewFact({ title: "Плотва" });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: FALLBACK_FOCUS_LABEL })).toHaveFocus(),
    );
  });

  it("sends an empty chapter and page as unknown", async () => {
    renderForm();
    await typeNewFact({ title: "Плотва" });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() => expect(saveRequests).toHaveLength(1));
    expect(saveRequests[0]?.body).toEqual({
      chapter: null,
      page: null,
      text: "Кобила відьмака.",
      title: "Плотва",
    });
  });

  it("shows the server's out-of-book page error on the page and keeps the input", async () => {
    respondToSave = () =>
      Promise.resolve(
        jsonResponse(
          { code: CHARACTER_FACT_ERROR_CODES.pageExceedsBook, message: "Page exceeds book" },
          422,
        ),
      );
    const { onClose } = renderForm();
    await typeNewFact({ page: "300", title: "Плотва" });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    expect(await screen.findByText("Ця сторінка виходить за межі книги.")).toBeInTheDocument();
    expect(fields.title()).toHaveValue("Плотва");
    expect(fields.page()).toHaveValue(300);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the form and its input when the server fails to save", async () => {
    respondToSave = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    const { onClose } = renderForm();
    await typeNewFact({ title: "Плотва" });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() => expect(saveRequests).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Додати факт" })).toBeEnabled());
    expect(screen.getByRole("dialog", { name: "Новий факт" })).toBeInTheDocument();
    expect(fields.title()).toHaveValue("Плотва");
    expect(fields.text()).toHaveValue("Кобила відьмака.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables both actions while the save is in flight", async () => {
    const save = deferredResponse();
    respondToSave = () => save.promise;
    renderForm();
    await typeNewFact({ title: "Плотва" });

    await userEvent.click(screen.getByRole("button", { name: "Додати факт" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Додати факт" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeDisabled();
    await act(async () => save.release(jsonResponse(makeCharacterFact(), 201)));
  });

  it("offers no save for an unchanged edit", () => {
    renderForm(EDIT_TARGET);

    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  });

  it("closes an edit that only adds surrounding spaces without sending it", async () => {
    const { onClose } = renderForm(EDIT_TARGET);
    await userEvent.type(fields.title(), "  ");

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(saveRequests).toEqual([]);
  });

  it("sends only the changed fields of an edit", async () => {
    renderForm(EDIT_TARGET);
    await userEvent.clear(fields.title());
    await userEvent.type(fields.title(), "Срібний меч");

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(saveRequests).toEqual([
        { body: { title: "Срібний меч" }, method: "PATCH", path: PATHS.fact },
      ]),
    );
  });
});

describe("CharacterFactFormDialog unsaved draft guard", () => {
  it.each(CLOSE_WAYS)("asks before discarding a draft closed with $name", async ({ close }) => {
    const { onClose } = renderForm();
    await userEvent.type(fields.title(), "Плотва");

    await close();

    expect(
      await screen.findByRole("alertdialog", { name: "Відкинути зміни?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { hidden: true, name: "Новий факт" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(CLOSE_WAYS)("closes a clean form at once with $name", async ({ close }) => {
    const { onClose } = renderForm();

    await close();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the draft when the user stays", async () => {
    const { onClose } = renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    await userEvent.click(await screen.findByRole("button", { name: "Продовжити редагування" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(fields.title()).toHaveValue("Плотва");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("returns focus to the field the user left when they stay", async () => {
    renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(fields.text());
    await userEvent.keyboard("{Escape}");

    await userEvent.click(await screen.findByRole("button", { name: "Продовжити редагування" }));

    await waitFor(() => expect(fields.text()).toHaveFocus());
  });

  it("returns focus to Cancel when the user stays with Escape", async () => {
    renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));
    await screen.findByRole("alertdialog", { name: "Відкинути зміни?" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Скасувати" })).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("closes the form when the user discards the draft", async () => {
    const { onClose } = renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    await userEvent.click(await screen.findByRole("button", { name: "Так, вийти" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: FALLBACK_FOCUS_LABEL })).toHaveFocus(),
    );
  });

  it("lets the page unload freely while the form is clean", () => {
    renderForm();

    expect(unloadIsBlocked()).toBe(false);
  });

  it("warns before the page unloads while the form has unsaved changes", async () => {
    renderForm();

    await userEvent.type(fields.title(), "Плотва");

    expect(unloadIsBlocked()).toBe(true);
  });

  it("stops warning before unload once the draft is discarded", async () => {
    renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    await userEvent.click(await screen.findByRole("button", { name: "Так, вийти" }));

    expect(unloadIsBlocked()).toBe(false);
  });
});

describe("CharacterFactFormDialog draft guard and browser history", () => {
  beforeEach(() => {
    const traverseBack = window.history.back.bind(window.history);
    vi.spyOn(window.history, "back").mockImplementation(() => {
      setTimeout(traverseBack, 0);
    });
    window.history.pushState(HISTORY_STATES.previousPage, "");
    window.history.pushState(HISTORY_STATES.characterPage, "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a single history entry while the form has unsaved changes", async () => {
    const startLength = window.history.length;
    renderForm();

    await userEvent.type(fields.title(), "Плотва");

    expect(window.history.length).toBe(startLength + 1);
    expect(window.history.state).toEqual(HISTORY_STATES.guardedCharacterPage);
  });

  it("adds no history entry while the form is clean", () => {
    const startLength = window.history.length;

    renderForm();

    expect(window.history.length).toBe(startLength);
    expect(window.history.state).toEqual(HISTORY_STATES.characterPage);
  });

  it("asks before leaving when Back is pressed with unsaved changes", async () => {
    const startLength = window.history.length;
    renderForm();
    await userEvent.type(fields.title(), "Плотва");

    await pressBack();

    expect(
      await screen.findByRole("alertdialog", { name: "Відкинути зміни?" }),
    ).toBeInTheDocument();
    expect(window.history.state).toEqual(HISTORY_STATES.guardedCharacterPage);
    expect(window.history.length).toBe(startLength + 1);
  });

  it("asks again on the next Back after the user stays", async () => {
    renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await pressBack();
    await userEvent.click(await screen.findByRole("button", { name: "Продовжити редагування" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await pressBack();

    expect(
      await screen.findByRole("alertdialog", { name: "Відкинути зміни?" }),
    ).toBeInTheDocument();
  });

  it("completes the Back past the guard entry when the draft is discarded after Back", async () => {
    const { onClose } = renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await pressBack();

    await userEvent.click(await screen.findByRole("button", { name: "Так, вийти" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.history.state).toEqual(HISTORY_STATES.previousPage));
  });

  it("drops its history entry when the draft is discarded with Cancel", async () => {
    renderForm();
    await userEvent.type(fields.title(), "Плотва");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    await userEvent.click(await screen.findByRole("button", { name: "Так, вийти" }));

    await waitFor(() => expect(window.history.state).toEqual(HISTORY_STATES.characterPage));
  });

  it("drops its history entry when the draft is edited back to clean", async () => {
    renderForm();
    await userEvent.type(fields.title(), "П");

    await userEvent.type(fields.title(), "{Backspace}");

    await waitFor(() => expect(window.history.state).toEqual(HISTORY_STATES.characterPage));
  });

  it("lets Back through without asking while the form is clean", async () => {
    renderForm();

    await pressBack();

    expect(window.history.state).toEqual(HISTORY_STATES.previousPage);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
