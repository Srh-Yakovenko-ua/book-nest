import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { makePublisherPriceTotal, makePublishersSummary } from "../model/publisher.fixtures";
import { PublisherSummaryCards, usePublisherSummaryCards } from "./publisher-summary-cards";

const SUMMARY = makePublishersSummary({
  booksWithPublisherCount: 340,
  expectedPriceTotals: [makePublisherPriceTotal()],
  publishersCount: 12,
});

function PublisherSummaryCardsHarness(props: ComponentProps<typeof PublisherSummaryCards>) {
  const cards = usePublisherSummaryCards(SUMMARY);
  return <PublisherSummaryCards {...props} cards={cards} />;
}

const meta = {
  args: { cards: [], isError: false, isLoading: false, onRetry: fn() },
  component: PublisherSummaryCards,
  render: (args) => <PublisherSummaryCardsHarness {...args} />,
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
