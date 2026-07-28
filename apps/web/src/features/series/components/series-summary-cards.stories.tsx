import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import type { SeriesSummaryCard } from "./series-summary-cards";

import { SeriesSummaryCards } from "./series-summary-cards";

const cards: SeriesSummaryCard[] = [
  { icon: "layers", iconTone: "primary", label: "Усього серій", value: 8 },
  { icon: "check-circle", iconTone: "success", label: "Прочитано", value: 2 },
  { icon: "book", iconTone: "info", label: "Недочитані", value: 5 },
  { icon: "library", iconTone: "primary", label: "Книг у серіях", value: 14 },
];

const meta = {
  args: { cards, isError: false, isLoading: false, onRetry: fn() },
  component: SeriesSummaryCards,
  tags: ["ai-generated"],
  title: "Series/SeriesSummaryCards",
} satisfies Meta<typeof SeriesSummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього серій")).toBeVisible());
    await expect(canvas.getByText("14")).toBeVisible();
    await expect(canvas.getByText("Книг у серіях")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const ErrorState: Story = {
  args: { isError: true },
  play: async ({ args, canvas }) => {
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити серії")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Спробувати ще раз" }));
    await waitFor(() => expect(args.onRetry).toHaveBeenCalled());
  },
};
