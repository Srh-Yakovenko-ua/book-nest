import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { bookFormats, ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { statusEntry } from "@/lib/book-status.fixtures";

import type { LibraryBook, LibraryBookFormat } from "../model/library-book";

import { BookRow } from "./book-row";

const reading = statusEntry(readingStatuses, "reading", "Читаю");
const owned = statusEntry(ownershipStatuses, "owned", "У наявності");
const paperBase = bookFormats.find((format) => format.value === "paper") ?? bookFormats[0];
const paperFormat: LibraryBookFormat = {
  icon: paperBase.icon,
  label: "Паперова",
  value: "paper",
};

const book: LibraryBook = {
  ageBadge: "18+",
  authors: ["Сара Дж. Маас"],
  formats: [paperFormat],
  genres: [
    { icon: "fentezi", label: "Фентезі" },
    { icon: "romantyka", label: "Романтика" },
  ],
  href: "/books/1/edit",
  id: "1",
  isFavorite: false,
  isInReadingQueue: true,
  ownership: { ...owned, label: "Маю" },
  ownershipStatus: "owned",
  pagesText: "768 стор.",
  publisher: "КСД",
  rating: 8,
  ratingLabel: "Рейтинг 8 з 10",
  readingStatus: "reading",
  series: {
    href: "/series/1",
    id: "1",
    name: "Двір шипів і троянд",
    position: 4,
    positionLabel: "Книга 4 з 5",
    total: 5,
  },
  status: reading,
  tags: ["драматично", "романтика", "магія"],
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
