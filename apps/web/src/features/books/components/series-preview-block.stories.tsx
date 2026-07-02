import type { BookView, SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { SeriesPreviewBlock } from "./series-preview-block";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-series000001";

function makeSeries(overrides: Partial<SeriesView> = {}): SeriesView {
  return {
    authors: [{ id: "s-author-1", name: "Ребекка Яррос" }],
    booksInSeries: 3,
    description: null,
    finishedInSeries: 1,
    id: "series-1",
    name: "Емпіреї",
    nextBook: { id: "next-book-1", partNumber: 2, title: "Ковадло зірок" },
    status: "ongoing",
    totalBooks: 5,
    ...overrides,
  };
}

function seriesBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    bookType: "series_part",
    hasUnreadEarlierSeriesParts: null,
    id: BOOK_ID,
    partNumber: 1,
    readingStatus: "reading",
    series: makeSeries(),
    ...overrides,
  });
}

const meta = {
  component: SeriesPreviewBlock,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-80 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Books/SeriesPreviewBlock",
} satisfies Meta<typeof SeriesPreviewBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OngoingReading: Story = {
  args: { book: seriesBook() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Серія")).toBeVisible();
    await expect(canvas.getByText("Емпіреї")).toBeVisible();
    await expect(canvas.getByText("Серія ще виходить")).toBeVisible();
    await expect(canvas.getByText("Частина 1 з 5")).toBeVisible();
    await expect(canvas.getByText("Прочитано 1 з 5 · 20%")).toBeVisible();
    await expect(canvas.getByText("Ви читаєте цю книгу зараз")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Наступна: Ковадло зірок · частина 2" }),
    ).toBeVisible();
  },
};

export const CompletedFinished: Story = {
  args: {
    book: seriesBook({
      readingStatus: "finished",
      series: makeSeries({ finishedInSeries: 5, status: "completed" }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Серія завершена")).toBeVisible();
    await expect(canvas.getByText("Прочитано 5 з 5 · 100%")).toBeVisible();
    await expect(canvas.getByText("Цю книгу вже прочитано")).toBeVisible();
  },
};

export const Rereading: Story = {
  args: { book: seriesBook({ readingStatus: "rereading" }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Ви перечитуєте цю книгу")).toBeVisible();
  },
};

export const IsNextBook: Story = {
  args: {
    book: seriesBook({
      readingStatus: "not_started",
      series: makeSeries({ nextBook: { id: BOOK_ID, partNumber: 1, title: "Емпіреї" } }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Це наступна книга у серії")).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

export const UnreadEarlierParts: Story = {
  args: {
    book: seriesBook({
      hasUnreadEarlierSeriesParts: true,
      partNumber: 3,
      readingStatus: "not_started",
      series: makeSeries({ nextBook: null }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Перед цією книгою є непрочитані частини")).toBeVisible();
  },
};

export const SeriesFinished: Story = {
  args: {
    book: seriesBook({
      hasUnreadEarlierSeriesParts: false,
      readingStatus: "want_to_read",
      series: makeSeries({
        booksInSeries: 3,
        finishedInSeries: 3,
        nextBook: null,
        totalBooks: 3,
      }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Серію прочитано")).toBeVisible();
    await expect(canvas.getByText("Прочитано 3 з 3 · 100%")).toBeVisible();
  },
};

export const NoPartNumber: Story = {
  args: { book: seriesBook({ partNumber: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Номер частини не вказаний")).toBeVisible();
  },
};

export const AddedFallback: Story = {
  args: {
    book: seriesBook({
      partNumber: 2,
      series: makeSeries({
        booksInSeries: 4,
        finishedInSeries: 2,
        nextBook: null,
        totalBooks: null,
      }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Частина 2 (додано 4)")).toBeVisible();
    await expect(canvas.getByText("Прочитано 2 з 4 · доданих · 50%")).toBeVisible();
  },
};

export const ProgressUnavailable: Story = {
  args: {
    book: seriesBook({
      hasUnreadEarlierSeriesParts: false,
      readingStatus: "not_started",
      series: makeSeries({ booksInSeries: 0, finishedInSeries: 0, nextBook: null, totalBooks: 5 }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прогрес серії ще недоступний")).toBeVisible();
    await expect(canvas.getByText("Частина 1 з 5")).toBeVisible();
  },
};

export const HiddenForSoloBook: Story = {
  args: { book: makeBookView({ series: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Серія")).toBeNull();
  },
};
