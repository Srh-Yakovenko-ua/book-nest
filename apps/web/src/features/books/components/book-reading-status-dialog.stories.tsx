import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { BookReadingStatusDialog } from "./book-reading-status-dialog";

const meta = {
  args: {
    bookCount: 3,
    onConfirm: fn(async () => {}),
    onOpenChange: fn(),
    open: true,
  },
  component: BookReadingStatusDialog,
  tags: ["ai-generated"],
  title: "Books/BookReadingStatusDialog",
} satisfies Meta<typeof BookReadingStatusDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Змінити статус читання" })).toBeVisible(),
    );
    await expect(body.getByRole("radio", { name: "Читаю" })).toBeVisible();
    await expect(body.getByRole("button", { name: "Застосувати" })).toBeVisible();
    await expect(body.getByRole("button", { name: "Скасувати" })).toBeVisible();
  },
};

export const ApplySelection: Story = {
  args: { defaultValue: "want_to_read", onConfirm: fn(async () => {}) },
  play: async ({ args }) => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("radio", { name: "Прочитано" })).toBeVisible());
    await userEvent.click(body.getByRole("radio", { name: "Прочитано" }));
    await userEvent.click(body.getByRole("button", { name: "Застосувати" }));
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalledWith("finished"));
  },
};

export const StaysOpenOnError: Story = {
  args: {
    onConfirm: fn(async () => {
      throw new Error("mutation failed");
    }),
  },
  play: async ({ args }) => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("button", { name: "Застосувати" })).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Застосувати" }));
    await waitFor(() => expect(args.onConfirm).toHaveBeenCalled());
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(false);
    await expect(body.getByRole("heading", { name: "Змінити статус читання" })).toBeVisible();
  },
};
