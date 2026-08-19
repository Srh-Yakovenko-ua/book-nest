import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryHistoryCard } from "./delivery-history-card";
import { makeHistoryCardModel } from "./delivery-history.fixtures";

const meta = {
  args: {
    model: makeHistoryCardModel(),
  },
  component: DeliveryHistoryCard,
  parameters: { layout: "padded" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryHistoryCard",
} satisfies Meta<typeof DeliveryHistoryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Received: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Таємна історія")).toBeVisible());
    await expect(canvas.getByText("Отримано")).toBeVisible();
    await expect(canvas.getByText("14 лип. 2026")).toBeVisible();
  },
};

export const Cancelled: Story = {
  args: {
    model: makeHistoryCardModel({
      badge: { icon: "x-circle", label: "Скасовано", tone: "neutral", value: "cancelled" },
      cancelledDateText: "10 лип. 2026",
      cancelReason: "Магазин скасував замовлення — книги немає в наявності.",
      priceText: null,
      receivedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Причина скасування")).toBeVisible());
    await expect(
      canvas.getByText("Магазин скасував замовлення — книги немає в наявності."),
    ).toBeVisible();
  },
};

export const DeletedBook: Story = {
  args: {
    model: makeHistoryCardModel({
      badge: { icon: "x-circle", label: "Скасовано", tone: "neutral", value: "cancelled" },
      book: null,
      cancelledDateText: "2 лип. 2026",
      receivedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Книгу видалено")).toBeVisible());
  },
};
