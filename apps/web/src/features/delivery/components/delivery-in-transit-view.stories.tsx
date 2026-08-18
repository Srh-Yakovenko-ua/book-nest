import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { DeliveryInTransitView } from "./delivery-in-transit-view";
import { DeliveryOrderCard } from "./delivery-order-card";
import { DeliverySummaryCards } from "./delivery-summary-cards";
import { deliveryOrderCardModels } from "./delivery.fixtures";

const summaryNode = (
  <DeliverySummaryCards
    cards={[
      { icon: "truck", label: "Усього в дорозі", value: "5" },
      { icon: "clock", label: "Очікуються цього тижня", value: "2" },
      { icon: "alert-triangle", label: "Затримуються", value: "1" },
      { icon: "wallet", label: "Загальна сума", value: "1 555 UAH" },
      { icon: "store", label: "Магазини", value: "3" },
    ]}
    isLoading={false}
  />
);

const meta = {
  args: {
    content: { kind: "loading" },
    onGoToBooksToBuy: () => {},
    onLoadMore: () => {},
    onResetFilters: () => {},
    onRetry: () => {},
    pagination: { hasNextPage: false, isFetchingNextPage: false },
    renderCard: (model) => (
      <DeliveryOrderCard
        key={model.id}
        model={model}
        onCancelBook={() => {}}
        onChangeShipmentStatus={() => {}}
        onEditBook={() => {}}
        onManage={() => {}}
        onReceiveShipment={() => {}}
        onToggleSelectBook={() => {}}
        preparingEdit={false}
        selectedBookIds={new Set()}
        selectionMode={false}
      />
    ),
    showToolbar: false,
    summary: summaryNode,
    toolbar: null,
  },
  component: DeliveryInTransitView,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Delivery/DeliveryInTransitView",
} satisfies Meta<typeof DeliveryInTransitView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Книги в дорозі" })).toBeVisible(),
    );
  },
};

export const ErrorState: Story = {
  args: { content: { kind: "error" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити дані")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Спробувати ще раз" })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { content: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Відстежуй книжкові замовлення")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Перейти до списку бажань" })).toBeVisible();
  },
};

export const FilteredEmpty: Story = {
  args: { content: { kind: "filtered-empty" }, showToolbar: true, toolbar: <div /> },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Нічого не знайдено")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Скинути фільтри" })).toBeVisible();
  },
};

export const Ready: Story = {
  args: {
    content: { items: deliveryOrderCardModels, kind: "ready" },
    selectAll: { checked: false, count: 0, onToggle: () => {} },
    showToolbar: true,
    toolbar: <div />,
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Таємна історія")).toBeVisible());
    await expect(canvas.getByText("Американські боги")).toBeVisible();
    await expect(canvas.getByText("Ще не відправлено")).toBeVisible();
    await expect(canvas.getByText(/Вибрати всі видимі/)).toBeVisible();
  },
};
