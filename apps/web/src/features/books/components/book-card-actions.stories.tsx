import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { readingStatuses } from "@/lib/book-status";
import { statusEntry } from "@/lib/book-status.fixtures";

import type { LibraryActions } from "../model/book-card-actions";
import type { LibraryBook } from "../model/library-book";

import { BookCardActions } from "./book-card-actions";

const fallbackStatus = statusEntry(readingStatuses, "not_started", "Не почато");

const noopActions: LibraryActions = {
  onAddTags: async () => {},
  onAddToList: async () => {},
  onAddToQueue: async () => {},
  onChangeOwnership: async () => {},
  onChangeReadingStatus: async () => {},
  onDelete: async () => {},
  onEdit: () => {},
  onRemoveFromQueue: async () => {},
  onSetFavorite: async () => {},
  onToggleFavorite: () => {},
};

function makeBook(overrides: Partial<LibraryBook>): LibraryBook {
  return {
    authors: ["Сара Дж. Маас"],
    formats: [],
    href: "/books/1/edit",
    id: "1",
    isFavorite: false,
    isInReadingQueue: false,
    ownershipStatus: "owned",
    readingStatus: "not_started",
    status: fallbackStatus,
    title: "Двір срібного полум'я",
    ...overrides,
  };
}

async function openMenu(canvas: ReturnType<typeof within>) {
  const trigger = canvas.getByRole("button", { name: "Дії" });
  await userEvent.click(trigger);
  return within(document.body);
}

const meta = {
  args: { actions: noopActions, book: makeBook({}), onOpenDialog: () => {} },
  component: BookCardActions,
  tags: ["ai-generated"],
  title: "Books/BookCardActions",
} satisfies Meta<typeof BookCardActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotStarted: Story = {
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Почати читати" })).toBeVisible(),
    );
    await expect(menu.getByRole("menuitem", { name: "Позначити як прочитану" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Додати в чергу читання" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Редагувати" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Видалити" })).toBeVisible();
  },
};

export const Reading: Story = {
  args: { book: makeBook({ readingStatus: "reading" }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Позначити як прочитану" })).toBeVisible(),
    );
    await expect(menu.queryByRole("menuitem", { name: "Почати читати" })).toBeNull();
  },
};

export const Finished: Story = {
  args: { book: makeBook({ readingStatus: "finished" }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Почати читати" })).toBeVisible(),
    );
    await expect(menu.queryByRole("menuitem", { name: "Позначити як прочитану" })).toBeNull();
  },
};

export const InQueue: Story = {
  args: { book: makeBook({ isInReadingQueue: true }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Прибрати з черги читання" })).toBeVisible(),
    );
    await expect(menu.queryByRole("menuitem", { name: "Додати в чергу читання" })).toBeNull();
  },
};

export const Favorited: Story = {
  args: { book: makeBook({ isFavorite: true }) },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Прибрати з улюблених" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button.querySelector("use")).toHaveAttribute(
      "href",
      "/icons/ui-icons.svg#i-heart-fill",
    );
  },
};

export const NotFavorited: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Додати до улюблених" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button.querySelector("use")).toHaveAttribute(
      "href",
      "/icons/ui-icons.svg#i-heart",
    );
  },
};
