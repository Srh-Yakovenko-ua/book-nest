import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryHistoryCard } from "./delivery-history-card";
import { historyCardModels, makeHistoryCardModel } from "./delivery-history.fixtures";

const meta = {
  args: {
    model: makeHistoryCardModel(),
    search: "",
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
    await expect(canvas.getByText("Отримано 19 серп. 2026")).toBeVisible();
    await expect(canvas.getByText("Yakaboo")).toBeVisible();
  },
};

export const MultipleShipments: Story = {
  args: { model: historyCardModels[1] },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Посилка 1")).toBeVisible());
    await expect(canvas.getByText("Посилка 2")).toBeVisible();
    await expect(canvas.getByText("Отримано 12 серп. 2026")).toBeVisible();
    await expect(canvas.getByText("Отримано 18 серп. 2026")).toBeVisible();
    await expect(canvas.getByText("Очікувалось 14 серп. 2026")).toBeVisible();
  },
};

export const Cancelled: Story = {
  args: { model: historyCardModels[2] },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Скасовано 10 лип. 2026")).toBeVisible());
    await expect(
      canvas.getByText("Магазин скасував замовлення — книги немає в наявності."),
    ).toBeVisible();
    await expect(canvas.getByText("Ще не відправлено")).toBeVisible();
    await expect(canvas.getByText("Скасовано 2 лип. 2026")).toBeVisible();
  },
};
