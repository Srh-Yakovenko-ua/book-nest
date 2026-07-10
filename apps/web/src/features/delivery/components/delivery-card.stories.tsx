import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryCard } from "./delivery-card";
import { makeDeliveryCardModel } from "./delivery.fixtures";

const meta = {
  args: {
    model: makeDeliveryCardModel(),
    onCancel: () => {},
    onEdit: () => {},
    onReceive: () => {},
    onToggleSelect: () => {},
    receivePending: false,
    selected: false,
  },
  component: DeliveryCard,
  decorators: [
    (Story) => (
      <div className="w-full max-w-lg">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Delivery/DeliveryCard",
} satisfies Meta<typeof DeliveryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ArrivingSoon: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Таємна історія")).toBeVisible());
    await expect(canvas.getByText("Очікується скоро")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позначити як отриману" })).toBeVisible();
  },
};

export const Delayed: Story = {
  args: {
    model: makeDeliveryCardModel({
      badge: { icon: "alert-triangle", label: "Затримується", tone: "danger", value: "delayed" },
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Затримується")).toBeVisible());
  },
};

export const NoDeliveryDate: Story = {
  args: {
    model: makeDeliveryCardModel({
      badge: {
        icon: "circle-slash",
        label: "Без дати доставки",
        tone: "neutral",
        value: "no_delivery_date",
      },
      expectedDateText: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Без дати доставки")).toBeVisible());
  },
};

export const Minimal: Story = {
  args: {
    model: makeDeliveryCardModel({
      badge: { icon: "package", label: "Замовлено", tone: "neutral", value: "ordered" },
      deliveryService: null,
      expectedDateText: null,
      orderNumber: null,
      priceText: null,
      trackingHref: null,
      trackingNumber: null,
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Замовлено")).toBeVisible());
    await expect(canvas.queryByText("Трекінг")).toBeNull();
  },
};

export const WithSeriesAndTracking: Story = {
  args: {
    model: makeDeliveryCardModel({
      seriesText: "Нічний цирк · том 1",
      title: "Нічний цирк",
    }),
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Нічний цирк · том 1")).toBeVisible());
    const trackingLink = canvas.getByRole("link", { name: /Відкрити трекінг/ });
    await expect(trackingLink).toHaveAttribute("target", "_blank");
    await expect(trackingLink).toHaveAttribute("rel", "noopener noreferrer");
  },
};

export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox", { name: /Вибрати/ });
    await waitFor(() => expect(checkbox).toBeChecked());
  },
};

export const ReceivePending: Story = {
  args: { receivePending: true },
  play: async ({ canvas }) => {
    const receive = canvas.getByRole("button", { name: "Позначити як отриману" });
    await waitFor(() => expect(receive).toBeDisabled());
  },
};
