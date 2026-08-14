import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryHistoryCard } from "./delivery-history-card";
import { makeHistoryCardModel } from "./delivery-history.fixtures";

const meta = {
  args: {
    model: makeHistoryCardModel(),
    onCancel: () => {},
    onEdit: () => {},
    onReceive: () => {},
    receivePending: false,
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

export const Active: Story = {
  args: {
    model: makeHistoryCardModel({
      badge: { icon: "truck", label: "В дорозі", tone: "info", value: "in_transit" },
      isActive: true,
      receivedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Позначити як отриману" })).toBeVisible(),
    );
  },
};

export const Cancelled: Story = {
  args: {
    model: makeHistoryCardModel({
      badge: { icon: "x-circle", label: "Скасовано", tone: "neutral", value: "cancelled" },
      cancelledDateText: "10 лип. 2026",
      isActive: false,
      priceText: null,
      receivedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Дата скасування")).toBeVisible());
    await expect(canvas.getByText("10 лип. 2026")).toBeVisible();
  },
};

export const DeletedBook: Story = {
  args: {
    model: makeHistoryCardModel({
      badge: { icon: "package", label: "Замовлено", tone: "neutral", value: "ordered" },
      book: null,
      isActive: false,
      receivedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Книгу видалено")).toBeVisible());
  },
};
