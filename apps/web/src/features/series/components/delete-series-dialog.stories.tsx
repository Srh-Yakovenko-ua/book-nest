import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, waitFor, within } from "storybook/test";

import { DeleteSeriesDialog } from "./delete-series-dialog";

const meta = {
  args: {
    booksCount: 5,
    isDeleting: false,
    onConfirm: fn(),
    onOpenChange: fn(),
    open: true,
  },
  component: DeleteSeriesDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Series/DeleteSeriesDialog",
} satisfies Meta<typeof DeleteSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithBooks: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Видалити серію?" })).toBeVisible(),
    );
    await expect(body.getByText(/У цій серії є книги/)).toBeVisible();
    await expect(body.getByText("Книг у серії: 5")).toBeVisible();
  },
};

export const EmptySeries: Story = {
  args: { booksCount: 0 },
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByText("Цю серію буде видалено з вашої бібліотеки.")).toBeVisible(),
    );
  },
};
