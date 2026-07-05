import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, waitFor, within } from "storybook/test";

import { RemoveBookFromSeriesDialog } from "./remove-book-from-series-dialog";

const meta = {
  args: { isRemoving: false, onConfirm: fn(), onOpenChange: fn(), open: true },
  component: RemoveBookFromSeriesDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Series/RemoveBookFromSeriesDialog",
} satisfies Meta<typeof RemoveBookFromSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Прибрати книгу з серії?" })).toBeVisible(),
    );
    await expect(body.getByText(/Книга залишиться у вашій бібліотеці/)).toBeVisible();
    await expect(body.getByRole("button", { name: "Прибрати з серії" })).toBeVisible();
  },
};
