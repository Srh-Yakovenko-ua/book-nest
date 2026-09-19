import "@testing-library/jest-dom/vitest";

import type { NoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { NoteCardLayout } from "./note-card-layout";

import { makeBookNote, makeSeriesNote, NOTE_FIXTURE } from "../model/notes.fixtures";
import { NoteArchiveCard } from "./note-archive-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let restoreMetrics: () => void = () => undefined;

function clampEverything() {
  restoreMetrics = stubTextMetrics({ clientHeight: 100, scrollHeight: 500 });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function noteCall(method: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/notes/note-1") &&
      String(init?.method ?? "GET").toUpperCase() === method,
  ) as [string, RequestInit] | undefined;
}

function patchBody(): unknown {
  const call = noteCall("PATCH");
  if (call === undefined) throw new Error("no PATCH call was made");
  return JSON.parse(String(call[1].body));
}

function renderCard(note: NoteView, layout: NoteCardLayout = "list") {
  return renderWithProviders(<NoteArchiveCard layout={layout} note={note} />);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/notes/note-1") && method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as Partial<NoteView>;
      return Promise.resolve(jsonResponse(makeBookNote(body)));
    }
    if (url.includes("/api/notes/note-1") && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NoteArchiveCard book header", () => {
  it("links the book title to the book page", () => {
    renderCard(makeBookNote());

    expect(screen.getByRole("link", { name: "Дюна" })).toHaveAttribute("href", "/books/book-1");
  });

  it("shows the book author under the title", () => {
    renderCard(makeBookNote());

    expect(screen.getByText("Френк Герберт")).toBeInTheDocument();
  });

  it("falls back to the unknown-author label when the book has no author", () => {
    renderCard(makeBookNote({ book: { author: null, cover: null, id: "book-1", title: "Дюна" } }));

    expect(screen.getByText("Автор невідомий")).toBeInTheDocument();
  });
});

describe("NoteArchiveCard series header", () => {
  it("links the series name to the series page", () => {
    renderCard(makeSeriesNote());

    expect(screen.getByRole("link", { name: "Хроніки Дюни" })).toHaveAttribute(
      "href",
      "/series/series-1",
    );
  });

  it("shows the series authors and its book count", () => {
    renderCard(makeSeriesNote());

    expect(screen.getByText("Френк Герберт")).toBeInTheDocument();
    expect(screen.getByText("6 книг")).toBeInTheDocument();
  });
});

describe("NoteArchiveCard embedded layout", () => {
  it("drops the entity header on a Details page", () => {
    renderCard(makeBookNote(), "embedded");

    expect(screen.queryByRole("link", { name: "Дюна" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("keeps the favorite, pin and actions controls on a Details page", () => {
    renderCard(makeBookNote(), "embedded");

    expect(
      within(screen.getByRole("article"))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Закріплена нотатка", "Улюблена нотатка", "Дії з нотаткою"]);
  });
});

describe("NoteArchiveCard category", () => {
  it("shows the translated category", () => {
    renderCard(makeBookNote({ category: "plot" }));

    expect(screen.getByText("Сюжет")).toBeInTheDocument();
  });

  it("shows the custom category name for a note filed under other", () => {
    renderCard(makeBookNote({ category: "other", customCategory: "  Пророцтва  " }));

    expect(screen.getByText("Пророцтва")).toBeInTheDocument();
    expect(screen.queryByText("Інше")).not.toBeInTheDocument();
  });

  it("renders no category chip for an uncategorised note", () => {
    renderCard(makeBookNote({ category: null }));

    expect(screen.queryByText("Персонажі")).not.toBeInTheDocument();
  });
});

describe("NoteArchiveCard book location", () => {
  it("shows the chapter and the page on the card", () => {
    renderCard(makeBookNote({ chapter: "Розділ III", page: 87 }));

    expect(screen.getByText("Розділ III")).toBeInTheDocument();
    expect(screen.getByText("стор. 87")).toBeInTheDocument();
  });

  it("shows only the page when the note has no chapter", () => {
    renderCard(makeBookNote({ chapter: "   ", page: 87 }));

    expect(screen.getByText("стор. 87")).toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("uses the short page label on the card, not the Full View one", () => {
    renderCard(makeBookNote({ chapter: "Розділ III", page: 87 }));

    expect(screen.queryByText("Сторінка")).not.toBeInTheDocument();
    expect(screen.queryByText("Розділ")).not.toBeInTheDocument();
  });
});

describe("NoteArchiveCard series location", () => {
  it("never shows chapter or page on a series card, even with legacy values", () => {
    renderCard(makeSeriesNote({ chapter: "Том 2", page: 12 }));

    expect(screen.queryByText("Том 2")).not.toBeInTheDocument();
    expect(screen.queryByText(/стор\./)).not.toBeInTheDocument();
    expect(screen.queryByText("Збережене місце")).not.toBeInTheDocument();
  });
});

describe("NoteArchiveCard spoilers", () => {
  it("keeps the spoiler text out of the DOM behind the gate", () => {
    renderCard(makeBookNote({ isSpoiler: true }));

    expect(screen.queryByText(NOTE_FIXTURE.text)).not.toBeInTheDocument();
    expect(screen.getByText("Ця нотатка містить спойлер")).toBeInTheDocument();
  });

  it("warns about book events on a book note", () => {
    renderCard(makeBookNote({ isSpoiler: true }));

    expect(screen.getByText("Вона може розкрити важливі події книги.")).toBeInTheDocument();
  });

  it("warns about series events on a series note", () => {
    renderCard(makeSeriesNote({ isSpoiler: true }));

    expect(screen.getByText("Вона може розкрити важливі події серії.")).toBeInTheDocument();
  });

  it("does not reveal the text inline when the gate is opened", async () => {
    renderCard(makeBookNote({ isSpoiler: true }));

    await userEvent.click(screen.getByRole("button", { name: "Показати нотатку" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(NOTE_FIXTURE.text)).toBeInTheDocument();
    expect(
      within(screen.getByRole("article", { hidden: true })).queryByText(NOTE_FIXTURE.text),
    ).not.toBeInTheDocument();
  });
});

describe("NoteArchiveCard preview", () => {
  it("shows the whole text without a trigger while it fits the clamp", () => {
    renderCard(makeBookNote());

    expect(screen.getByText(NOTE_FIXTURE.text)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати повністю" })).not.toBeInTheDocument();
  });

  it("offers the Full View once the text outgrows the clamp", () => {
    clampEverything();

    renderCard(makeBookNote());

    expect(screen.getByRole("button", { name: "Показати повністю" })).toBeInTheDocument();
  });

  it("opens the Full View instead of expanding the card", async () => {
    clampEverything();
    renderCard(makeBookNote());

    await userEvent.click(screen.getByRole("button", { name: "Показати повністю" }));

    expect(await screen.findByRole("dialog", { name: "Дюна" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("article", { hidden: true })).getByRole("button", {
        hidden: true,
        name: "Показати повністю",
      }),
    ).toBeInTheDocument();
  });
});

describe("NoteArchiveCard Full View focus", () => {
  it("returns focus to the spoiler gate button on close", async () => {
    renderCard(makeBookNote({ isSpoiler: true }));
    const trigger = screen.getByRole("button", { name: "Показати нотатку" });

    await userEvent.click(trigger);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("returns focus to the show-full button on close", async () => {
    clampEverything();
    renderCard(makeBookNote());
    const trigger = screen.getByRole("button", { name: "Показати повністю" });

    await userEvent.click(trigger);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("moves focus to the note text when the Full View opens", async () => {
    renderCard(makeBookNote({ isSpoiler: true }));

    await userEvent.click(screen.getByRole("button", { name: "Показати нотатку" }));

    const body = await screen.findByRole("region", { name: "Текст нотатки" });
    await waitFor(() => expect(body).toHaveFocus());
  });
});

describe("NoteArchiveCard favorite", () => {
  it("marks the heart as not pressed for an ordinary note", () => {
    renderCard(makeBookNote({ isFavorite: false }));

    expect(screen.getByRole("button", { name: "Улюблена нотатка" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the heart as pressed for a favorite note", () => {
    renderCard(makeBookNote({ isFavorite: true }));

    expect(screen.getByRole("button", { name: "Улюблена нотатка" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks the API to mark the note favorite", async () => {
    renderCard(makeBookNote({ isFavorite: false }));

    await userEvent.click(screen.getByRole("button", { name: "Улюблена нотатка" }));

    await waitFor(() => expect(noteCall("PATCH")).toBeDefined());
    expect(patchBody()).toEqual({ isFavorite: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Нотатку додано в улюблені."));
  });

  it("asks the API to drop a favorite note from favorites", async () => {
    renderCard(makeBookNote({ isFavorite: true }));

    await userEvent.click(screen.getByRole("button", { name: "Улюблена нотатка" }));

    await waitFor(() => expect(noteCall("PATCH")).toBeDefined());
    expect(patchBody()).toEqual({ isFavorite: false });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Нотатку прибрано з улюблених."),
    );
  });

  it("reports a failed favorite update", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    renderCard(makeBookNote());

    await userEvent.click(screen.getByRole("button", { name: "Улюблена нотатка" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Не вдалося оновити нотатку. Спробуйте ще раз."),
    );
  });
});

describe("NoteArchiveCard pin", () => {
  it("marks the pin as not pressed for an unpinned note", () => {
    renderCard(makeBookNote({ isPinned: false }));

    expect(screen.getByRole("button", { name: "Закріплена нотатка" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the pin as pressed for a pinned note", () => {
    renderCard(makeBookNote({ isPinned: true }));

    expect(screen.getByRole("button", { name: "Закріплена нотатка" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks the API to pin the note", async () => {
    renderCard(makeBookNote({ isPinned: false }));

    await userEvent.click(screen.getByRole("button", { name: "Закріплена нотатка" }));

    await waitFor(() => expect(noteCall("PATCH")).toBeDefined());
    expect(patchBody()).toEqual({ isPinned: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Нотатку закріплено."));
  });

  it("asks the API to unpin a pinned note", async () => {
    renderCard(makeBookNote({ isPinned: true }));

    await userEvent.click(screen.getByRole("button", { name: "Закріплена нотатка" }));

    await waitFor(() => expect(noteCall("PATCH")).toBeDefined());
    expect(patchBody()).toEqual({ isPinned: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Нотатку відкріплено."));
  });
});

describe("NoteArchiveCard actions menu", () => {
  it("offers exactly editing and deletion", async () => {
    renderCard(makeBookNote());

    await userEvent.click(screen.getByRole("button", { name: "Дії з нотаткою" }));

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Видалити",
    ]);
  });

  it("asks for confirmation before deleting", async () => {
    renderCard(makeBookNote());

    await userEvent.click(screen.getByRole("button", { name: "Дії з нотаткою" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));

    expect(await screen.findByRole("alertdialog")).toHaveAccessibleName("Видалити нотатку?");
    expect(noteCall("DELETE")).toBeUndefined();
  });

  it("deletes the note once the confirmation is accepted", async () => {
    renderCard(makeBookNote());

    await userEvent.click(screen.getByRole("button", { name: "Дії з нотаткою" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(noteCall("DELETE")).toBeDefined());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Нотатку видалено."));
  });
});

describe("NoteArchiveCard pending toggles", () => {
  function holdPatch() {
    let release: () => void = () => undefined;
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              jsonResponse(makeBookNote(JSON.parse(String(init?.body)) as Partial<NoteView>)),
            );
        }),
    );
    return () => release();
  }

  it("keeps keyboard focus on the favorite toggle while the update is saving", async () => {
    const release = holdPatch();
    renderCard(makeBookNote({ isFavorite: false }));
    const favorite = screen.getByRole("button", { name: "Улюблена нотатка" });
    favorite.focus();

    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(favorite).toHaveAttribute("aria-disabled", "true"));
    expect(favorite).toHaveFocus();
    release();
    await waitFor(() => expect(favorite).toHaveAttribute("aria-disabled", "false"));
  });

  it("sends a single PATCH when the pin is pressed twice while saving", async () => {
    const release = holdPatch();
    renderCard(makeBookNote({ isPinned: false }));
    const pin = screen.getByRole("button", { name: "Закріплена нотатка" });
    pin.focus();

    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(pin).toHaveFocus();
    release();
    await waitFor(() => expect(pin).toHaveAttribute("aria-disabled", "false"));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  });
});
