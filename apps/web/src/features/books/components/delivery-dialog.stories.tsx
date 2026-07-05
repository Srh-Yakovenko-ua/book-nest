import type { BookView, DeliveryView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { DeliveryDialog } from "./delivery-dialog";

function activeDelivery(): DeliveryView {
  return {
    cancelledAt: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    currency: "UAH",
    deliveryService: "Нова пошта",
    expectedDeliveryDate: "2999-12-31",
    id: "dddddddd-dddd-4ddd-8ddd-delivery0009",
    note: "Зателефонувати перед доставкою",
    orderDate: "2026-06-01",
    orderNumber: "100500",
    price: 420,
    receivedAt: null,
    status: "in_transit",
    storeName: "Книгарня «Є»",
    trackingNumber: "20450000000000",
    trackingUrl: "https://novaposhta.ua/tracking/20450000000000",
  };
}

function CreateHarness({ book }: { book: BookView }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <DeliveryDialog book={book} mode="create" onOpenChange={setOpen} open={open} />
      <p data-testid="open-state">{open ? "open" : "closed"}</p>
    </>
  );
}

function dialogBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-delivdlg0001",
    loanInfo: null,
    ownershipStatus: "none",
    purchaseInfo: null,
    ...overrides,
  });
}

function EditHarness({ book, delivery }: { book: BookView; delivery: DeliveryView }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <DeliveryDialog
        book={book}
        delivery={delivery}
        mode="edit"
        onOpenChange={setOpen}
        open={open}
      />
      <p data-testid="open-state">{open ? "open" : "closed"}</p>
    </>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(status, body))) as typeof fetch;
}

const meta = {
  args: { book: dialogBook(), mode: "create", onOpenChange: () => {}, open: true },
  component: DeliveryDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/DeliveryDialog",
} satisfies Meta<typeof DeliveryDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("heading", { name: "Нова доставка" })).toBeVisible());
    await expect(body.getByLabelText("Магазин")).toBeVisible();
    await expect(body.getByLabelText("Дата замовлення")).toBeVisible();
  },
  render: () => <CreateHarness book={dialogBook()} />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(409, { message: "У книги вже є активна доставка" });
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Магазин"), "Yakaboo");
    await userEvent.click(body.getByRole("button", { name: "Замовити" }));
    await waitFor(() => expect(body.getByText("У книги вже є активна доставка")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <CreateHarness book={dialogBook()} />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, dialogBook({ ownershipStatus: "in_transit" }));
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Магазин"), "Книгарня «Є»");
    await userEvent.click(body.getByRole("button", { name: "Замовити" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <CreateHarness book={dialogBook()} />,
};

export const EditPrefilled: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Редагувати доставку" })).toBeVisible(),
    );
    await expect(body.getByLabelText("Магазин")).toHaveValue("Книгарня «Є»");
    await expect(body.getByText("Статус доставки")).toBeVisible();
    await expect(body.getByRole("button", { name: "Зберегти" })).toBeVisible();
  },
  render: () => (
    <EditHarness book={dialogBook({ ownershipStatus: "in_transit" })} delivery={activeDelivery()} />
  ),
};
