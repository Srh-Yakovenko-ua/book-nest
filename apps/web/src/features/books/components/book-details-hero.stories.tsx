import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { BookDetailsHero } from "./book-details-hero";
import { makeBookView } from "./book-details.fixtures";

const meta = {
  args: { book: makeBookView() },
  component: BookDetailsHero,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/BookDetailsHero",
} satisfies Meta<typeof BookDetailsHero>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Останнє бажання" })).toBeVisible();
    await expect(canvas.getByText("Анджей Сапковський")).toBeVisible();
    await expect(canvas.getByText("Ostatnie życzenie")).toBeVisible();
    await expect(canvas.getByText("Прочитано")).toBeVisible();
    await expect(canvas.getByText("У наявності")).toBeVisible();
    await expect(canvas.getByText("9/10")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Прибрати з улюблених" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Редагувати" })).toBeVisible();
  },
};

export const SeriesPartWithProgress: Story = {
  args: {
    book: makeBookView({
      bookType: "series_part",
      formats: ["paper"],
      isFavorite: false,
      ownershipStatus: "owned",
      pagesCount: 400,
      partNumber: 1,
      readingProgress: {
        abandonedAt: null,
        currentPage: 120,
        finishedAt: null,
        impression: null,
        lastProgressUpdateAt: null,
        note: null,
        pausedAt: null,
        rating: null,
        startedAt: "2026-03-01",
      },
      readingStatus: "reading",
      series: {
        ageCategories: ["16_plus"],
        authors: [{ id: "11111111-1111-4111-8111-111111111111", name: "Анджей Сапковський" }],
        averagePages: 320,
        averageRating: 8,
        booksInSeries: 8,
        covers: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        description: null,
        finishedInSeries: 2,
        formats: ["paper"],
        genres: [],
        hasFavoriteBook: false,
        hasPublicationYears: true,
        hasPublisher: true,
        id: "series-1",
        languages: ["ukrainian"],
        lastActivityAt: "2026-01-05T00:00:00.000Z",
        missingPartNumbers: [],
        name: "Відьмак",
        nextBook: null,
        ownership: { ownedCount: 2, total: 8 },
        pagesCount: 2560,
        readingInSeries: 0,
        status: "ongoing",
        tags: [],
        totalBooks: 8,
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Читаю")).toBeVisible();
    await expect(canvas.getByText("Відьмак · частина 1")).toBeVisible();
    await expect(canvas.getByText("120 з 400 стор. · 30%")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Додати до улюблених" })).toBeVisible();
  },
};

export const Minimal: Story = {
  args: {
    book: makeBookView({
      cover: null,
      description: null,
      formats: [],
      isFavorite: false,
      originalTitle: null,
      ownershipStatus: "none",
      pagesCount: null,
      publicationYear: null,
      publisher: null,
      readingProgress: null,
      readingStatus: "not_started",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Останнє бажання" })).toBeVisible();
    await expect(canvas.getByText("Не почато")).toBeVisible();
    await expect(canvas.queryByText("9/10")).toBeNull();
  },
};
