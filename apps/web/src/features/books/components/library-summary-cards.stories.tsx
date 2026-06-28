import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { LibrarySummaryCards } from "./library-summary-cards";

const cards: LibrarySummaryCard[] = [
  { icon: "library", label: "Усього книг", value: 128 },
  { icon: "book", label: "Читаю", value: 4 },
  { icon: "check-circle", label: "Прочитано", value: 86 },
  { icon: "heart", label: "Улюблених", value: 17 },
];

const meta = {
  args: { cards, isLoading: false },
  component: LibrarySummaryCards,
  tags: ["ai-generated"],
  title: "Books/LibrarySummaryCards",
} satisfies Meta<typeof LibrarySummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього книг")).toBeVisible());
    await expect(canvas.getByText("128")).toBeVisible();
    await expect(canvas.getByText("Улюблених")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};
