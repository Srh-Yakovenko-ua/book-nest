import "@testing-library/jest-dom/vitest";
import type { BookCharacterView, CharacterDetailsView, MediaView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

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
      speciesOverride: "Мутант",
      status: "active",
    }),
  ],
  gender: "male",
  name: "Ґеральт",
  species: "Відьмак",
});

const fetchMock = vi.fn();

let bookPatchStatus: number;
let servedCharacter: CharacterDetailsView;

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
  servedCharacter = character;

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/characters/char-1")) {
      return Promise.resolve(jsonResponse(servedCharacter));
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
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("description", "Опис у книзі ще трохи");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("sends both updates when both scopes changed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(globalPatchBody()).toBeDefined();
  });

  it("keeps the failed scope dirty and does not resend the saved one on retry", async () => {
    bookPatchStatus = 500;
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(screen.getByRole("textbox", { name: /^Дані в цій книзі/ })).toHaveValue(
      "Опис у книзі ще трохи",
    );
    expect(push).not.toHaveBeenCalled();

    bookPatchStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(3));
  });
});

describe("CharacterEditPage leaving a dirty form", () => {
  it("offers to keep editing instead of losing the changes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Так, вийти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продовжити редагування" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
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

function inheritedField(label: string): HTMLElement {
  const shell = screen.getByText(label).closest('[data-slot="inherited-field"]');
  if (!(shell instanceof HTMLElement)) throw new Error(`no inherited field labelled ${label}`);
  return shell;
}

describe("CharacterEditPage inheritance", () => {
  it("shows the effective global value while the book value is inherited", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const displayName = inheritedField("Ім’я в цій книзі");
    expect(within(displayName).getByText("Ґеральт")).toBeInTheDocument();
    expect(within(displayName).getByText("Використовується основне значення")).toBeInTheDocument();
    expect(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    ).toBeInTheDocument();
  });

  it("prefills the book value from the global one and sends it on save", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");

    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );

    const input = within(displayName).getByRole("textbox");
    expect(input).toHaveValue("Ґеральт");
    await userEvent.type(input, " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("displayName", "Ґеральт із Рівії");
    expect(globalPatchBody()).toBeUndefined();
  });

  it("writes no book value when the field is reset to the global one", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const species = inheritedField("Вид у цій книзі");

    expect(within(species).getByText("Лише для цієї книги")).toBeInTheDocument();
    await userEvent.click(
      within(species).getByRole("button", { name: "Використовувати основне значення" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("speciesOverride", null);
  });
});

describe("CharacterEditPage aliases", () => {
  function aliasGroup(title: string): HTMLElement {
    const heading = screen.getByRole("heading", { name: title });
    const group = heading.parentElement?.parentElement;
    if (!(group instanceof HTMLElement)) throw new Error(`no alias group titled ${title}`);
    return group;
  }

  it("saves each group into its own scope and sends no per-row request", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    await userEvent.click(
      within(aliasGroup("Альтернативні імена")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Альтернативні імена")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "Білий Вовк",
    );

    await userEvent.click(
      within(aliasGroup("Інші імена в цій книзі")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Інші імена в цій книзі")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "Різник",
    );

    expect(patchCount()).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(patchCount()).toBe(2));
    expect(globalPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Білий Вовк", position: 0, type: "other" },
    ]);
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Різник", position: 0, type: "other" },
    ]);
  });

  it("refuses an alias that repeats the main name", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    await userEvent.click(
      within(aliasGroup("Альтернативні імена")).getByRole("button", { name: "Додати ім’я" }),
    );
    await userEvent.type(
      within(aliasGroup("Альтернативні імена")).getByRole("textbox", {
        name: "Альтернативне ім’я",
      }),
      "ґеральт",
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Це основне ім’я персонажа")).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });
});

describe("CharacterEditPage narrative metadata", () => {
  it("reveals the narrator control only while the character is a point of view", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(screen.queryByText("Тип наратора")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "POV-персонаж" }));

    expect(await screen.findByText("Тип наратора")).toBeInTheDocument();
  });

  it("refuses a page that is not a number and sends nothing", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /^Сторінка/ }), "сорок");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть номер сторінки числом")).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });

  it("keeps a non-numeric chapter exactly as typed", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /^Розділ/ }), "Пролог");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("firstAppearanceChapter", "Пролог");
  });
});

describe("CharacterEditPage spoilers", () => {
  it("opens collapsed and keeps hide-presence separate from the granular switches", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(
      screen.getByRole("switch", { name: "Приховати сам факт появи персонажа" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Моє враження" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));

    expect(await screen.findByRole("switch", { name: "Моє враження" })).toBeInTheDocument();
  });

  it("keeps the granular settings when hide presence is turned on", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));
    await userEvent.click(screen.getByRole("switch", { name: "Моє враження" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Приховати сам факт появи персонажа" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toMatchObject({
      hidePresenceAsSpoiler: true,
      personalImpressionIsSpoiler: true,
    });
  });

  it("offers no spoiler switch for the point of view or the first appearance", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("button", { name: "Налаштувати, що саме приховати" }));

    expect(screen.getAllByRole("switch")).toHaveLength(9);
    expect(screen.queryByRole("switch", { name: "Перша поява" })).not.toBeInTheDocument();
  });
});

function previewRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Попередній перегляд" });
}

describe("CharacterEditPage layout by mode", () => {
  it("lays out the six book sections in reading order", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    const sectionTitles = [
      "У цій книзі",
      "Роль у розповіді",
      "Про персонажа",
      "Лише для цієї книги",
      "Інші імена",
      "Спойлери",
    ];
    const renderedTitles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent ?? "")
      .filter((title) => sectionTitles.includes(title));

    expect(renderedTitles).toEqual(sectionTitles);
  });

  it("renders only the shared sections without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("heading", { level: 2, name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Інші імена" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Роль у розповіді" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Лише для цієї книги" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Спойлери" })).not.toBeInTheDocument();
  });

  it("shows the book portrait panel next to the preview in a book context", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("region", { name: "Зображення в цій книзі" })).toBeInTheDocument();
    expect(previewRegion()).toBeInTheDocument();
  });

  it("shows the preview but no portrait panel or upload control without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(previewRegion()).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Зображення в цій книзі" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /зображення/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/зображення/i)).not.toBeInTheDocument();
  });
});

const uploadedPortrait: MediaView = {
  contentType: "image/png",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 512,
  id: "media-portrait-1",
  kind: "avatar",
  name: "portrait.png",
  sizeBytes: 2048,
  urls: {
    card: "https://media.dev.book-nest.net/portrait-card.webp",
    full: "https://media.dev.book-nest.net/portrait-full.webp",
    thumb: "https://media.dev.book-nest.net/portrait-thumb.webp",
  },
  width: 512,
};

class LoadedImage extends EventTarget {
  complete = true;
  crossOrigin: null | string = null;
  naturalWidth = 1;
  referrerPolicy = "";
  src = "";
}

async function choosePortraitFile(fileInputLabel = "Перетягніть зображення сюди") {
  await userEvent.upload(
    within(portraitPanel()).getByLabelText(fileInputLabel),
    new File(["portrait-bytes"], "portrait.png", { type: "image/png" }),
  );
}

function portraitPanel(): HTMLElement {
  return screen.getByRole("region", { name: "Зображення в цій книзі" });
}

function serveMediaUpload(respond: () => Promise<Response>) {
  const pageFetch = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && String(input).includes("/api/media")) return respond();
    return pageFetch?.(input, init);
  });
}

async function uploadPortrait(fileInputLabel?: string) {
  await choosePortraitFile(fileInputLabel);
  await within(portraitPanel()).findByRole("button", {
    name: "Використовувати основне зображення",
  });
}

describe("CharacterEditPage live preview", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    serveMediaUpload(() => Promise.resolve(jsonResponse(uploadedPortrait, 201)));
  });

  it("shows the global name while the display name is inherited", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("follows the global name as it is typed, before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");

    expect(
      within(previewRegion()).getByRole("heading", { name: "Ґеральт із Рівії" }),
    ).toBeInTheDocument();
    expect(patchCount()).toBe(0);
  });

  it("shows the book display name once it is overridden", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Біловолосий");

    expect(
      within(previewRegion()).getByRole("heading", { name: "Біловолосий" }),
    ).toBeInTheDocument();
    expect(
      within(previewRegion()).queryByRole("heading", { name: "Ґеральт" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the global name while the overridden display name is blank", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "   ");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("returns to the global name when the display name is reset", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const displayName = inheritedField("Ім’я в цій книзі");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Змінити лише для цієї книги" }),
    );
    const input = within(displayName).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Біловолосий");
    await userEvent.click(
      within(displayName).getByRole("button", { name: "Використовувати основне значення" }),
    );

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(
      within(previewRegion()).queryByRole("heading", { name: "Біловолосий" }),
    ).not.toBeInTheDocument();
  });

  it("shows the book importance as the role and the book status as a trait", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByText("Центральний")).toBeInTheDocument();
    expect(within(previewRegion()).getByText("Живий")).toBeInTheDocument();
  });

  it("adds the POV trait once the character becomes a point of view", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(within(previewRegion()).queryByText("POV")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "POV-персонаж" }));

    expect(within(previewRegion()).getByText("POV")).toBeInTheDocument();
  });

  it("shows no book role or trait without a book context", async () => {
    renderEdit("");

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(within(previewRegion()).queryByText("Центральний")).not.toBeInTheDocument();
    expect(within(previewRegion()).queryByText("Живий")).not.toBeInTheDocument();
  });

  it("shows an uploaded portrait in the preview before saving", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();

    await uploadPortrait();

    expect(within(previewRegion()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(patchCount()).toBe(0);
  });

  it("returns the preview to the initial fallback when the portrait is reset", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait();
    await userEvent.click(
      screen.getByRole("button", { name: "Використовувати основне зображення" }),
    );

    expect(within(previewRegion()).queryByRole("img")).not.toBeInTheDocument();
    expect(within(previewRegion()).getByText("Ґ")).toBeInTheDocument();
  });
});

describe("CharacterEditPage book portrait field", () => {
  const globalAvatar: MediaView = {
    ...uploadedPortrait,
    id: "media-avatar-1",
    name: "avatar.png",
    urls: {
      card: "https://media.dev.book-nest.net/avatar-card.webp",
      full: "https://media.dev.book-nest.net/avatar-full.webp",
      thumb: "https://media.dev.book-nest.net/avatar-thumb.webp",
    },
  };

  beforeEach(() => {
    vi.stubGlobal("Image", LoadedImage);
    serveMediaUpload(() => Promise.resolve(jsonResponse(uploadedPortrait, 201)));
  });

  function dropzone(): HTMLElement {
    return within(portraitPanel()).getByRole("button", { name: /Перетягніть зображення сюди/ });
  }

  function holdPortraitUpload(response = jsonResponse(uploadedPortrait, 201)): () => void {
    let respond: (response: Response) => void = () => undefined;
    serveMediaUpload(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    return () => respond(response);
  }

  it("offers a dropzone instead of an avatar when the character has no image at all", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(dropzone()).getByText("Перетягніть зображення сюди")).toBeInTheDocument();
    expect(within(dropzone()).getByText("Вибрати зображення для цієї книги")).toBeInTheDocument();
    expect(within(portraitPanel()).queryByText("Ґ")).not.toBeInTheDocument();
    expect(
      within(portraitPanel()).queryByRole("button", { name: "Вибрати зображення для цієї книги" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the dropzone illustration out of the accessibility tree", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(portraitPanel()).queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the inherited global avatar and an upload button instead of the dropzone", async () => {
    servedCharacter = { ...character, avatar: globalAvatar };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(await within(portraitPanel()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      globalAvatar.urls.card,
    );
    expect(
      within(portraitPanel()).getByRole("button", { name: "Вибрати зображення для цієї книги" }),
    ).toBeInTheDocument();
    expect(
      within(portraitPanel()).queryByText("Перетягніть зображення сюди"),
    ).not.toBeInTheDocument();
  });

  it("announces the upload and locks the dropzone while the image is uploading", async () => {
    holdPortraitUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await choosePortraitFile();

    await waitFor(() =>
      expect(within(portraitPanel()).getByRole("status")).toHaveTextContent(
        "Завантажуємо зображення…",
      ),
    );
    expect(dropzone()).toBeDisabled();
  });

  it("keeps the status region mounted and empty until the upload starts", async () => {
    holdPortraitUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const status = within(portraitPanel()).getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await choosePortraitFile();

    await waitFor(() => expect(status).toHaveTextContent("Завантажуємо зображення…"));
  });

  it("drops the upload status and shows the image once the upload finishes", async () => {
    const finishUpload = holdPortraitUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await choosePortraitFile();
    await within(portraitPanel()).findByText("Завантажуємо зображення…");
    finishUpload();

    expect(await within(portraitPanel()).findByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      uploadedPortrait.urls.card,
    );
    expect(within(portraitPanel()).queryByText("Завантажуємо зображення…")).not.toBeInTheDocument();
  });

  it("leaves focus on the field the user moved to while the upload was running", async () => {
    const finishUpload = holdPortraitUpload();
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await choosePortraitFile();
    await within(portraitPanel()).findByText("Завантажуємо зображення…");
    const nameField = screen.getByRole("textbox", { name: "Ім’я" });
    await userEvent.click(nameField);
    finishUpload();

    await within(portraitPanel()).findByRole("button", { name: "Замінити зображення" });
    expect(nameField).toHaveFocus();
  });

  it("returns focus to the re-enabled dropzone when the upload fails", async () => {
    const failUpload = holdPortraitUpload(jsonResponse({ message: "boom" }, 500));
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await choosePortraitFile();
    await waitFor(() => expect(dropzone()).toBeDisabled());
    failUpload();

    await waitFor(() => expect(dropzone()).toHaveFocus());
    expect(dropzone()).toBeEnabled();
  });

  it("moves focus to the replace button once the upload finishes", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait();

    expect(
      within(portraitPanel()).getByRole("button", { name: "Замінити зображення" }),
    ).toHaveFocus();
  });

  it("locks the reset button while a replacement upload is in flight", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait();
    holdPortraitUpload();
    await choosePortraitFile("Замінити зображення");

    await waitFor(() =>
      expect(
        within(portraitPanel()).getByRole("button", {
          name: "Використовувати основне зображення",
        }),
      ).toBeDisabled(),
    );
  });

  it("brings back the dropzone with focus when the portrait is reset and no global avatar exists", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait();
    await userEvent.click(
      within(portraitPanel()).getByRole("button", { name: "Використовувати основне зображення" }),
    );

    expect(dropzone()).toHaveFocus();
  });

  it("shows the inherited global avatar again when the portrait is reset", async () => {
    servedCharacter = { ...character, avatar: globalAvatar };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait("Вибрати зображення для цієї книги");
    await userEvent.click(
      within(portraitPanel()).getByRole("button", { name: "Використовувати основне зображення" }),
    );

    expect(within(portraitPanel()).getByRole("img", { name: "Ґеральт" })).toHaveAttribute(
      "src",
      globalAvatar.urls.card,
    );
  });

  it("moves focus to the upload button when the portrait is reset over a global avatar", async () => {
    servedCharacter = { ...character, avatar: globalAvatar };
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await uploadPortrait("Вибрати зображення для цієї книги");
    await userEvent.click(
      within(portraitPanel()).getByRole("button", { name: "Використовувати основне зображення" }),
    );

    expect(
      within(portraitPanel()).getByRole("button", { name: "Вибрати зображення для цієї книги" }),
    ).toHaveFocus();
  });
});

describe("CharacterEditPage preview card", () => {
  it("renders the preview card without a link or any action button", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(within(previewRegion()).getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(within(previewRegion()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(previewRegion()).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CharacterEditPage field requirements", () => {
  it("marks the name as required for assistive technology", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute("aria-required", "true");
  });

  it("refuses an emptied name and links the error to the field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    const name = screen.getByRole("textbox", { name: "Ім’я" });
    expect(name).toHaveAttribute("aria-invalid", "false");

    await userEvent.clear(name);
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть ім'я")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Вкажіть ім'я");
    expect(patchCount()).toBe(0);
  });

  it("marks the optional text fields as optional in their accessible names", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Вид (необов’язково)" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Займенники (необов’язково)" })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toBeInTheDocument();
  });

  it("keeps the optional marker off the required name and the selects", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Важливість" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Гендер" })).toBeInTheDocument();
  });

  it("suggests an example in each text field", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute(
      "placeholder",
      "Наприклад, Ґеральт із Рівії",
    );
    expect(screen.getByRole("textbox", { name: "Вид (необов’язково)" })).toHaveAttribute(
      "placeholder",
      "Наприклад, ельф",
    );
    expect(screen.getByRole("textbox", { name: "Займенники (необов’язково)" })).toHaveAttribute(
      "placeholder",
      "Наприклад, він/його",
    );
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toHaveAttribute("placeholder", "Хто цей персонаж поза межами окремої книги…");
  });

  it("caps each text field at its own length", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getByRole("textbox", { name: "Ім’я" })).toHaveAttribute("maxlength", "200");
    expect(screen.getByRole("textbox", { name: "Вид (необов’язково)" })).toHaveAttribute(
      "maxlength",
      "120",
    );
    expect(screen.getByRole("textbox", { name: "Займенники (необов’язково)" })).toHaveAttribute(
      "maxlength",
      "60",
    );
    expect(
      screen.getByRole("textbox", { name: "Коротко про персонажа (необов’язково)" }),
    ).toHaveAttribute("maxlength", "5000");
  });

  it("describes a long-text field with a live character count", async () => {
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    const description = screen.getByRole("textbox", { name: "Дані в цій книзі (необов’язково)" });
    expect(description).toHaveAccessibleDescription("12/5000");

    await userEvent.type(description, " ще трохи");

    expect(description).toHaveAccessibleDescription("21/5000");
  });

  it("names the roles picker once, with a visible caption that is neither a label nor announced", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");

    expect(screen.getAllByRole("combobox", { name: "Ролі" })).toHaveLength(1);
    expect(screen.getByText("Ролі", { ignore: "label, script, style" })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("CharacterEditPage text over the limit", () => {
  async function saveAfterRenamingTheCharacter() {
    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: "Ім’я" }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));
  }

  it("refuses a saved global description longer than 5000 characters", async () => {
    servedCharacter = { ...character, neutralDescription: "а".repeat(5001) };
    renderEdit();

    await saveAfterRenamingTheCharacter();

    expect(await screen.findByText("Текст задовгий (макс. 5000)")).toBeInTheDocument();
    const description = screen.getByRole("textbox", {
      name: "Коротко про персонажа (необов’язково)",
    });
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAccessibleDescription(/^Текст задовгий \(макс\. 5000\)/);
    expect(patchCount()).toBe(0);
  });

  it("refuses a saved species longer than 120 characters", async () => {
    servedCharacter = { ...character, species: "е".repeat(121) };
    renderEdit();

    await saveAfterRenamingTheCharacter();

    expect(await screen.findByText("Текст задовгий (макс. 120)")).toBeInTheDocument();
    const species = screen.getByRole("textbox", { name: "Вид (необов’язково)" });
    expect(species).toHaveAttribute("aria-invalid", "true");
    expect(species).toHaveAccessibleDescription("Текст задовгий (макс. 120)");
    expect(patchCount()).toBe(0);
  });

  it("shows the error inside an overridden book field that is too long", async () => {
    servedCharacter = {
      ...character,
      appearances: character.appearances.map((appearance) => ({
        ...appearance,
        speciesOverride: "м".repeat(201),
      })),
    };
    renderEdit();

    await saveAfterRenamingTheCharacter();

    const speciesInBook = inheritedField("Вид у цій книзі");
    expect(
      await within(speciesInBook).findByText("Текст задовгий (макс. 200)"),
    ).toBeInTheDocument();
    const input = within(speciesInBook).getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Текст задовгий (макс. 200)");
    expect(patchCount()).toBe(0);
  });
});

describe("CharacterEditPage custom gender", () => {
  it("requires the custom gender once it is chosen and sends nothing without it", async () => {
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.click(screen.getByRole("combobox", { name: "Гендер" }));
    await userEvent.click(await screen.findByRole("option", { name: "Свій варіант" }));
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    expect(await screen.findByText("Вкажіть свій гендер")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Свій варіант" })).toHaveAccessibleDescription(
      "Вкажіть свій гендер",
    );
    expect(patchCount()).toBe(0);
  });
});

describe("CharacterEditPage spoiler collections round trip", () => {
  const roles: BookCharacterView["roles"] = [
    { customRole: null, id: "role-plain", isSpoiler: false, position: 0, roleType: "protagonist" },
    {
      customRole: null,
      id: "role-spoiler",
      isSpoiler: true,
      position: 1,
      roleType: "love_interest",
    },
  ];

  const aliases: CharacterDetailsView["aliases"] = [
    {
      bookId: null,
      id: "alias-global",
      isSpoiler: true,
      name: "Білий Вовк",
      position: 0,
      type: "title",
    },
    {
      bookId: "book-1",
      id: "alias-book",
      isSpoiler: true,
      name: "Різник із Блавікену",
      position: 0,
      type: "title",
    },
  ];

  function serveWithHiddenFields({
    appearanceHiddenFields,
    characterHiddenFields,
  }: {
    appearanceHiddenFields: string[];
    characterHiddenFields: string[];
  }) {
    const isRolesMasked = appearanceHiddenFields.includes("roles");
    const isAliasesMasked = characterHiddenFields.includes("aliases");

    servedCharacter = makeCharacterDetails({
      aliases: isAliasesMasked ? [] : aliases,
      appearances: [
        makeBookCharacterView({
          bookId: "book-1",
          description: "Опис у книзі",
          hiddenFields: appearanceHiddenFields,
          importance: "central",
          roles: isRolesMasked ? [] : roles,
          speciesOverride: "Мутант",
          status: "active",
        }),
      ],
      gender: "male",
      hiddenFields: characterHiddenFields,
      name: "Ґеральт",
      species: "Відьмак",
    });
  }

  it("sends the revealed spoiler role back untouched when another book field changes", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: [] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("roles", [
      { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
      { customRole: null, isSpoiler: true, position: 1, roleType: "love_interest" },
    ]);
  });

  it("sends the revealed spoiler alias of the book back untouched when another book field changes", async () => {
    serveWithHiddenFields({ appearanceHiddenFields: [], characterHiddenFields: [] });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    expect(bookPatchBody()).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("sends no roles and no aliases for the book while the server masks them", async () => {
    serveWithHiddenFields({
      appearanceHiddenFields: ["roles"],
      characterHiddenFields: ["aliases"],
    });
    renderEdit();

    await screen.findByDisplayValue("Опис у книзі");
    await userEvent.type(screen.getByRole("textbox", { name: /^Дані в цій книзі/ }), " ще трохи");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(bookPatchBody()).toBeDefined());
    const body = bookPatchBody();
    expect(body).not.toHaveProperty("roles");
    expect(body).not.toHaveProperty("aliases");
    expect(body).toHaveProperty("description", "Опис у книзі ще трохи");
  });

  it("sends no aliases for the character while the server masks them", async () => {
    serveWithHiddenFields({
      appearanceHiddenFields: ["roles"],
      characterHiddenFields: ["aliases"],
    });
    renderEdit();

    await screen.findByDisplayValue("Ґеральт");
    await userEvent.type(screen.getByRole("textbox", { name: /Ім’я/ }), " із Рівії");
    await userEvent.click(screen.getByRole("button", { name: /Зберегти/ }));

    await waitFor(() => expect(globalPatchBody()).toBeDefined());
    const body = globalPatchBody();
    expect(body).not.toHaveProperty("aliases");
    expect(body).toHaveProperty("name", "Ґеральт із Рівії");
  });
});
