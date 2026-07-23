import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import {
  makeSeriesBookView,
  makeSeriesDetailsView,
  makeSeriesStats,
} from "../model/series.fixtures";
import { SeriesDetailsView } from "./series-details-view";

const GENRES_FIXTURE = [
  { key: "fantasy", name: "Фентезі" },
  { key: "romance", name: "Романтика" },
].map((genre, index) => ({
  ...genre,
  groupKey: "fiction",
  groupName: "Художня література",
  id: `genre-${index}`,
  isDefault: true,
}));

function mockGenres() {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    const body = path.includes("/api/genres") ? GENRES_FIXTURE : {};
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    );
  }) as typeof fetch;
}

const meta = {
  beforeEach: () => {
    getQueryClient().clear();
    mockGenres();
  },
  component: SeriesDetailsView,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesDetailsView",
} satisfies Meta<typeof SeriesDetailsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { details: makeSeriesDetailsView() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Емпіреї" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Книги серії" })).toBeVisible();
    await expect(canvas.getAllByText("Четверте крило").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ваш прогрес у серії").length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  args: {
    details: makeSeriesDetailsView({
      books: [],
      booksInSeries: 0,
      finishedInSeries: 0,
      nextBook: null,
      readingInSeries: 0,
      stats: makeSeriesStats({
        averageRating: null,
        booksCount: 0,
        finishedCount: 0,
        pagesCount: null,
        readingCount: 0,
        unreadCount: 0,
      }),
      totalBooks: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("У цій серії ще немає книг")).toBeVisible());
    await expect(canvas.getAllByText("Прогрес ще недоступний").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Додайте першу книгу").length).toBeGreaterThan(0);
  },
};

export const AllRead: Story = {
  args: {
    details: makeSeriesDetailsView({
      books: [
        makeSeriesBookView({ id: "b1", partNumber: 1, rating: 9, readingStatus: "finished" }),
        makeSeriesBookView({
          id: "b2",
          partNumber: 2,
          rating: 8,
          readingStatus: "finished",
          title: "Ковадло зірок",
        }),
        makeSeriesBookView({
          id: "b3",
          partNumber: 3,
          rating: 10,
          readingStatus: "finished",
          title: "Оніксове полум'я",
        }),
      ],
      booksInSeries: 3,
      finishedInSeries: 3,
      nextBook: null,
      readingInSeries: 0,
      stats: makeSeriesStats({
        booksCount: 3,
        finishedCount: 3,
        readingCount: 0,
        unreadCount: 0,
      }),
      status: "completed",
      totalBooks: 3,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Серію прочитано").length).toBeGreaterThan(0);
    await expect(canvas.queryByText("Ваш прогрес у серії")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "Наступна книга" })).not.toBeInTheDocument();
  },
};
