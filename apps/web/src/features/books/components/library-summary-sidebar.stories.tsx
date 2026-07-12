import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { LibrarySummarySidebar } from "./library-summary-sidebar";

const meta = {
  args: {
    isLoading: false,
    recentlyAdded: [
      { author: "Ребекка Яррос", href: "/books/1/edit", id: "1", title: "Четверте крило" },
      { author: "Ребекка Яррос", href: "/books/2/edit", id: "2", title: "Залізне полум'я" },
      { author: "Ребекка Росс", href: "/books/3/edit", id: "3", title: "Божественні суперники" },
    ],
    topGenres: [
      { count: 24, key: "fantasy", name: "Фентезі" },
      { count: 15, key: "romance", name: "Романтика" },
      { count: 9, key: "mystery", name: "Детектив" },
    ],
    topTags: [
      { id: "1", name: "slow burn" },
      { id: "2", name: "dark academia" },
      { id: "3", name: "dragons" },
    ],
  },
  component: LibrarySummarySidebar,
  tags: ["ai-generated"],
  title: "Books/LibrarySummarySidebar",
} satisfies Meta<typeof LibrarySummarySidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Топ жанрів")).toBeVisible());
    await expect(canvas.getByText("Фентезі")).toBeVisible();
    await expect(canvas.getByText("slow burn")).toBeVisible();
    await expect(canvas.getByText("Четверте крило")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { recentlyAdded: [], topGenres: [], topTags: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Жанри ще не додані")).toBeVisible();
    await expect(canvas.getByText("Теги ще не додані")).toBeVisible();
    await expect(canvas.getByText("Книг ще немає")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true, recentlyAdded: [], topGenres: [], topTags: [] },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};
