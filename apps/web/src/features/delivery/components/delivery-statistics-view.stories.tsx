import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { statisticsViewFixture } from "./delivery-history.fixtures";
import { DeliveryStatisticsScreen } from "./delivery-statistics-view";
import { DeliverySummaryCards } from "./delivery-summary-cards";

const summaryNode = (
  <DeliverySummaryCards
    cards={[
      { icon: "wallet", label: "Загальна сума", value: "1 860 UAH · 70 EUR · 24 USD" },
      { icon: "truck", label: "Активні замовлення", value: "900 UAH" },
      { icon: "check-circle", label: "Отримані замовлення", value: "960 UAH · 70 EUR" },
      { icon: "x-circle", label: "Скасовані замовлення", value: "260 UAH" },
      { icon: "chart", label: "Середня ціна", value: "310 UAH · 35 EUR" },
      { icon: "package", label: "Замовлень з ціною", value: "6" },
    ]}
    isLoading={false}
  />
);

const meta = {
  args: {
    content: { kind: "loading" },
    controls: <div />,
    onResetFilters: () => {},
    onRetry: () => {},
    summary: summaryNode,
  },
  component: DeliveryStatisticsScreen,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryStatisticsScreen",
} satisfies Meta<typeof DeliveryStatisticsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Статистика витрат" })).toBeVisible(),
    );
  },
};

export const Ready: Story = {
  args: { content: { kind: "ready", view: statisticsViewFixture } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Витрати за місяцями")).toBeVisible());
    await expect(canvas.getByText("Найдорожчі замовлення")).toBeVisible();
    await expect(canvas.getByText("Витрати за магазинами")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { content: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText("Поки немає даних про витрати на доставки")).toBeVisible(),
    );
  },
};

export const NoPrice: Story = {
  args: { content: { kind: "no-price" } },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText("Додайте ціну до замовлень, щоб побачити статистику витрат."),
      ).toBeVisible(),
    );
  },
};
