import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { makeSeriesView } from "../model/series.fixtures";
import { SeriesCard } from "./series-card";

const meta = {
  component: SeriesCard,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-96 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesCard",
} satisfies Meta<typeof SeriesCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithProgress: Story = {
  args: { series: makeSeriesView() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Емпіреї")).toBeVisible();
    await expect(canvas.getByText("Прочитано 1 з 5")).toBeVisible();
    await expect(canvas.getByText("Наступна: Ковадло зірок · Книга 2")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Емпіреї" }).getAttribute("href")).toContain(
      "/series/series-1",
    );
  },
};

export const AllRead: Story = {
  args: {
    series: makeSeriesView({
      booksInSeries: 5,
      finishedInSeries: 5,
      nextBook: null,
      status: "completed",
      totalBooks: 5,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Усі книги прочитані")).toBeVisible();
    await expect(canvas.getByText("Усю серію прочитано")).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    series: makeSeriesView({
      booksInSeries: 0,
      finishedInSeries: 0,
      nextBook: null,
      totalBooks: null,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Книги ще не додані")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Додати книгу" }).getAttribute("href")).toContain(
      "/books/new",
    );
  },
};

export const NoNextBook: Story = {
  args: {
    series: makeSeriesView({
      booksInSeries: 3,
      finishedInSeries: 1,
      nextBook: null,
      totalBooks: 4,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прочитано 1 з 4")).toBeVisible();
    await expect(canvas.queryByText(/Наступна/)).toBeNull();
  },
};

export const AddedFallback: Story = {
  args: {
    series: makeSeriesView({
      booksInSeries: 4,
      finishedInSeries: 2,
      nextBook: null,
      totalBooks: null,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прочитано 2 з 4 доданих")).toBeVisible();
  },
};

export const LongName: Story = {
  args: {
    series: makeSeriesView({
      authors: [
        { id: "author-1", name: "Джордж Р. Р. Мартін" },
        { id: "author-2", name: "Елліо Гарсія молодший" },
      ],
      name: "Пісня льоду й полум'я: повне видання з додатковими новелами",
    }),
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Пісня льоду й полум'я: повне видання з додатковими новелами"),
    ).toBeVisible();
  },
};
