import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { makeSeriesBookView } from "../model/series.fixtures";
import { SeriesBookRow } from "./series-book-row";

const meta = {
  component: SeriesBookRow,
  decorators: [
    (Story) => (
      <div className="w-[640px] max-w-full p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesBookRow",
} satisfies Meta<typeof SeriesBookRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Finished: Story = {
  args: {
    book: makeSeriesBookView({ partNumber: 1, rating: 9, readingStatus: "finished" }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Четверте крило" })).toBeVisible();
    await expect(canvas.getByText("Прочитано")).toBeVisible();
    await expect(canvas.getByText("9/10")).toBeVisible();
  },
};

export const Reading: Story = {
  args: {
    book: makeSeriesBookView({
      currentPage: 180,
      pagesCount: 640,
      partNumber: 2,
      rating: null,
      readingStatus: "reading",
      title: "Ковадло зірок",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Читаю")).toBeVisible();
    await expect(canvas.getByText("стор. 180 з 640")).toBeVisible();
  },
};

export const NotStarted: Story = {
  args: {
    book: makeSeriesBookView({
      ownershipStatus: "want_to_buy",
      partNumber: 3,
      rating: null,
      readingStatus: "not_started",
      title: "Оніксове полум'я",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Не почато")).toBeVisible();
    await expect(canvas.getByText("Хочу купити")).toBeVisible();
  },
};

export const WithoutPartNumber: Story = {
  args: {
    book: makeSeriesBookView({ partNumber: null, rating: null, readingStatus: "not_started" }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("—")).toBeVisible();
  },
};
