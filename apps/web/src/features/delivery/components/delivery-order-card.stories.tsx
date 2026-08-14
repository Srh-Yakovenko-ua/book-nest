import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryOrderCard } from "./delivery-order-card";
import { deliveryOrderCards } from "./delivery.fixtures";

const meta = {
  args: {
    model: deliveryOrderCards.singleBook,
    onCancelBook: () => {},
    onEditBook: () => {},
    onReceiveBook: () => {},
    onReceiveShipment: () => {},
    onToggleSelectBook: () => {},
    receivePendingBookId: null,
    selectedBookIds: new Set<string>(),
  },
  component: DeliveryOrderCard,
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Delivery/DeliveryOrderCard",
} satisfies Meta<typeof DeliveryOrderCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SingleBookSingleShipment: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Yakaboo")).toBeVisible());
    await expect(canvas.getByText("ORD-10241 · 5 лип. 2026")).toBeVisible();
    await expect(canvas.getByText("1 книга в дорозі")).toBeVisible();
    await expect(canvas.getByText("Таємна історія")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позначити посилку отриманою" })).toBeVisible();
  },
};

export const MultipleBooksSingleShipment: Story = {
  args: { model: deliveryOrderCards.multipleBooks },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Читайлик")).toBeVisible());
    await expect(canvas.getByText("3 книги в дорозі")).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(
      canvas.getAllByRole("button", { name: "Позначити посилку отриманою" }),
    ).toHaveLength(1);
  },
};

export const MultipleShipments: Story = {
  args: { model: deliveryOrderCards.multiShipment },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Book Depository")).toBeVisible());
    await expect(canvas.getByText("Готова до отримання")).toBeVisible();
    await expect(canvas.getByText("Затримується")).toBeVisible();
    await expect(canvas.getByText("Відділення №12, тільки до 18:00")).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: "Позначити посилку отриманою" }),
    ).toHaveLength(2);
  },
};

export const NotShippedYet: Story = {
  args: { model: deliveryOrderCards.notShipped },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Книгарня Є")).toBeVisible());
    await expect(canvas.getByText("Ще не відправлено")).toBeVisible();
    await expect(canvas.getByText("Замовлено")).toBeVisible();
    await expect(canvas.queryByText("Трекінг")).toBeNull();
  },
};

export const WithSelectedBook: Story = {
  args: {
    model: deliveryOrderCards.multipleBooks,
    selectedBookIds: new Set(["book-2"]),
  },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox", { name: "Вибрати «Імʼя вітру»" });
    await waitFor(() => expect(checkbox).toBeChecked());
  },
};
