import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { LibraryBulkBar } from "./library-bulk-bar";

const meta = {
  args: {
    count: 3,
    onAddFavorite: () => {},
    onAddTags: () => {},
    onAddToList: () => {},
    onAddToQueue: () => {},
    onChangeOwnership: () => {},
    onChangeReadingStatus: () => {},
    onClear: () => {},
    onDelete: () => {},
    onRemoveFavorite: () => {},
  },
  component: LibraryBulkBar,
  tags: ["ai-generated"],
  title: "Books/LibraryBulkBar",
} satisfies Meta<typeof LibraryBulkBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Обрано 3 книги")).toBeVisible());
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Додати до списку" })).toBeVisible(),
    );
    await expect(canvas.getByRole("button", { name: "Додати в чергу" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Змінити статус" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Видалити" })).toBeVisible();
  },
};

export const MoreMenu: Story = {
  play: async ({ canvas }) => {
    const more = canvas.getByRole("button", { name: "Ще" });
    await waitFor(() => expect(more).toBeVisible());
    await userEvent.click(more);
    const menu = within(document.body);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Змінити статус володіння" })).toBeVisible(),
    );
    await expect(menu.getByRole("menuitem", { name: "Додати теги" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Додати в улюблені" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Прибрати з улюблених" })).toBeVisible();
  },
};

export const SingleSelected: Story = {
  args: { count: 1 },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Обрано 1 книгу")).toBeVisible());
  },
};
