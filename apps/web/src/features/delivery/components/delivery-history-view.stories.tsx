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
      {
        icon: "check-circle",
        iconTone: "success",
        label: "Отримано",
        microfact: "У 12 замовленнях · 14 посилках",
        unit: "книг",
        value: "25",
      },
      {
        icon: "x-circle",
        iconTone: "ink",
        label: "Скасовано",
        microfact: "У 5 замовленнях",
        unit: "книг",
        value: "7",
      },
      {
        icon: "package-check",
        label: "Завершені замовлення",
        microfact: "15 без скасувань · 3 із скасуваннями",
        unit: "замовлень",
        value: "18",
      },
      {
        icon: "library-big",
        iconTone: "genre",
        label: "Поповнено серій",
        microfact: "18 книг із серій · 7 окремих",
        unit: "серій",
        value: "12",
      },
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
    renderCard: (model) => <DeliveryHistoryCard key={model.id} model={model} />,
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

export const EmptyReceived: Story = {
  args: { content: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Отриманих замовлень ще немає")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Перейти до книг у дорозі" })).toBeVisible();
  },
};

export const EmptyCancelled: Story = {
  args: { content: { kind: "empty" }, tab: "cancelled" },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Скасованих замовлень немає")).toBeVisible());
    await expect(
      canvas.queryByRole("button", { name: "Перейти до книг у дорозі" }),
    ).not.toBeInTheDocument();
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
    await expect(
      canvas.queryByRole("button", { name: "Позначити як отриману" }),
    ).not.toBeInTheDocument();
  },
};
