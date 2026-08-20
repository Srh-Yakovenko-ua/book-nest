import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DELIVERY_HISTORY_TAB_DEFAULT } from "../model/history-params";
import { DeliveryHistoryCard } from "./delivery-history-card";
import { DeliveryHistoryReceivedBlocks, DeliveryHistorySidebar } from "./delivery-history-sidebar";
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

const sidebarNode = (
  <DeliveryHistorySidebar tab={DELIVERY_HISTORY_TAB_DEFAULT}>
    <DeliveryHistoryReceivedBlocks
      isOutcomeLoading={false}
      isReceiptLoading={false}
      latestReceipt={{
        books: {
          countText: "4 книги",
          covers: [
            { authorName: "Ерін Моргенштерн", bookHref: "/books/a", id: "a", title: "Нічний цирк" },
            { authorName: "Донна Тартт", bookHref: "/books/b", id: "b", title: "Щиголь" },
            { authorName: "Мадлен Міллер", bookHref: "/books/c", id: "c", title: "Цирцея" },
          ],
          kind: "stack",
        },
        orderId: "order-1",
        receivedDateText: "18 серп. 2026 р.",
        relativeDayText: "Вчора",
        sameDayText: "Ще 2 отримання цього дня",
        serviceName: "Нова Пошта",
        shipmentId: "shipment-1",
        storeName: "Yakaboo",
      }}
      onRevealLatestReceipt={() => {}}
      outcome={{
        seriesInsights: [
          { booksCount: 3, kind: "series_completed", seriesCount: 2 },
          { booksCount: 4, kind: "series_gaps_closed", seriesCount: 3 },
          { booksCount: 6, kind: "series_topped_up", seriesCount: 5 },
        ],
        unreadReceived: {
          bookPreviews: [
            { authorName: "Ерін Моргенштерн", cover: null, id: "a", title: "Нічний цирк" },
            { authorName: "Донна Тартт", cover: null, id: "b", title: "Щиголь" },
            { authorName: "Мадлен Міллер", cover: null, id: "c", title: "Цирцея" },
          ],
          booksCount: 18,
          inQueueCount: 4,
        },
      }}
      revealResetsFilters={false}
    />
  </DeliveryHistorySidebar>
);

const meta = {
  args: {
    content: { kind: "loading" },
    onGoToInTransit: () => {},
    onLoadMore: () => {},
    onResetFilters: () => {},
    onRetry: () => {},
    pagination: { hasNextPage: false, isFetchingNextPage: false },
    renderCard: (model) => <DeliveryHistoryCard key={model.id} model={model} search="" />,
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

export const WithSidebar: Story = {
  args: {
    content: { items: historyCardModels, kind: "ready" },
    showToolbar: true,
    sidebar: sidebarNode,
    toolbar: <div />,
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Останнє отримання")).toBeVisible());
    await expect(canvas.getByText("Чекають на читання")).toBeVisible();
    await expect(canvas.getByText("Як поповнилися серії")).toBeVisible();
    await expect(canvas.getByText("2 серії стали повними")).toBeVisible();
  },
};
