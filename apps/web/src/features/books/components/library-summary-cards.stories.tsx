import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { LibrarySummaryCards } from "./library-summary-cards";

const cards: LibrarySummaryCard[] = [
  { icon: "library", iconTone: "primary", label: "Усього книг", unit: "книг", value: 128 },
  { icon: "book", iconTone: "info", label: "Читаю", unit: "книги", value: 4 },
  { icon: "check-circle", iconTone: "success", label: "Прочитано", unit: "книг", value: 86 },
  {
    icon: "heart",
    iconTone: "favorite",
    label: "Улюблених",
    microfact: "13% бібліотеки",
    unit: "книг",
    value: 17,
  },
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
