import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { LONG_PUBLISHER_NAME, makePublishersSummary } from "../model/publisher.fixtures";
import { PublisherSummaryCards, usePublisherSummaryCards } from "./publisher-summary-cards";

const SUMMARY = makePublishersSummary({
  booksToBuyWithPublisherCount: 7,
  mostReadPublisher: { id: "ranok", name: "Ранок", readCount: 21 },
  mostRepresentedPublisher: { booksCount: 48, id: "lev", name: LONG_PUBLISHER_NAME },
  publishersCount: 12,
  publishersInPlansCount: 3,
  topFiveBooksCoveragePercent: 62.4,
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
    await expect(canvas.getByText("Топ-5 охоплюють 62% книг")).toBeVisible();
    await expect(canvas.getByText("Найбільше в бібліотеці")).toBeVisible();
    await expect(canvas.getByText(LONG_PUBLISHER_NAME)).toBeVisible();
    await expect(canvas.getByText("48 книг у бібліотеці")).toBeVisible();
    await expect(canvas.getByText("Видавництва у планах")).toBeVisible();
    await expect(canvas.getByText("7 книг у списку бажань")).toBeVisible();
    await expect(canvas.getByText("21 прочитана книга")).toBeVisible();
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
