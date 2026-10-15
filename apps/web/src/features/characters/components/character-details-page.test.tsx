import "@testing-library/jest-dom/vitest";
import type { BookView, CharacterDetailsView, MediaView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeBookCharacterView,
  makeCharacterDetails,
  SPECIES_REFS,
} from "../model/characters.fixtures";
import { CharacterDetailsPage } from "./character-details-page";

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
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const finishedBook = makeBookView({ id: "book-1" });
const bookInProgress = makeBookView({
  id: "book-1",
  readingProgress: {
    abandonedAt: null,
    currentPage: 42,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
  },
  readingStatus: "reading",
});
const fetchMock = vi.fn();

let book: BookView;
let respondToDetails: (url: string) => Response;

function detailsRequestUrl(): string {
  const call = fetchMock.mock.calls.find(([input]) =>
    String(input).includes("/api/characters/char-1"),
  );
  return String(call?.[0]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderPage(search = "", options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharacterDetailsPage characterId="char-1" />
    </NuqsTestingAdapter>,
    options,
  );
}

beforeEach(() => {
  book = finishedBook;
  respondToDetails = () =>
    jsonResponse(
      makeCharacterDetails({
        appearances: [
          makeBookCharacterView({
            book: { cover: null, id: "book-1", series: null, title: "Останнє бажання" },
            bookId: "book-1",
            importance: "central",
          }),
        ],
      }),
    );

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/books/book-1")) return Promise.resolve(jsonResponse(book));
    if (url.includes("/api/characters/char-1")) return Promise.resolve(respondToDetails(url));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterDetailsPage global mode", () => {
  it("renders the profile and the appearances without asking for a book context", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Ґеральт" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Появи" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(detailsRequestUrl()).not.toContain("contextBookId");
  });

  it("uses the compact book data of the appearance instead of fetching each book", async () => {
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.getByText("Останнє бажання")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/books/")),
    ).toHaveLength(0);
  });

  it("names the species by its label in the current locale", async () => {
    respondToDetails = () => jsonResponse(makeCharacterDetails({ species: SPECIES_REFS.witcher }));
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.getByText("Відьмак")).toBeInTheDocument();
    expect(screen.queryByText("Witcher")).not.toBeInTheDocument();
    expect(screen.queryByText("witcher")).not.toBeInTheDocument();
  });
});

describe("CharacterDetailsPage book context", () => {
  it("shows the book section of the context book from the route", async () => {
    renderPage("bookId=book-1");

    expect(await screen.findByRole("heading", { name: "У цій книзі" })).toBeInTheDocument();
  });

  it("sends only the context book from the route and never a reading position", async () => {
    book = bookInProgress;
    renderPage("bookId=book-1");

    await screen.findByRole("heading", { name: "У цій книзі" });

    const query = new URL(detailsRequestUrl(), "http://localhost").searchParams;
    expect(Object.fromEntries(query)).toEqual({ contextBookId: "book-1" });
    expect(query.has("contextPage")).toBe(false);
    expect(query.has("contextChapter")).toBe(false);
    expect(query.has("contextAudioSeconds")).toBe(false);
  });

  it("drops a context the character does not actually appear in", async () => {
    renderPage("bookId=book-404");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Появи" })).toBeInTheDocument();
  });

  it("never names the character when the context request is refused", async () => {
    respondToDetails = () => jsonResponse({ message: "not found" }, 404);

    renderPage("bookId=book-1");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ґеральт")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Відкрити загальний профіль" })).toHaveAttribute(
      "href",
      "/characters/char-1",
    );
  });
});

describe("CharacterDetailsPage unlink", () => {
  it("drops the book from the route and keeps the character", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "DELETE") return Promise.resolve(jsonResponse({}));
      if (url.includes("/api/books/book-1")) return Promise.resolve(jsonResponse(book));
      if (url.includes("/api/characters/char-1")) return Promise.resolve(respondToDetails(url));
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });

    renderPage("bookId=book-1");

    await screen.findByRole("heading", { name: "Керування персонажем" });
    await userEvent.click(screen.getByRole("button", { name: "Прибрати з цієї книги" }));
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/characters/char-1"));
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

function revealedKeysPerRequest(): string[][] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/characters/char-1"))
    .map((url) => new URL(url, "http://localhost").searchParams.getAll("revealFieldIds"));
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
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
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
    const globalAliases = screen.getByRole("group", { name: "Інші імена" });
    expect(within(globalAliases).getByText("Є приховані імена")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Білий Вовк");
  });

  it("reveals only the global aliases from their own group", async () => {
    renderPage("bookId=book-1");

    const globalAliases = await screen.findByRole("group", { name: "Інші імена" });
    await userEvent.click(
      within(globalAliases).getByRole("button", { name: "Показати приховані: Інші імена" }),
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

    await screen.findByRole("group", { name: "Інші імена" });

    expect(
      screen
        .getAllByRole("button", { name: /^Показати приховані:/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Показати приховані: Інші імена в цій книзі", "Показати приховані: Інші імена"]);
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
      target: () => screen.getByRole("group", { name: "Ролі" }),
    },
    {
      button: "Показати приховані: Інші імена в цій книзі",
      target: () => screen.getByRole("group", { name: "Інші імена в цій книзі" }),
    },
    {
      button: "Показати приховані: Інші імена",
      target: () => screen.getByRole("group", { name: "Інші імена" }),
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
    renderPage();

    const globalAliases = await screen.findByRole("group", { name: "Інші імена" });
    await userEvent.click(
      within(globalAliases).getByRole("button", { name: "Показати приховані: Інші імена" }),
    );

    expect(await within(globalAliases).findByText("Білий Вовк")).toBeInTheDocument();
    expect(revealedKeysPerRequest().at(-1)).toEqual(["globalAliases"]);
  });

  it("renders no book alias group even while the book aliases are hidden", async () => {
    renderPage();

    await screen.findByRole("group", { name: "Інші імена" });

    expect(screen.getAllByRole("group", { name: /Інші імена/ })).toHaveLength(1);
    expect(screen.getAllByText("Є приховані імена")).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("Різник із Блавікену");
  });
});
