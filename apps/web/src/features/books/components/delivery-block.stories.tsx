import type { BookView, DeliveryView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { DeliveryBlock } from "./delivery-block";

function deliveryBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-deliv0000001",
    loanInfo: null,
    ownershipStatus: "in_transit",
    purchaseInfo: null,
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeDelivery(overrides: Partial<DeliveryView> = {}): DeliveryView {
  return {
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    currency: "UAH",
    deliveryService: "Нова пошта",
    expectedDeliveryDate: "2999-12-31",
    id: "dddddddd-dddd-4ddd-8ddd-delivery0001",
    note: null,
    orderDate: "2026-06-01",
    orderNumber: "100500",
    price: 420,
    receivedAt: null,
    status: "ordered",
    storeName: "Книгарня «Є»",
    trackingNumber: "20450000000000",
    trackingUrl: "https://novaposhta.ua/tracking/20450000000000",
    ...overrides,
  };
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(status, body))) as typeof fetch;
}

const meta = {
  component: DeliveryBlock,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-80 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/DeliveryBlock",
} satisfies Meta<typeof DeliveryBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ActiveOrdered: Story = {
  args: {
    book: deliveryBook({
      delivery: { active: makeDelivery(), latest: makeDelivery(), totalCount: 1 },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Доставка")).toBeVisible();
    await expect(canvas.getByText("Замовлена")).toBeVisible();
    await expect(canvas.getByText("Книгарня «Є»")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Отримана" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Редагувати" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Скасувати" })).toBeVisible();
  },
};

export const ActiveDelayed: Story = {
  args: {
    book: deliveryBook({
      delivery: {
        active: makeDelivery({
          expectedDeliveryDate: "2020-01-01",
          orderDate: "2019-12-20",
          status: "in_transit",
        }),
        latest: makeDelivery(),
        totalCount: 1,
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("В дорозі")).toBeVisible();
    await expect(canvas.getByText("Затримується")).toBeVisible();
  },
};

export const ActiveNoDate: Story = {
  args: {
    book: deliveryBook({
      delivery: {
        active: makeDelivery({ expectedDeliveryDate: null, status: "ready_for_pickup" }),
        latest: makeDelivery(),
        totalCount: 1,
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Готова до отримання")).toBeVisible();
    await expect(canvas.getByText("Дата доставки не вказана")).toBeVisible();
  },
};

export const HistoryReceived: Story = {
  args: {
    book: deliveryBook({
      delivery: {
        active: null,
        latest: makeDelivery({
          receivedAt: "2026-06-10",
          status: "received",
        }),
        totalCount: 1,
      },
      id: "aaaaaaaa-aaaa-4aaa-8aaa-deliv0000002",
      ownershipStatus: "owned",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Отримана")).toBeVisible();
    await expect(canvas.getByText("Замовлень в історії: 1")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Показати історію" })).toBeVisible();
  },
};

export const HistoryCancelledAndExpand: Story = {
  args: {
    book: deliveryBook({
      delivery: {
        active: null,
        latest: makeDelivery({
          cancelledAt: "2026-06-12",
          status: "cancelled",
        }),
        totalCount: 2,
      },
      id: "aaaaaaaa-aaaa-4aaa-8aaa-deliv0000003",
      ownershipStatus: "want_to_buy",
    }),
  },
  play: async ({ canvas }) => {
    mockFetch(200, [
      makeDelivery({
        cancelledAt: "2026-06-12",
        id: "dddddddd-dddd-4ddd-8ddd-delivery0002",
        status: "cancelled",
        storeName: "Yakaboo",
      }),
      makeDelivery({
        id: "dddddddd-dddd-4ddd-8ddd-delivery0003",
        receivedAt: "2026-05-20",
        status: "received",
        storeName: "Книгарня «Є»",
      }),
    ]);
    await expect(canvas.getByText("Скасована")).toBeVisible();
    await expect(canvas.getByText("Замовлень в історії: 2")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Показати історію" }));
    await waitFor(() => expect(canvas.getByText("Yakaboo")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Сховати історію" })).toBeVisible();
  },
};

export const Repair: Story = {
  args: {
    book: deliveryBook({
      delivery: { active: null, latest: null, totalCount: 0 },
      id: "aaaaaaaa-aaaa-4aaa-8aaa-deliv0000004",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/запис про доставку відсутній/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Додати інформацію про доставку" }));
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("heading", { name: "Нова доставка" })).toBeVisible());
  },
};

export const HiddenWhenEmpty: Story = {
  args: {
    book: deliveryBook({
      delivery: { active: null, latest: null, totalCount: 0 },
      id: "aaaaaaaa-aaaa-4aaa-8aaa-deliv0000005",
      ownershipStatus: "owned",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Доставка")).toBeNull();
  },
};
