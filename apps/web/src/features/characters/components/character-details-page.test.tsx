import "@testing-library/jest-dom/vitest";
import type {
  CharacterAppearanceBook,
  CharacterDetailsView,
  CharacterFormView,
  MediaView,
} from "@app/shared";
import type { ReactNode } from "react";

import { parseAsString, useQueryState } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeBookCharacterView,
  makeCharacterDetails,
  SPECIES_REFS,
} from "../model/characters.fixtures";
import { CharacterDetailsPage } from "./character-details-page";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToDetails: (url: string) => Response;

function appearanceIn(book: CharacterAppearanceBook, overrides = {}) {
  return makeBookCharacterView({
    book,
    bookId: book.id,
    id: `appearance-${book.id}`,
    status: "active",
    ...overrides,
  });
}

function bookOf(
  id: string,
  title: string,
  series: CharacterAppearanceBook["series"] = null,
): CharacterAppearanceBook {
  return { cover: null, id, series, title };
}

const firstBook = bookOf("book-1", "Останнє бажання");
const secondBook = bookOf("book-2", "Меч призначення");

function characterRequests(): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/characters/char-1"))
    .map((url) => new URL(url, "http://localhost").searchParams);
}

function ContextSwitch({ bookId }: { bookId: string }) {
  const [, setBookId] = useQueryState("bookId", parseAsString);
  return (
    <button onClick={() => void setBookId(bookId)} type="button">
      switch context
    </button>
  );
}

function contextualRequests(): URLSearchParams[] {
  return characterRequests().filter((query) => query.has("contextBookId"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeForm(index: number, overrides: Partial<CharacterFormView> = {}): CharacterFormView {
  return {
    characterId: "char-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    formType: "transformation",
    id: `form-${index}`,
    isSpoiler: false,
    name: `Форма ${index}`,
    portrait: null,
    position: index,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage(search = "", options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharacterDetailsPage characterId="char-1" />
    </NuqsTestingAdapter>,
    options,
  );
}

function respondWith(character: CharacterDetailsView) {
  respondToDetails = () => jsonResponse(character);
}

function sidebar(): HTMLElement {
  return screen.getByRole("complementary");
}

function sidebarBookTitles(): string[] {
  return within(sidebar())
    .getAllByRole("link", { name: /^Відкрити книгу:/ })
    .map((link) => (link.getAttribute("aria-label") ?? "").replace("Відкрити книгу: ", ""));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  respondWith(makeCharacterDetails({ appearances: [appearanceIn(firstBook)] }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH" || method === "DELETE") {
      return Promise.resolve(jsonResponse(makeCharacterDetails()));
    }
    if (url.includes("/api/characters/char-1")) return Promise.resolve(respondToDetails(url));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterDetailsPage context from the URL", () => {
  it("opens the only book of a character without a context and makes that URL canonical", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "У вибраній книзі" })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/characters/char-1?bookId=book-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps a character with several books on the general profile", async () => {
    respondWith(
      makeCharacterDetails({ appearances: [appearanceIn(firstBook), appearanceIn(secondBook)] }),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У вибраній книзі" })).not.toBeInTheDocument();
    expect(contextualRequests()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the general profile chosen explicitly even with a single book", async () => {
    renderPage("view=global");

    expect(await screen.findByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У вибраній книзі" })).not.toBeInTheDocument();
    expect(contextualRequests()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
  });

  it("lets the book win over a conflicting view and drops the view with a replace", async () => {
    renderPage("bookId=book-1&view=global");

    expect(await screen.findByRole("heading", { name: "У вибраній книзі" })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/characters/char-1?bookId=book-1");
  });

  it("drops an unknown view and makes the smart choice", async () => {
    respondWith(
      makeCharacterDetails({ appearances: [appearanceIn(firstBook), appearanceIn(secondBook)] }),
    );
    renderPage("view=unknown");

    expect(await screen.findByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/characters/char-1");
  });

  it("treats an empty book id as an unavailable context and asks the API nothing", async () => {
    renderPage("bookId=");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(characterRequests()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Відкрити загальний профіль" })).toHaveAttribute(
      "href",
      "/characters/char-1?view=global",
    );
  });

  it("never falls back to the general profile for a book the character is not in", async () => {
    renderPage("bookId=book-404");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(contextualRequests()).toHaveLength(0);
    expect(screen.queryByText("Ґеральт")).not.toBeInTheDocument();
  });

  it("refuses a contextual answer that names only another book of the series", async () => {
    respondToDetails = (url) =>
      jsonResponse(
        makeCharacterDetails({
          appearances: url.includes("contextBookId")
            ? [appearanceIn(firstBook)]
            : [appearanceIn(firstBook), appearanceIn(secondBook)],
        }),
      );
    renderPage("bookId=book-2");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ґеральт")).not.toBeInTheDocument();
  });

  it("never names the character when the context request is refused", async () => {
    respondToDetails = (url) =>
      url.includes("contextBookId")
        ? jsonResponse({ message: "not found" }, 404)
        : jsonResponse(makeCharacterDetails({ appearances: [appearanceIn(firstBook)] }));
    renderPage("bookId=book-1");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ґеральт")).not.toBeInTheDocument();
  });

  it("offers a retry of the failed context request instead of calling the book unavailable", async () => {
    let contextualStatus = 500;
    respondToDetails = (url) =>
      url.includes("contextBookId") && contextualStatus !== 200
        ? jsonResponse({ message: "boom" }, contextualStatus)
        : jsonResponse(makeCharacterDetails({ appearances: [appearanceIn(firstBook)] }));
    renderPage("bookId=book-1");

    const retry = await screen.findByRole("button", { name: "Спробувати ще раз" });
    expect(screen.queryByText("Персонаж недоступний у цій книзі")).not.toBeInTheDocument();
    contextualStatus = 200;
    await userEvent.click(retry);

    expect(await screen.findByRole("heading", { name: "У вибраній книзі" })).toBeInTheDocument();
    expect(contextualRequests()).toHaveLength(2);
  });

  it("sends only the context book and never a reading position", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { name: "У вибраній книзі" });

    expect(contextualRequests().map((query) => Object.fromEntries(query))).toEqual([
      { contextBookId: "book-1" },
    ]);
  });

  it("switches the context with a push from the selector", async () => {
    respondWith(
      makeCharacterDetails({ appearances: [appearanceIn(firstBook), appearanceIn(secondBook)] }),
    );
    renderPage("view=global");

    await userEvent.click(await screen.findByRole("combobox", { name: "Контекст перегляду" }));
    await userEvent.click(await screen.findByRole("option", { name: "Меч призначення" }));

    expect(push).toHaveBeenCalledWith("/characters/char-1?bookId=book-2");
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders no context selector and no appearances for a character without books", async () => {
    respondWith(makeCharacterDetails({ appearances: [] }));
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.queryByRole("combobox", { name: "Контекст перегляду" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("CharacterDetailsPage appearances", () => {
  it("uses the compact book data of the appearance instead of fetching each book", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { name: "У вибраній книзі" });

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/books/")),
    ).toHaveLength(0);
  });

  it("orders the books by series, part number and title", async () => {
    respondWith(
      makeCharacterDetails({
        appearances: [
          appearanceIn(
            bookOf("b-a", "Хрещення вогнем", { id: "s-w", name: "Відьмак", partNumber: 5 }),
          ),
          appearanceIn(bookOf("b-b", "Кров ельфів", { id: "s-w", name: "Відьмак", partNumber: 3 })),
          appearanceIn(bookOf("b-c", "Аарон")),
          appearanceIn(
            bookOf("b-d", "Без номера", { id: "s-a", name: "Аврора", partNumber: null }),
          ),
          appearanceIn(bookOf("b-e", "Перша", { id: "s-a", name: "Аврора", partNumber: 1 })),
        ],
      }),
    );
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(sidebarBookTitles()).toEqual([
      "Перша",
      "Без номера",
      "Кров ельфів",
      "Хрещення вогнем",
      "Аарон",
    ]);
  });

  it("shows five books, pins the current one and keeps the list expanded across contexts", async () => {
    const books = Array.from({ length: 7 }, (_, index) =>
      bookOf(`book-${index + 1}`, `Книга ${index + 1}`),
    );
    respondWith(makeCharacterDetails({ appearances: books.map((book) => appearanceIn(book)) }));
    renderWithProviders(
      <NuqsTestingAdapter hasMemory searchParams="bookId=book-7">
        <CharacterDetailsPage characterId="char-1" />
        <ContextSwitch bookId="book-1" />
      </NuqsTestingAdapter>,
    );

    await screen.findByRole("heading", { name: "У вибраній книзі" });
    expect(within(sidebar()).getByText("Поточний контекст")).toBeInTheDocument();
    expect(sidebarBookTitles()).toEqual([
      "Книга 7",
      "Книга 1",
      "Книга 2",
      "Книга 3",
      "Книга 4",
      "Книга 5",
    ]);

    await userEvent.click(within(sidebar()).getByRole("button", { name: "Показати всі 7 книг" }));
    expect(sidebarBookTitles()).toHaveLength(7);
    expect(within(sidebar()).queryByText("Поточний контекст")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "switch context" }));
    await waitFor(() =>
      expect(contextualRequests().map((query) => query.get("contextBookId"))).toContain("book-1"),
    );
    await screen.findByRole("heading", { name: "У вибраній книзі" });

    expect(within(sidebar()).getByRole("button", { name: "Згорнути" })).toBeInTheDocument();
    expect(sidebarBookTitles()).toHaveLength(7);
    expect(
      within(sidebar()).getByRole("link", { current: "page", name: /Книга 1/ }),
    ).toBeInTheDocument();
  });

  it("marks no book as current on the general profile and opens a book separately", async () => {
    respondWith(
      makeCharacterDetails({ appearances: [appearanceIn(firstBook), appearanceIn(secondBook)] }),
    );
    renderPage("view=global");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(within(sidebar()).queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(
      within(sidebar()).getByRole("link", { name: "Відкрити книгу: Меч призначення" }),
    ).toHaveAttribute("href", "/books/book-2");
  });
});

describe("CharacterDetailsPage hero", () => {
  function patchCall(): [string, RequestInit] | undefined {
    return fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    ) as [string, RequestInit] | undefined;
  }

  it("toggles the favorite through the global update without a book", async () => {
    renderPage("bookId=book-1");

    await userEvent.click(await screen.findByRole("button", { name: "Додати в улюблені" }));

    await waitFor(() => expect(patchCall()).toBeDefined());
    const [url, init] = patchCall() ?? ["", {}];
    expect(url).toMatch(/\/api\/characters\/char-1$/);
    expect(JSON.parse(String(init.body))).toEqual({ isFavorite: true });
  });

  it("offers edit, unlink and delete in a book", async () => {
    renderPage("bookId=book-1");

    await userEvent.click(await screen.findByRole("button", { name: "Дії з персонажем" }));

    expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toHaveAttribute(
      "href",
      "/characters/char-1/edit?bookId=book-1",
    );
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Прибрати з цієї книги",
      "Видалити персонажа повністю",
    ]);
  });

  it("edits the general profile and offers no unlink outside a book", async () => {
    renderPage("view=global");

    await userEvent.click(await screen.findByRole("button", { name: "Дії з персонажем" }));

    expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toHaveAttribute(
      "href",
      "/characters/char-1/edit?view=global",
    );
    expect(
      screen.queryByRole("menuitem", { name: "Прибрати з цієї книги" }),
    ).not.toBeInTheDocument();
  });

  it("drops the book from the route after an unlink and keeps the character", async () => {
    renderPage("bookId=book-1");

    await userEvent.click(await screen.findByRole("button", { name: "Дії з персонажем" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Прибрати з цієї книги" }));
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/characters/char-1"));
  });
});

describe("CharacterDetailsPage book cards", () => {
  it("names the effective species and attitude with their source", async () => {
    respondWith(
      makeCharacterDetails({
        appearances: [appearanceIn(firstBook, { attitude: "like" })],
        globalAttitude: "neutral",
        species: SPECIES_REFS.witcher,
      }),
    );
    renderPage("bookId=book-1");

    const species = await screen.findByRole("group", { name: "Вид" });
    expect(within(species).getByText("Відьмак")).toBeInTheDocument();
    expect(within(species).getByText("Із загального профілю")).toBeInTheDocument();
    expect(screen.getAllByText("Відьмак")).toHaveLength(1);
    const attitude = screen.getByRole("group", { name: "Ставлення" });
    expect(attitude).toHaveTextContent("Подобається");
    expect(attitude).toHaveTextContent("Для цієї книги");
    expect(screen.getByText("Нейтрально")).toBeInTheDocument();
  });

  it("lists the first appearance from chapter to audio position", async () => {
    respondWith(
      makeCharacterDetails({
        appearances: [
          appearanceIn(firstBook, {
            firstAppearanceAudioSeconds: 5075,
            firstAppearanceChapter: "3",
            firstAppearanceNote: "На мосту",
            firstAppearancePage: 42,
          }),
        ],
      }),
    );
    renderPage("bookId=book-1");

    expect(await screen.findByText("Розділ 3")).toBeInTheDocument();
    expect(screen.getByText("стор. 42")).toBeInTheDocument();
    expect(screen.getByText("Аудіо 01:24:35")).toBeInTheDocument();
    expect(screen.getByText("На мосту")).toBeInTheDocument();
  });

  it("names the species by its label in the current locale", async () => {
    respondWith(makeCharacterDetails({ species: SPECIES_REFS.witcher }));
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.getByText("Відьмак")).toBeInTheDocument();
    expect(screen.queryByText("Witcher")).not.toBeInTheDocument();
  });
});

describe("CharacterDetailsPage forms", () => {
  function formHeadings(): string[] {
    return screen
      .queryAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent ?? "");
  }

  it("shows four forms first and the rest on demand", async () => {
    respondWith(
      makeCharacterDetails({ forms: Array.from({ length: 6 }, (_, index) => makeForm(index)) }),
    );
    renderPage();

    await screen.findByRole("heading", { name: "Форми та образи" });
    expect(formHeadings()).toHaveLength(4);

    await userEvent.click(screen.getByRole("button", { name: "Показати всі" }));
    expect(formHeadings()).toHaveLength(6);
  });

  it("reveals the spoiler forms only on request, in position order and all at once", async () => {
    const visible = Array.from({ length: 5 }, (_, index) => makeForm(index * 2));
    const spoilers = [
      makeForm(1, { isSpoiler: true, name: "Справжня подоба" }),
      makeForm(3, { isSpoiler: true }),
    ];
    respondToDetails = (url) =>
      jsonResponse(
        url.includes("revealFieldIds=forms")
          ? makeCharacterDetails({
              forms: [...visible, ...spoilers].sort(
                (left, right) => left.position - right.position,
              ),
            })
          : makeCharacterDetails({ forms: visible, hiddenFields: ["forms"] }),
      );
    renderPage();

    await screen.findByText("Є приховані форми");
    expect(document.body).not.toHaveTextContent("Справжня подоба");

    await userEvent.click(screen.getByRole("button", { name: "Показати спойлерні форми" }));

    await waitFor(() => expect(formHeadings()).toHaveLength(7));
    expect(formHeadings().slice(0, 3)).toEqual(["Форма 0", "Справжня подоба", "Форма 2"]);
    expect(screen.queryByText("Є приховані форми")).not.toBeInTheDocument();
    expect(characterRequests().at(-1)?.getAll("revealFieldIds")).toEqual(["forms"]);
  });

  it("keeps the masked forms when the reveal fails", async () => {
    respondToDetails = (url) =>
      url.includes("revealFieldIds")
        ? jsonResponse({ message: "boom" }, 500)
        : jsonResponse(makeCharacterDetails({ forms: [makeForm(0)], hiddenFields: ["forms"] }));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Показати спойлерні форми" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося показати приховане"));
    expect(screen.getByText("Є приховані форми")).toBeInTheDocument();
    expect(formHeadings()).toEqual(["Форма 0"]);
  });

  it("opens a form portrait in the image viewer", async () => {
    respondWith(
      makeCharacterDetails({
        forms: [makeForm(0, { portrait: spoilerPortrait })],
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Відкрити зображення: Форма 0" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders no forms section without forms or a hidden marker", async () => {
    respondWith(makeCharacterDetails());
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.queryByRole("heading", { name: "Форми та образи" })).not.toBeInTheDocument();
  });
});

const spoilerPortrait: MediaView = {
  contentType: "image/png",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 512,
  id: "media-portrait-1",
  kind: "avatar",
  name: "portrait.png",
  sizeBytes: 2048,
  urls: { card: "portrait-card.webp", full: "portrait-full.webp", thumb: "portrait-thumb.webp" },
  width: 512,
};

const spoilerCharacter = makeCharacterDetails({
  aliases: [
    {
      bookId: null,
      id: "alias-global-plain",
      isSpoiler: false,
      name: "Ґвинблейд",
      position: 0,
      type: "nickname",
    },
    {
      bookId: null,
      id: "alias-global-spoiler",
      isSpoiler: true,
      name: "Білий Вовк",
      position: 1,
      type: "title",
    },
    {
      bookId: "book-1",
      id: "alias-book-spoiler",
      isSpoiler: true,
      name: "Різник із Блавікену",
      position: 0,
      type: "title",
    },
  ],
  appearances: [
    makeBookCharacterView({
      book: { cover: null, id: "book-1", series: null, title: "Останнє бажання" },
      bookId: "book-1",
      description: "Таємниця Цирі",
      descriptionIsSpoiler: true,
      displayName: "Вовк із Рівії",
      displayNameIsSpoiler: true,
      importance: "central",
      portrait: spoilerPortrait,
      portraitIsSpoiler: true,
      roles: [
        {
          customRole: null,
          id: "role-plain",
          isSpoiler: false,
          position: 0,
          roleType: "protagonist",
        },
        {
          customRole: null,
          id: "role-spoiler",
          isSpoiler: true,
          position: 1,
          roleType: "love_interest",
        },
      ],
      status: "dead",
      statusIsSpoiler: true,
    }),
  ],
});

const MASKED_VALUES = [
  "Вовк із Рівії",
  "Білий Вовк",
  "Різник із Блавікену",
  "Любовний інтерес",
  "Таємниця Цирі",
  "Мертвий",
];

class LoadedImage extends EventTarget {
  complete = true;
  crossOrigin: null | string = null;
  naturalWidth = 1;
  referrerPolicy = "";
  src = "";
}

function maskedSpoilerCharacter(url: string): CharacterDetailsView {
  const revealed = new URL(url, "http://localhost").searchParams.getAll("revealFieldIds");
  const isRevealed = (key: string) => revealed.includes(key);

  return {
    ...spoilerCharacter,
    aliases: spoilerCharacter.aliases.filter(
      (alias) =>
        !alias.isSpoiler || isRevealed(alias.bookId === null ? "globalAliases" : "bookAliases"),
    ),
    appearances: spoilerCharacter.appearances.map((appearance) => ({
      ...appearance,
      description: isRevealed("description") ? appearance.description : null,
      displayName: isRevealed("displayName") ? appearance.displayName : null,
      hiddenFields: ["description", "displayName", "portrait", "roles", "status"].filter(
        (key) => !isRevealed(key),
      ),
      portrait: isRevealed("portrait") ? appearance.portrait : null,
      roles: appearance.roles.filter((role) => !role.isSpoiler || isRevealed("roles")),
      status: isRevealed("status") ? appearance.status : null,
    })),
    hiddenFields: ["globalAliases", "bookAliases"].filter((key) => !isRevealed(key)),
  };
}

function revealedGlobalKeysPerRequest(): string[][] {
  return characterRequests()
    .filter((query) => !query.has("contextBookId"))
    .map((query) => query.getAll("revealFieldIds"));
}

function revealedKeysPerRequest(): string[][] {
  return contextualRequests().map((query) => query.getAll("revealFieldIds"));
}

describe("CharacterDetailsPage spoiler reveal in a book", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    respondToDetails = (url) => jsonResponse(maskedSpoilerCharacter(url));
  });

  it("keeps every masked value out of the page before anything is revealed", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.getByText("Ґвинблейд")).toBeInTheDocument();
    expect(screen.getByText("Протагоніст")).toBeInTheDocument();
    for (const value of MASKED_VALUES) {
      expect(document.body).not.toHaveTextContent(value);
    }
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(revealedKeysPerRequest()).toEqual([[]]);
  });

  it("asks for the roles and then shows the spoiler role", async () => {
    renderPage("bookId=book-1");

    await userEvent.click(await screen.findByRole("button", { name: "Показати приховані ролі" }));

    expect(await screen.findByText("Любовний інтерес")).toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual(["roles"]);
    expect(screen.queryByText("Є приховані ролі")).not.toBeInTheDocument();
  });

  it("keeps the page and marks only the clicked button as pending while a reveal loads", async () => {
    let releaseReveal: () => void = () => undefined;
    const revealHeld = new Promise<void>((resolve) => {
      releaseReveal = resolve;
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const response = jsonResponse(maskedSpoilerCharacter(url));
      return url.includes("revealFieldIds")
        ? revealHeld.then(() => response)
        : Promise.resolve(response);
    });
    renderPage("bookId=book-1");

    const rolesButton = await screen.findByRole("button", { name: "Показати приховані ролі" });
    await userEvent.click(rolesButton);

    expect(rolesButton).toBeEnabled();
    expect(rolesButton).toHaveAttribute("aria-busy", "true");
    expect(rolesButton).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1, name: "Ґеральт" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /^Показати приховані:/ })) {
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute("aria-busy");
    }
    expect(screen.getByRole("button", { name: "Показати поле: Статус" })).not.toHaveAttribute(
      "aria-busy",
    );

    await userEvent.click(rolesButton);
    expect(revealedKeysPerRequest()).toEqual([[], ["roles"]]);

    releaseReveal();
    expect(await screen.findByText("Любовний інтерес")).toBeInTheDocument();
  });

  it("announces the hidden roles with a single button and no count", async () => {
    renderPage("bookId=book-1");

    expect(await screen.findByText("Є приховані ролі")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ролі/ })).toEqual([
      screen.getByRole("button", { name: "Показати приховані ролі" }),
    ]);
    expect(
      within(screen.getByRole("group", { name: "Ролі в сюжеті" })).queryByText(/\d/),
    ).not.toBeInTheDocument();
  });

  it("reveals only the book aliases from their own group", async () => {
    renderPage("bookId=book-1");

    const bookAliases = await screen.findByRole("group", { name: "Інші імена в цій книзі" });
    await userEvent.click(
      within(bookAliases).getByRole("button", {
        name: "Показати приховані: Інші імена в цій книзі",
      }),
    );

    expect(await within(bookAliases).findByText("Різник із Блавікену")).toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual(["bookAliases"]);
    const globalAliases = screen.getByRole("group", { name: "Інші імена персонажа" });
    expect(within(globalAliases).getByText("Є приховані імена")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Білий Вовк");
  });

  it("reveals only the global aliases from their own group", async () => {
    renderPage("bookId=book-1");

    const globalAliases = await screen.findByRole("group", { name: "Інші імена персонажа" });
    await userEvent.click(
      within(globalAliases).getByRole("button", {
        name: "Показати приховані: Інші імена персонажа",
      }),
    );

    expect(await within(globalAliases).findByText("Білий Вовк")).toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual(["globalAliases"]);
    const bookAliases = screen.getByRole("group", { name: "Інші імена в цій книзі" });
    expect(within(bookAliases).getByText("Є приховані імена")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Різник із Блавікену");
  });

  it("puts the book name into the header once it is revealed", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });
    await userEvent.click(screen.getByRole("button", { name: "Показати поле: Ім’я в цій книзі" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Вовк із Рівії" }),
    ).toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual(["displayName"]);
  });

  it("puts the book portrait into the header once it is revealed", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });
    await userEvent.click(
      screen.getByRole("button", { name: "Показати поле: Зображення в цій книзі" }),
    );

    expect(await screen.findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      spoilerPortrait.urls.card,
    );
    expect(revealedKeysPerRequest().at(-1)).toEqual(["portrait"]);
  });

  it("shows a masked status only after its reveal", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });
    await userEvent.click(screen.getByRole("button", { name: "Показати поле: Статус" }));

    expect(await screen.findAllByText("Мертвий")).not.toHaveLength(0);
    expect(revealedKeysPerRequest().at(-1)).toEqual(["status"]);
  });

  it("names each alias group button after its own group", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("group", { name: "Інші імена персонажа" });

    expect(
      screen
        .getAllByRole("button", { name: /^Показати приховані:/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Показати приховані: Інші імена в цій книзі",
      "Показати приховані: Інші імена персонажа",
    ]);
  });

  it("leaves the focus alone while the page loads", async () => {
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(document.body).toHaveFocus();
  });

  it.each<{ button: string; target: () => HTMLElement }>([
    {
      button: "Показати поле: Статус",
      target: () => screen.getByRole("group", { name: "Статус" }),
    },
    {
      button: "Показати приховані ролі",
      target: () => screen.getByRole("group", { name: "Ролі в сюжеті" }),
    },
    {
      button: "Показати приховані: Інші імена в цій книзі",
      target: () => screen.getByRole("group", { name: "Інші імена в цій книзі" }),
    },
    {
      button: "Показати приховані: Інші імена персонажа",
      target: () => screen.getByRole("group", { name: "Інші імена персонажа" }),
    },
    {
      button: "Показати поле: Ім’я в цій книзі",
      target: () => screen.getByRole("heading", { level: 1, name: "Вовк із Рівії" }),
    },
  ])("moves the focus to what $button revealed", async ({ button, target }) => {
    renderPage("bookId=book-1");

    (await screen.findByRole("button", { name: button })).focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(target()).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("starts over with nothing revealed after the page is mounted again", async () => {
    const { queryClient, unmount } = renderPage("bookId=book-1");

    await userEvent.click(await screen.findByRole("button", { name: "Показати приховані ролі" }));
    await screen.findByText("Любовний інтерес");
    unmount();
    renderPage("bookId=book-1", { queryClient });

    expect(await screen.findByText("Є приховані ролі")).toBeInTheDocument();
    expect(screen.queryByText("Любовний інтерес")).not.toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual([]);
  });
});

describe("CharacterDetailsPage spoiler reveal on the global profile", () => {
  beforeEach(() => {
    respondToDetails = (url) => jsonResponse(maskedSpoilerCharacter(url));
  });

  it("reveals the hidden global aliases", async () => {
    renderPage("view=global");

    const globalAliases = await screen.findByRole("group", { name: "Інші імена персонажа" });
    await userEvent.click(
      within(globalAliases).getByRole("button", {
        name: "Показати приховані: Інші імена персонажа",
      }),
    );

    expect(await within(globalAliases).findByText("Білий Вовк")).toBeInTheDocument();
    expect(revealedGlobalKeysPerRequest().at(-1)).toEqual(["globalAliases"]);
  });

  it("renders no book alias group even while the book aliases are hidden", async () => {
    renderPage("view=global");

    await screen.findByRole("group", { name: "Інші імена персонажа" });

    expect(screen.getAllByRole("group", { name: /Інші імена/ })).toHaveLength(1);
    expect(screen.getAllByText("Є приховані імена")).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("Різник із Блавікену");
  });
});
