import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { makeSeriesView } from "../model/series.fixtures";
import { SeriesRow } from "./series-row";

const meta = {
  component: SeriesRow,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesRow",
} satisfies Meta<typeof SeriesRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {
  args: { series: makeSeriesView() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Емпіреї" })).toBeVisible();
    await expect(canvas.getByText("Ще виходить")).toBeVisible();
    await expect(canvas.getByText("Прочитано 1 з 5")).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toBeVisible();
    await expect(
      canvas
        .getByRole("link", { name: "Далі читати: Ковадло зірок · Книга 2" })
        .getAttribute("href"),
    ).toContain("/books/next-book-1");
  },
};

export const NotStarted: Story = {
  args: {
    series: makeSeriesView({
      finishedInSeries: 0,
      nextBook: { cover: null, id: "next-book-1", partNumber: 1, title: "Четверте крило" },
      readingInSeries: 0,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прочитано 0 з 5")).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Почати з: Четверте крило · Книга 1" }).getAttribute("href"),
    ).toContain("/books/next-book-1");
  },
};

export const FullyRead: Story = {
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
    await expect(canvas.getByText("Прочитано 5 з 5")).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toBeVisible();
    await expect(canvas.getByText("Серію прочитано")).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    series: makeSeriesView({
      booksInSeries: 0,
      covers: [],
      finishedInSeries: 0,
      nextBook: null,
      readingInSeries: 0,
      totalBooks: null,
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Книги ще не додані")).toBeVisible();
    await expect(canvas.getByText("0 книг")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Додати книгу" }).getAttribute("href")).toContain(
      "/books/new",
    );
  },
};

export const WithoutTotal: Story = {
  args: {
    series: makeSeriesView({ booksInSeries: 3, finishedInSeries: 1, totalBooks: null }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("3 книги")).toBeVisible();
    await expect(canvas.getByText("Прочитано 1 з 3 доданих")).toBeVisible();
  },
};
