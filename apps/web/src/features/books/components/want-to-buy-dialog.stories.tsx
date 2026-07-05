import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { WantToBuyDialog } from "./want-to-buy-dialog";

function buyBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-buy000000001",
    loanInfo: null,
    ownershipStatus: "none",
    purchaseInfo: null,
    ...overrides,
  });
}

function Harness({ book }: { book: BookView }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <WantToBuyDialog book={book} onOpenChange={setOpen} open={open} />
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
  args: { book: buyBook(), onOpenChange: () => {}, open: true },
  component: WantToBuyDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/WantToBuyDialog",
} satisfies Meta<typeof WantToBuyDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("heading", { name: "Хочу купити" })).toBeVisible());
    await expect(body.getByLabelText("Магазин")).toBeVisible();
    await expect(body.getByLabelText("Очікувана ціна")).toBeVisible();
  },
  render: () => <Harness book={buyBook()} />,
};

export const InvalidUrlShowsClientError: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Посилання на товар"), "not-a-url");
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByText("Введіть коректне https-посилання.")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={buyBook()} />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(409, { message: "Книга вже у вашій колекції" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByText("Книга вже у вашій колекції")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={buyBook()} />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(
      200,
      buyBook({
        ownershipStatus: "want_to_buy",
        purchaseInfo: {
          currency: "UAH",
          expectedPrice: 450,
          note: null,
          purchasedAt: null,
          storeName: "Yakaboo",
          storeUrl: null,
        },
      }),
    );
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Магазин"), "Yakaboo");
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness book={buyBook()} />,
};
