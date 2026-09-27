import "@testing-library/jest-dom/vitest";

import type {
  BookNotesFacetsView,
  BookNotesOverviewView,
  BookNotesSummaryView,
  NoteMemoryView,
  NoteView,
  Nullable,
  PostFinishNotesView,
  SeriesBeforeNextBookView,
  SeriesNotesFacetsView,
  SeriesNotesOverviewView,
  SeriesNotesSummaryView,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { NotesArchiveScope } from "../model/notes-archive-config";

import { makeBookNote, makeSeriesNote } from "../model/notes.fixtures";
import { NotesArchiveView } from "./notes-archive-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type ArchiveReplies = {
  impression?: Reply;
  overview?: Reply;
  review?: Reply;
  summary?: Reply;
};

type RecordedRequest = { body: unknown; method: string; url: string };

type Reply = () => Promise<Response>;

type VisibilityRecord = {
  active: boolean;
  callback: IntersectionObserverCallback;
  elements: Element[];
  options: IntersectionObserverInit | undefined;
};

const IDS = {
  finishedBook: "3f2a9c4e-8b1d-4e7a-9c3b-2d5e6f7a8b9c",
  otherAuthor: "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e",
  readingCycle: "8f1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  seriesA: "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a",
  seriesB: "9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b",
} as const;

const ARCHIVE_NOTE_TEXT = {
  books: "Нотатка з архіву книг.",
  series: "Нотатка з архіву серій.",
} as const;

const PATHS = {
  impression: "/api/notes/rediscovery/impression",
  review: "/api/notes/books/post-finish/review",
} as const;

const BOOK_SUMMARY: BookNotesSummaryView = {
  bookNotesCount: 12,
  booksWithFiveOrMoreNotesCount: 1,
  booksWithNotesCount: 4,
  createdLast30DaysCount: 3,
  topAuthor: { leadersCount: 1, name: "Френк Герберт", notesCount: 8 },
  topBook: { leadersCount: 1, notesCount: 6, title: "Дюна" },
};

const SERIES_SUMMARY: SeriesNotesSummaryView = {
  createdLast30DaysCount: 0,
  seriesNotesCount: 5,
  seriesWithNotesCount: 2,
  seriesWithThreeOrMoreNotesCount: 1,
  topAuthor: { leadersCount: 1, name: "Френк Герберт", notesCount: 3 },
  topSeries: { leadersCount: 1, name: "Хроніки Дюни", notesCount: 3 },
};

const QUICK_COUNTS = { all: 1, favorite: 0, no_spoiler: 1, pinned: 0, with_spoiler: 0 };

const BOOK_FACETS: BookNotesFacetsView = {
  authors: [],
  books: [],
  categories: [],
  customCategories: [],
  quickCounts: QUICK_COUNTS,
};

const SERIES_FACETS: SeriesNotesFacetsView = {
  authors: [],
  categories: [],
  customCategories: [],
  genres: [],
  quickCounts: QUICK_COUNTS,
  series: [],
};

const BOOK_MEMORY: NoteMemoryView = {
  impressionKey: "memory:note-7:2026-09-18",
  note: makeBookNote({ id: "note-7", text: "Спогад про Арракіс." }),
  source: {
    authors: [{ id: "author-1", name: "Френк Герберт" }],
    cover: null,
    id: "book-1",
    seriesPosition: null,
    title: "Дюна",
    type: "book",
  },
};

const POST_FINISH: PostFinishNotesView = {
  book: { author: "Лорен Робертс", cover: null, id: IDS.finishedBook, title: "Безрозсудна" },
  favoritesCount: 2,
  finishedAt: "2026-09-10",
  notesCount: 5,
  pinnedCount: 1,
  readingCycleId: IDS.readingCycle,
};

const BEFORE_NEXT_BOOK: SeriesBeforeNextBookView = {
  continuation: {
    authors: [{ id: "author-1", name: "Френк Герберт" }],
    cover: null,
    id: "book-3",
    ownershipStatus: "none",
    progress: null,
    readingStatus: "reading",
    reason: "reading",
    seriesPosition: 3,
    title: "Діти Дюни",
  },
  notes: [
    {
      ...makeBookNote({ id: "note-recap", text: "Що сталося на Арракісі." }),
      sourceBook: { id: "book-1", seriesPosition: 1, title: "Дюна" },
    },
  ],
  previewLimit: 5,
  series: { id: IDS.seriesA, knownBooksCount: 6, title: "Хроніки Дюни", totalBooks: 6 },
  totalCount: 1,
};

const SERIES_MEMORY: NoteMemoryView = {
  impressionKey: "memory:note-8:2026-09-18",
  note: makeSeriesNote({ id: "note-8", text: "Спогад про Хроніки." }),
  source: { id: IDS.seriesA, title: "Хроніки Дюни", type: "series" },
};

const EMPTY_BOOK_OVERVIEW: BookNotesOverviewView = { memoryNote: null, postFinish: null };

const requests: RecordedRequest[] = [];
const visibilityObservers: VisibilityRecord[] = [];

class VisibilityObserverStub {
  private readonly record: VisibilityRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { active: true, callback, elements: [], options };
    visibilityObservers.push(this.record);
  }

  disconnect() {
    this.record.active = false;
  }

  observe(element: Element) {
    this.record.elements.push(element);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", VisibilityObserverStub);
  stubViewport("wide");
});

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
  visibilityObservers.length = 0;
});

describe("NotesArchiveView books overview", () => {
  it("shows the rediscovered note above the post-finish recap", async () => {
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: POST_FINISH }) });

    renderArchive("books");

    expect(
      await (await findSidebar()).findByRole("region", { name: "Після завершення" }),
    ).toBeVisible();
    expect(sidebarRegionNames()).toEqual(["Згадати нотатку", "Після завершення"]);
  });

  it("shows the post-finish recap alone when no note is due for rediscovery", async () => {
    mockArchive("books", { overview: json({ memoryNote: null, postFinish: POST_FINISH }) });

    renderArchive("books");

    expect(
      await (await findSidebar()).findByRole("region", { name: "Після завершення" }),
    ).toBeVisible();
    expect(sidebarRegionNames()).toEqual(["Після завершення"]);
  });

  it("leaves no overview sidebar behind when both blocks are empty", async () => {
    mockArchive("books", { overview: json(EMPTY_BOOK_OVERVIEW) });

    renderArchive("books");

    expect(await screen.findByText(ARCHIVE_NOTE_TEXT.books)).toBeInTheDocument();
    await waitFor(() => expect(overviewRequests("books")).toHaveLength(1));
    expect(screen.queryByRole("complementary", { name: "Огляд нотаток" })).not.toBeInTheDocument();
  });

  it("asks for the overview once while the sidebar and the mobile trigger both read it", async () => {
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: POST_FINISH }) });

    renderArchive("books");

    expect(
      await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Огляд нотаток" })).toBeInTheDocument();
    expect(overviewRequests("books")).toHaveLength(1);
  });

  it("asks for the overview once when the phone drawer shows the same blocks", async () => {
    stubViewport("narrow");
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: POST_FINISH }) });

    renderArchive("books");

    await userEvent.click(await screen.findByRole("button", { name: "Огляд нотаток" }));
    const drawer = await screen.findByRole("dialog", { name: "Огляд нотаток" });

    expect(await within(drawer).findByRole("region", { name: "Згадати нотатку" })).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Огляд нотаток" })).not.toBeInTheDocument();
    expect(overviewRequests("books")).toHaveLength(1);
  });
});

describe("NotesArchiveView layout", () => {
  it("reads the search, then the notes, then the contextual column", async () => {
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: POST_FINISH }) });

    renderArchive("books");

    const aside = await screen.findByRole("complementary", { name: "Огляд нотаток" });
    const search = await screen.findByLabelText("Пошук у нотатках книг");
    const results = screen.getByRole("heading", { level: 2, name: "Список нотаток" });
    expect(search.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives the phone overview trigger its dialog state and returns focus to it on close", async () => {
    stubViewport("narrow");
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: POST_FINISH }) });

    renderArchive("books");

    const trigger = await screen.findByRole("button", { name: "Огляд нотаток" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Огляд нотаток" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("NotesArchiveView series overview", () => {
  it("shows the before-continuation recap above the rediscovered note", async () => {
    mockArchive("series", {
      overview: json({ beforeNextBook: BEFORE_NEXT_BOOK, memoryNote: SERIES_MEMORY }),
    });

    renderArchive("series");

    expect(
      await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" }),
    ).toBeVisible();
    expect(sidebarRegionNames()).toEqual(["Перед продовженням серії", "Згадати нотатку"]);
  });

  it("hands the series of the link to the overview in the order the link lists them", async () => {
    mockArchive("series", { overview: json(seriesOverview()) });

    renderArchive("series", `?series=${IDS.seriesB},${IDS.seriesA}`);

    await waitFor(() => expect(overviewRequests("series")).toHaveLength(1));
    expect(searchParamsOf(overviewRequests("series")[0]).getAll("series")).toEqual([
      IDS.seriesB,
      IDS.seriesA,
    ]);
  });

  it("names a rediscovered series note as a note about the series", async () => {
    mockArchive("series", { overview: json(seriesOverview({ memoryNote: SERIES_MEMORY })) });

    renderArchive("series");

    const memory = await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" });
    expect(within(memory).getByText("Нотатка про серію")).toBeInTheDocument();
  });

  it("names a rediscovered book note by its place in the series", async () => {
    mockArchive("series", {
      overview: json(
        seriesOverview({
          memoryNote: {
            impressionKey: "memory:note-9:2026-09-18",
            note: makeBookNote({ id: "note-9", text: "Спогад про Месію." }),
            source: {
              authors: [{ id: "author-1", name: "Френк Герберт" }],
              cover: null,
              id: "book-2",
              seriesPosition: 2,
              title: "Месія Дюни",
              type: "book",
            },
          },
        }),
      ),
    });

    renderArchive("series");

    const memory = await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" });
    expect(within(memory).getByText("Книга 2 · Месія Дюни")).toBeInTheDocument();
    expect(within(memory).getByRole("button", { name: "Відкрити нотатку" })).toBeInTheDocument();
  });
});

describe("NotesArchiveView overview failure", () => {
  it("keeps the books archive and its toolbar on screen when the overview fails", async () => {
    mockArchive("books", { overview: failure(500) });

    renderArchive("books");

    expect(await screen.findByText(ARCHIVE_NOTE_TEXT.books)).toBeInTheDocument();
    await waitFor(() => expect(overviewRequests("books")).toHaveLength(1));
    expect(await screen.findByRole("radiogroup", { name: "Швидкі фільтри" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Огляд нотаток" })).not.toBeInTheDocument();
  });

  it("still opens the create dialog when the overview fails", async () => {
    mockArchive("books", { overview: failure(500) });

    renderArchive("books");

    await waitFor(() => expect(overviewRequests("books")).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    expect(await screen.findByRole("dialog", { name: "Додати нотатку" })).toBeInTheDocument();
  });

  it("keeps the series archive on screen when the overview fails", async () => {
    mockArchive("series", { overview: failure(500) });

    renderArchive("series");

    expect(await screen.findByText(ARCHIVE_NOTE_TEXT.series)).toBeInTheDocument();
    await waitFor(() => expect(overviewRequests("series")).toHaveLength(1));
    expect(screen.queryByRole("complementary", { name: "Огляд нотаток" })).not.toBeInTheDocument();
  });
});

describe("NotesArchiveView rediscovery impressions", () => {
  it("records the impression once the rediscovered note is half on screen", async () => {
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: null }) });

    renderArchive("books");
    const memory = await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" });
    await reportVisibility(true, memory);

    await waitFor(() =>
      expect(impressionBodies()).toEqual([{ impressionKey: BOOK_MEMORY.impressionKey }]),
    );
    expect(visibilityObservers.map(({ options }) => options?.threshold)).toContain(0.5);
  });

  it("records nothing while the rediscovered note stays off screen", async () => {
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: null }) });

    renderArchive("books");
    await reportVisibility(
      false,
      await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" }),
    );

    expect(impressionBodies()).toEqual([]);
  });

  it("records the impression once when the note shows on desktop and then in the phone drawer", async () => {
    const viewport = stubViewport("wide");
    mockArchive("books", { overview: json({ memoryNote: BOOK_MEMORY, postFinish: null }) });

    renderArchive("books");
    await reportVisibility(
      true,
      await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" }),
    );
    await waitFor(() => expect(impressionBodies()).toHaveLength(1));

    await viewport.narrow();
    await userEvent.click(screen.getByRole("button", { name: "Огляд нотаток" }));
    const drawer = await screen.findByRole("dialog", { name: "Огляд нотаток" });
    await reportVisibility(
      true,
      await within(drawer).findByRole("region", { name: "Згадати нотатку" }),
    );

    expect(impressionBodies()).toEqual([{ impressionKey: BOOK_MEMORY.impressionKey }]);
  });
});

describe("NotesArchiveView post-finish recap", () => {
  const NOISY_URL = `?sort=oldest&view=list&filter=favorite&q=${encodeURIComponent("пустеля")}&author=${IDS.otherAuthor}`;

  it("marks the recap of the finished reading cycle as reviewed", async () => {
    const { onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: noContent,
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();

    await waitFor(() => expect(reviewBodies()).toEqual([{ readingCycleId: IDS.readingCycle }]));
  });

  it("waits for the review to answer before narrowing the archive to the finished book", async () => {
    const { events, onUrlUpdate } = trackUrl();
    let answerReview: (response: Response) => void = () => undefined;
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: () =>
        new Promise<Response>((resolve) => {
          answerReview = resolve;
        }),
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();
    await waitFor(() => expect(reviewBodies()).toHaveLength(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    expect(openedBook(events)).toBeNull();
    await act(async () => answerReview(new Response(null, { status: 204 })));
    await waitFor(() => expect(openedBook(events)).toBe(IDS.finishedBook));
  });

  it("keeps only the book, the sort and the view in the link it opens", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: noContent,
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();

    await waitFor(() => expect(openedBook(events)).toBe(IDS.finishedBook));
    expect(Object.fromEntries(events.at(-1)?.searchParams ?? [])).toEqual({
      book: IDS.finishedBook,
      sort: "oldest",
      view: "list",
    });
  });

  it("still opens the book notes when the review request fails", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: failure(500),
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();

    await waitFor(() => expect(openedBook(events)).toBe(IDS.finishedBook));
    expect(reviewBodies()).toHaveLength(1);
  });

  it("still opens the book notes when the review request never answers", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: () => new Promise<Response>(() => undefined),
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();

    expect(reviewBodies()).toHaveLength(1);
    await waitFor(() => expect(openedBook(events)).toBe(IDS.finishedBook), { timeout: 4000 });
  });

  it("pushes a history entry so Back restores the previous filters", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: noContent,
    });

    renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();

    await waitFor(() => expect(openedBook(events)).toBe(IDS.finishedBook));
    expect(events.at(-1)?.options.history).toBe("push");
  });

  it("drops the pending navigation once the archive leaves the screen", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockArchive("books", {
      overview: json({ memoryNote: null, postFinish: POST_FINISH }),
      review: () => new Promise<Response>(() => undefined),
    });

    const { unmount } = renderArchive("books", NOISY_URL, onUrlUpdate);
    await clickPostFinishCta();
    await waitFor(() => expect(reviewBodies()).toHaveLength(1));
    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)));

    expect(openedBook(events)).toBeNull();
  });
});

describe("NotesArchiveView contextual column", () => {
  it("holds the column with a placeholder while the overview loads on a wide screen", async () => {
    mockArchive("books", { overview: () => new Promise<Response>(() => undefined) });

    renderArchive("books");

    expect(await screen.findByText(ARCHIVE_NOTE_TEXT.books)).toBeInTheDocument();
    expect(contextualPlaceholder()).not.toBeNull();
    expect(screen.queryByRole("complementary", { name: "Огляд нотаток" })).not.toBeInTheDocument();
  });

  it("drops the placeholder once the overview has no blocks", async () => {
    mockArchive("books", { overview: json(EMPTY_BOOK_OVERVIEW) });

    renderArchive("books");

    await waitFor(() => expect(overviewRequests("books")).toHaveLength(1));
    await waitFor(() => expect(contextualPlaceholder()).toBeNull());
  });
});

describe("NotesArchiveView rediscovery retry", () => {
  it("records the impression again after a failed attempt", async () => {
    const viewport = stubViewport("wide");
    mockArchive("books", {
      impression: failure(500),
      overview: json({ memoryNote: BOOK_MEMORY, postFinish: null }),
    });

    renderArchive("books");
    await reportVisibility(
      true,
      await (await findSidebar()).findByRole("region", { name: "Згадати нотатку" }),
    );
    await waitFor(() => expect(impressionBodies()).toHaveLength(1));

    await viewport.narrow();
    await userEvent.click(screen.getByRole("button", { name: "Огляд нотаток" }));
    const drawer = await screen.findByRole("dialog", { name: "Огляд нотаток" });
    await reportVisibility(
      true,
      await within(drawer).findByRole("region", { name: "Згадати нотатку" }),
    );

    await waitFor(() => expect(impressionBodies()).toHaveLength(2));
  });
});

describe("NotesArchiveView summary cards", () => {
  it("names the single leading author and book", async () => {
    mockArchive("books", { summary: json(BOOK_SUMMARY) });

    renderArchive("books");

    expect(await summaryMicrofact("Найбільше в одного автора")).toContain("Френк Герберт");
    expect(summaryCardText("Найбільше в одній книзі")).toContain("Дюна");
  });

  it("counts the tied authors instead of naming one", async () => {
    mockArchive("books", {
      summary: json({ ...BOOK_SUMMARY, topAuthor: { leadersCount: 3, name: null, notesCount: 4 } }),
    });

    renderArchive("books");

    expect(await summaryMicrofact("Найбільше в одного автора")).toContain(
      "3 автори мають максимум",
    );
  });

  it("counts the tied books instead of naming one", async () => {
    mockArchive("books", {
      summary: json({ ...BOOK_SUMMARY, topBook: { leadersCount: 2, notesCount: 5, title: null } }),
    });

    renderArchive("books");

    expect(await summaryMicrofact("Найбільше в одній книзі")).toContain("2 книги мають максимум");
  });

  it("says every book holds one note when every book with notes ties at one", async () => {
    mockArchive("books", {
      summary: json({
        ...BOOK_SUMMARY,
        booksWithNotesCount: 7,
        topBook: { leadersCount: 7, notesCount: 1, title: null },
      }),
    });

    renderArchive("books");

    expect(await summaryMicrofact("Найбільше в одній книзі")).toContain(
      "Усі книги з нотатками — по 1 нотатці",
    );
  });

  it("counts the leaders when the single-note tie leaves some books out", async () => {
    mockArchive("books", {
      summary: json({
        ...BOOK_SUMMARY,
        booksWithNotesCount: 9,
        topBook: { leadersCount: 7, notesCount: 1, title: null },
      }),
    });

    renderArchive("books");

    expect(await summaryMicrofact("Найбільше в одній книзі")).toContain("7 книг мають максимум");
  });

  it("counts the tied series on the series page", async () => {
    mockArchive("series", {
      summary: json({
        ...SERIES_SUMMARY,
        topSeries: { leadersCount: 2, name: null, notesCount: 3 },
      }),
    });

    renderArchive("series");

    expect(await summaryMicrofact("Найбільше в одній серії")).toContain("2 серії мають максимум");
  });

  it("shows no cards but keeps the archive when the summary fails", async () => {
    mockArchive("books", { summary: failure(500) });

    renderArchive("books");

    expect(await screen.findByText(ARCHIVE_NOTE_TEXT.books)).toBeInTheDocument();
    await waitFor(() => expect(requestsTo("/api/notes/books/summary")).toHaveLength(1));
    await waitFor(() => expect(summaryCards()).toHaveLength(0));
  });
});

function archiveBookNote(): NoteView {
  return makeBookNote({ id: "note-list", text: ARCHIVE_NOTE_TEXT.books });
}

function archiveSeriesNote(): NoteView {
  return makeSeriesNote({ id: "note-list", text: ARCHIVE_NOTE_TEXT.series });
}

async function clickPostFinishCta() {
  const recap = await (await findSidebar()).findByRole("region", { name: "Після завершення" });
  await userEvent.click(within(recap).getByRole("button", { name: "Переглянути нотатки" }));
}

function contextualPlaceholder(): Nullable<Element> {
  return document.querySelector('[data-slot="notes-contextual-placeholder"]');
}

function failure(status: number): Reply {
  return () => Promise.resolve(new Response("{}", { status }));
}

async function findSidebar() {
  return within(await screen.findByRole("complementary", { name: "Огляд нотаток" }));
}

function impressionBodies(): unknown[] {
  return requests
    .filter(({ method, url }) => method === "POST" && pathnameOf(url) === PATHS.impression)
    .map(({ body }) => body);
}

function json(body: unknown): Reply {
  return () => Promise.resolve(jsonResponse(body));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockArchive(scope: NotesArchiveScope, replies: ArchiveReplies = {}) {
  const defaults = {
    facets: scope === "books" ? BOOK_FACETS : SERIES_FACETS,
    note: scope === "books" ? archiveBookNote() : archiveSeriesNote(),
    overview: scope === "books" ? EMPTY_BOOK_OVERVIEW : seriesOverview(),
    summary: scope === "books" ? BOOK_SUMMARY : SERIES_SUMMARY,
  };
  const {
    impression = noContent,
    overview = json(defaults.overview),
    review = noContent,
    summary = json(defaults.summary),
  } = replies;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method ?? "GET").toUpperCase();
      requests.push({ body: parseBody(init?.body), method, url });
      const path = pathnameOf(url);

      if (method === "POST" && path === PATHS.impression) return impression();
      if (method === "POST" && path === PATHS.review) return review();
      if (path === `/api/notes/${scope}/summary`) return summary();
      if (path === `/api/notes/${scope}/overview`) return overview();
      if (path === `/api/notes/${scope}/facets`) return json(defaults.facets)();
      if (path === `/api/notes/${scope}`) return json(notesPage([defaults.note]))();
      if (path === "/api/books" || path === "/api/series") return json(notesPage([]))();
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    }),
  );
}

function noContent(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 204 }));
}

function notesPage(items: NoteView[]) {
  return {
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

function openedBook(events: UrlUpdateEvent[]): Nullable<string> {
  return events.at(-1)?.searchParams.get("book") ?? null;
}

function overviewRequests(scope: NotesArchiveScope): RecordedRequest[] {
  return requestsTo(`/api/notes/${scope}/overview`);
}

function parseBody(body: BodyInit | null | undefined): unknown {
  return typeof body === "string" ? JSON.parse(body) : null;
}

function pathnameOf(url: string): string {
  return new URL(url, "http://localhost").pathname;
}

function renderArchive(
  scope: NotesArchiveScope,
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction,
) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <NotesArchiveView scope={scope} />
    </NuqsTestingAdapter>,
  );
}

async function reportVisibility(isIntersecting: boolean, element: Element) {
  await act(async () => {
    for (const observer of visibilityObservers) {
      if (!observer.active || !observer.elements.includes(element)) continue;
      const entry = { isIntersecting, target: element } as IntersectionObserverEntry;
      observer.callback([entry], {} as IntersectionObserver);
    }
  });
}

function requestsTo(path: string): RecordedRequest[] {
  return requests.filter(({ url }) => pathnameOf(url) === path);
}

function reviewBodies(): unknown[] {
  return requests
    .filter(({ method, url }) => method === "POST" && pathnameOf(url) === PATHS.review)
    .map(({ body }) => body);
}

function searchParamsOf(request: RecordedRequest | undefined): URLSearchParams {
  if (request === undefined) throw new Error("the request was never made");
  return new URL(request.url, "http://localhost").searchParams;
}

function seriesOverview(overrides: Partial<SeriesNotesOverviewView> = {}): SeriesNotesOverviewView {
  return { beforeNextBook: null, memoryNote: null, ...overrides };
}

function sidebar() {
  return within(screen.getByRole("complementary", { name: "Огляд нотаток" }));
}

function sidebarRegionNames(): string[] {
  return sidebar()
    .getAllByRole("heading", { level: 2 })
    .map((heading) => (heading.textContent ?? "").trim());
}

function stubViewport(initial: "narrow" | "wide") {
  let isWide = initial === "wide";
  const listeners = new Set<() => void>();

  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    get matches() {
      return isWide;
    },
    media,
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));

  return {
    narrow: () =>
      act(() => {
        isWide = false;
        for (const listener of listeners) listener();
      }),
  };
}

function summaryCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="stat-card"]')];
}

function summaryCardText(label: string): string {
  const card = summaryCards().find((element) => within(element).queryByText(label) !== null);
  if (card === undefined) throw new Error(`no summary card labelled ${label}`);
  return card.textContent ?? "";
}

async function summaryMicrofact(label: string): Promise<string> {
  await waitFor(() => expect(summaryCards()).toHaveLength(4));
  return summaryCardText(label);
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}
