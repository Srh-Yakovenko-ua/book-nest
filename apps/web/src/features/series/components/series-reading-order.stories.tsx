import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { makeSeriesBookView } from "../model/series.fixtures";
import { SeriesReadingOrder } from "./series-reading-order";

const meta = {
  component: SeriesReadingOrder,
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesReadingOrder",
} satisfies Meta<typeof SeriesReadingOrder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithBooks: Story = {
  args: {
    books: [
      makeSeriesBookView({ id: "b1", partNumber: 1, title: "Четверте крило" }),
      makeSeriesBookView({ id: "b2", partNumber: 2, title: "Ковадло зірок" }),
      makeSeriesBookView({ id: "b3", partNumber: 3, title: "Оніксове полум'я" }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Порядок читання")).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Четверте крило/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Оніксове полум'я/ })).toBeVisible();
  },
};

export const HiddenWhenSingleBook: Story = {
  args: {
    books: [makeSeriesBookView({ id: "b1", partNumber: 1, title: "Четверте крило" })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Порядок читання")).toBeNull();
  },
};
