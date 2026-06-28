import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { readingStatuses } from "@/lib/book-status";

import type { LibraryBook } from "../model/library-book";

import { BookRow } from "./book-row";

const reading = readingStatuses.find((status) => status.value === "reading") ?? readingStatuses[0];

const book: LibraryBook = {
  author: "Сара Дж. Маас",
  href: "/books/1/edit",
  id: "1",
  isFavorite: false,
  isInReadingQueue: false,
  ownershipStatus: "owned",
  pagesText: "768 стор.",
  rating: 4,
  ratingLabel: "Рейтинг 4 з 5",
  readingStatus: "reading",
  status: reading,
  title: "Двір срібного полум'я",
  year: 2021,
};

const meta = {
  args: { book },
  component: BookRow,
  tags: ["ai-generated"],
  title: "Books/BookRow",
} satisfies Meta<typeof BookRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "Двір срібного полум'я" });
    await waitFor(() => expect(link).toBeVisible());
    await expect(link).toHaveAttribute("href", "/books/1/edit");
    await expect(canvas.getByText("Сара Дж. Маас")).toBeVisible();
  },
};
