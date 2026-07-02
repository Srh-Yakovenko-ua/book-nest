import type { BookView, DeliveryView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { CancelDeliveryDialog } from "./cancel-delivery-dialog";

function activeDelivery(): DeliveryView {
  return {
    cancelledAt: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    currency: "UAH",
    deliveryService: null,
    expectedDeliveryDate: "2999-12-31",
    id: "dddddddd-dddd-4ddd-8ddd-delivery0010",
    note: null,
    orderDate: "2026-06-01",
    orderNumber: null,
    price: null,
    receivedAt: null,
    status: "ordered",
    storeName: "Книгарня «Є»",
    trackingNumber: null,
    trackingUrl: null,
  };
}

function cancelBook(): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-cancel000001",
    loanInfo: null,
    ownershipStatus: "in_transit",
    purchaseInfo: null,
  });
}

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <CancelDeliveryDialog
        book={cancelBook()}
        delivery={activeDelivery()}
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
  args: { book: cancelBook(), delivery: activeDelivery(), onOpenChange: () => {}, open: true },
  component: CancelDeliveryDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/CancelDeliveryDialog",
} satisfies Meta<typeof CancelDeliveryDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Скасувати доставку" })).toBeVisible(),
    );
    await expect(body.getByText("Залишити у списку «До покупки»")).toBeVisible();
    await expect(body.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await expect(body.getByRole("button", { name: "Скасувати доставку" })).toBeVisible();
  },
  render: () => <Harness />,
};

export const UncheckKeep: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("checkbox"));
    await waitFor(() =>
      expect(body.getByRole("checkbox")).toHaveAttribute("aria-checked", "false"),
    );
  },
  render: () => <Harness />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(409, { message: "Доставку вже завершено" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Скасувати доставку" }));
    await waitFor(() => expect(body.getByText("Доставку вже завершено")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, makeBookView({ ownershipStatus: "want_to_buy" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Скасувати доставку" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness />,
};
