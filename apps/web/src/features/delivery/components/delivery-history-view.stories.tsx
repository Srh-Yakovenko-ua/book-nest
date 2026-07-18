import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DELIVERY_HISTORY_TAB_DEFAULT } from "../model/history-params";
import { DeliveryHistoryCard } from "./delivery-history-card";
import { DeliveryHistoryView } from "./delivery-history-view";
import { historyCardModels } from "./delivery-history.fixtures";
import { DeliverySummaryCards } from "./delivery-summary-cards";

const summaryNode = (
  <DeliverySummaryCards
    cards={[
      { icon: "package", label: "Усього замовлень", value: "12" },
      { icon: "truck", label: "Активні", value: "3" },
      { icon: "check-circle", label: "Отримані", value: "8" },
      { icon: "x-circle", label: "Скасовані", value: "1" },
      { icon: "wallet", label: "Загальна сума", value: "2 400 UAH · 70 EUR" },
    ]}
    isLoading={false}
  />
);

const meta = {
  args: {
    content: { kind: "loading" },
    onGoToInTransit: () => {},
    onLoadMore: () => {},
    onResetFilters: () => {},
    onRetry: () => {},
    pagination: { hasNextPage: false, isFetchingNextPage: false },
    renderCard: (model) => (
      <DeliveryHistoryCard
        key={model.id}
        model={model}
        onCancel={() => {}}
        onEdit={() => {}}
        onReceive={() => {}}
        receivePending={false}
      />
    ),
    showToolbar: false,
    summary: summaryNode,
    tab: DELIVERY_HISTORY_TAB_DEFAULT,
    toolbar: null,
  },
  component: DeliveryHistoryView,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryHistoryView",
} satisfies Meta<typeof DeliveryHistoryView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Історія замовлень" })).toBeVisible(),
    );
  },
};

export const ErrorState: Story = {
  args: { content: { kind: "error" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити дані")).toBeVisible());
  },
};

export const Empty: Story = {
  args: { content: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Історія замовлень порожня")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Перейти до книг у дорозі" })).toBeVisible();
  },
};

export const FilteredEmpty: Story = {
  args: { content: { kind: "filtered-empty" }, showToolbar: true, toolbar: <div /> },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText("Немає замовлень за вибраними фільтрами")).toBeVisible(),
    );
  },
};

export const Ready: Story = {
  args: {
    content: { items: historyCardModels, kind: "ready" },
    showToolbar: true,
    toolbar: <div />,
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Нічний цирк")).toBeVisible());
    await expect(canvas.getByText("Книгу видалено")).toBeVisible();
    await expect(canvas.getByText("Причина скасування")).toBeVisible();
  },
};
