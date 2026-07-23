import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { makePublisherPriceTotal, makePublishersSummary } from "../model/publisher.fixtures";
import { PublisherSummaryCards } from "./publisher-summary-cards";

const meta = {
  args: {
    isError: false,
    isLoading: false,
    onRetry: fn(),
    summary: makePublishersSummary({
      booksWithPublisherCount: 340,
      expectedPriceTotals: [makePublisherPriceTotal()],
      publishersCount: 12,
    }),
  },
  component: PublisherSummaryCards,
  tags: ["ai-generated"],
  title: "Publishers/PublisherSummaryCards",
} satisfies Meta<typeof PublisherSummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Видавництв")).toBeVisible());
    await expect(canvas.getByText("12")).toBeVisible();
    await expect(canvas.getByText("Книг із видавництвом")).toBeVisible();
    await expect(canvas.getByText("340")).toBeVisible();
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
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити зведення")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Спробувати ще раз" }));
    await waitFor(() => expect(args.onRetry).toHaveBeenCalled());
  },
};
