import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliverySummaryCards } from "./delivery-summary-cards";

const cards = [
  { icon: "truck" as const, label: "Усього в дорозі", value: "5" },
  { icon: "clock" as const, label: "Очікуються цього тижня", value: "2" },
  { icon: "alert-triangle" as const, label: "Затримуються", value: "1" },
  { icon: "wallet" as const, label: "Загальна сума", value: "1 555 UAH" },
  { icon: "store" as const, label: "Магазини", value: "3" },
];

const meta = {
  args: { cards, isLoading: false },
  component: DeliverySummaryCards,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliverySummaryCards",
} satisfies Meta<typeof DeliverySummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього в дорозі")).toBeVisible());
    await expect(canvas.getByText("1 555 UAH")).toBeVisible();
  },
};

export const NoPriceData: Story = {
  args: {
    cards: [
      { icon: "truck", label: "Усього в дорозі", value: "2" },
      { icon: "clock", label: "Очікуються цього тижня", value: "0" },
      { icon: "alert-triangle", label: "Затримуються", value: "0" },
      { icon: "wallet", label: "Загальна сума", value: "—" },
      { icon: "store", label: "Магазини", value: "1" },
    ],
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("—")).toBeVisible());
  },
};

export const Loading: Story = {
  args: { isLoading: true },
};
