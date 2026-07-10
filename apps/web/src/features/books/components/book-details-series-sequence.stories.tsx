import type { MediaView, SeriesBookView, SeriesDetailsView, SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import {
  makeSeriesBookView,
  makeSeriesDetailsView,
  makeSeriesView,
} from "../../series/model/series.fixtures";
import { BookDetailsSeriesSequence } from "./book-details-series-sequence";
import { makeBookView } from "./book-details.fixtures";

function currentBook(seriesId: string, partNumber: number, series: SeriesView) {
  return makeBookView({
    bookType: "series_part",
    id: `${seriesId}-current`,
    partNumber,
    series,
  });
}

function mockCover(id: string): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 1600,
    id,
    kind: "book_cover",
    name: null,
    sizeBytes: 1000,
    urls: {
      card: "https://placehold.co/300x400",
      full: "https://placehold.co/300x400",
      thumb: "https://placehold.co/300x400",
    },
    width: 1200,
  };
}

function mockSeriesDetails(details: SeriesDetailsView) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    if (path.includes("/api/series/")) {
      return Promise.resolve(
        new Response(JSON.stringify(details), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.resolve(
      new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 }),
    );
  }) as typeof fetch;
}

function seriesBook(overrides: Partial<SeriesBookView>): SeriesBookView {
  return makeSeriesBookView({ ...overrides });
}

const meta = {
  component: BookDetailsSeriesSequence,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Books/BookDetailsSeriesSequence",
} satisfies Meta<typeof BookDetailsSeriesSequence>;

export default meta;

type Story = StoryObj<typeof meta>;

const KNOWN_ID = "seq-known-gaps";
const knownSeries = makeSeriesView({
  booksInSeries: 3,
  id: KNOWN_ID,
  name: "Емпіреї",
  totalBooks: 5,
});

export const KnownTotalWithGaps: Story = {
  args: { book: currentBook(KNOWN_ID, 1, knownSeries) },
  beforeEach: () => {
    mockSeriesDetails(
      makeSeriesDetailsView({
        books: [
          seriesBook({
            cover: mockCover("cover-known-1"),
            id: `${KNOWN_ID}-current`,
            partNumber: 1,
            readingStatus: "finished",
            title: "Четверте крило",
          }),
          seriesBook({
            cover: mockCover("cover-known-2"),
            id: "known-2",
            partNumber: 2,
            readingStatus: "reading",
            title: "Ковадло зірок",
          }),
          seriesBook({
            cover: null,
            id: "known-4",
            partNumber: 4,
            readingStatus: "want_to_read",
            title: "Полум'я",
          }),
        ],
        booksInSeries: 3,
        id: KNOWN_ID,
        name: "Емпіреї",
        totalBooks: 5,
      }),
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Послідовність серії")).toBeVisible();
    await waitFor(async () => {
      await expect(canvas.getByText("Поточна")).toBeVisible();
    });
    const readingLinks = canvas.getAllByRole("link", { name: /Ковадло зірок/ });
    await expect(readingLinks.length).toBeGreaterThan(0);
    await expect(readingLinks[0]).toBeVisible();
    await expect(canvas.getByText(/Показано весь порядок циклу/, { exact: false })).toBeVisible();
  },
};

const OPEN_ID = "seq-unknown-open";
const openSeries = makeSeriesView({
  booksInSeries: 2,
  id: OPEN_ID,
  name: "Хроніки Амбера",
  totalBooks: null,
});

export const UnknownTotalOpenSlot: Story = {
  args: { book: currentBook(OPEN_ID, 1, openSeries) },
  beforeEach: () => {
    mockSeriesDetails(
      makeSeriesDetailsView({
        books: [
          seriesBook({
            id: `${OPEN_ID}-current`,
            partNumber: 1,
            readingStatus: "finished",
            title: "Дев'ять принців Амбера",
          }),
          seriesBook({
            id: "amber-2",
            partNumber: 2,
            readingStatus: "reading",
            title: "Рушниці Авалона",
          }),
        ],
        booksInSeries: 2,
        id: OPEN_ID,
        name: "Хроніки Амбера",
        totalBooks: null,
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Додати книгу серії")).toBeVisible();
    });
    await expect(canvas.getByText(/У бібліотеці 2/)).toBeVisible();
  },
};

const DONE_ID = "seq-completed";
const doneSeries = makeSeriesView({
  booksInSeries: 3,
  id: DONE_ID,
  name: "Основа",
  totalBooks: 3,
});

export const AllFinished: Story = {
  args: { book: currentBook(DONE_ID, 2, doneSeries) },
  beforeEach: () => {
    mockSeriesDetails(
      makeSeriesDetailsView({
        books: [
          seriesBook({ id: "found-1", partNumber: 1, readingStatus: "finished", title: "Основа" }),
          seriesBook({
            id: `${DONE_ID}-current`,
            partNumber: 2,
            readingStatus: "finished",
            title: "Основа та Імперія",
          }),
          seriesBook({
            id: "found-3",
            partNumber: 3,
            readingStatus: "finished",
            title: "Друга Основа",
          }),
        ],
        booksInSeries: 3,
        id: DONE_ID,
        name: "Основа",
        totalBooks: 3,
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Серію завершено")).toBeVisible();
    });
  },
};

const NONUM_ID = "seq-no-number";
const nonumSeries = makeSeriesView({
  booksInSeries: 3,
  id: NONUM_ID,
  name: "Відьмак",
  totalBooks: 2,
});

export const WithNumberlessBook: Story = {
  args: { book: currentBook(NONUM_ID, 1, nonumSeries) },
  beforeEach: () => {
    mockSeriesDetails(
      makeSeriesDetailsView({
        books: [
          seriesBook({
            id: `${NONUM_ID}-current`,
            partNumber: 1,
            readingStatus: "finished",
            title: "Останнє бажання",
          }),
          seriesBook({
            id: "witcher-2",
            partNumber: 2,
            readingStatus: "reading",
            title: "Меч призначення",
          }),
          seriesBook({
            id: "witcher-x",
            partNumber: null,
            readingStatus: "want_to_read",
            title: "Сезон гроз",
          }),
        ],
        booksInSeries: 3,
        id: NONUM_ID,
        name: "Відьмак",
        totalBooks: 2,
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("№?")).toBeVisible();
    });
  },
};

const MOBILE_ID = "seq-mobile";
const mobileSeries = makeSeriesView({
  booksInSeries: 3,
  id: MOBILE_ID,
  name: "Емпіреї",
  totalBooks: 5,
});

export const Mobile: Story = {
  args: { book: currentBook(MOBILE_ID, 1, mobileSeries) },
  beforeEach: () => {
    mockSeriesDetails(
      makeSeriesDetailsView({
        books: [
          seriesBook({
            id: `${MOBILE_ID}-current`,
            partNumber: 1,
            readingStatus: "finished",
            title: "Четверте крило",
          }),
          seriesBook({
            id: "mobile-2",
            partNumber: 2,
            readingStatus: "reading",
            title: "Ковадло зірок",
          }),
          seriesBook({
            id: "mobile-4",
            partNumber: 4,
            readingStatus: "want_to_read",
            title: "Полум'я",
          }),
        ],
        booksInSeries: 3,
        id: MOBILE_ID,
        name: "Емпіреї",
        totalBooks: 5,
      }),
    );
  },
  decorators: [
    (Story) => (
      <div className="w-[375px] p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Послідовність серії")).toBeVisible();
    await waitFor(async () => {
      await expect(canvas.getByText("Поточна")).toBeVisible();
    });
  },
};
