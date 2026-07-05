import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { MarkBoughtDialog } from "./mark-bought-dialog";

function boughtBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-bought000001",
    loanInfo: null,
    ownershipStatus: "want_to_buy",
    purchaseInfo: {
      currency: "UAH",
      expectedPrice: 450,
      note: null,
      purchasedAt: null,
      storeName: "Yakaboo",
      storeUrl: null,
    },
    ...overrides,
  });
}

function Harness({ book }: { book: BookView }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <MarkBoughtDialog book={book} onOpenChange={setOpen} open={open} />
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
  args: { book: boughtBook(), onOpenChange: () => {}, open: true },
  component: MarkBoughtDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/MarkBoughtDialog",
} satisfies Meta<typeof MarkBoughtDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithPlanStore: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Позначити книгу як куплену?" })).toBeVisible(),
    );
    await expect(
      body.getByText("Вкажіть, де ви придбали книгу — це може відрізнятися від запланованого"),
    ).toBeVisible();
    await expect(body.getByText("Yakaboo — 450 UAH")).toBeVisible();
    await expect(body.getByRole("radio", { name: "Yakaboo — 450 UAH" })).toBeChecked();
    await expect(body.queryByLabelText("Магазин")).toBeNull();

    await userEvent.click(body.getByRole("radio", { name: "Інше місце" }));
    await expect(body.getByLabelText("Магазин")).toBeVisible();
    await expect(body.getByLabelText("Очікувана ціна")).toBeVisible();
    await expect(body.getByLabelText("Валюта")).toHaveTextContent("UAH");
  },
  render: () => <Harness book={boughtBook()} />,
};

export const WithoutPlanStore: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Позначити книгу як куплену?" })).toBeVisible(),
    );
    await expect(body.queryByRole("radio")).toBeNull();
    await expect(body.getByLabelText("Магазин")).toBeVisible();
    await expect(body.getByLabelText("Очікувана ціна")).toBeVisible();
    await expect(body.getByText("Дата покупки")).toBeVisible();
  },
  render: () => <Harness book={boughtBook({ purchaseInfo: null })} />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, boughtBook({ ownershipStatus: "owned" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Підтвердити" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness book={boughtBook()} />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(409, { message: "Книга вже у вашій колекції" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Підтвердити" }));
    await waitFor(() => expect(body.getByText("Книга вже у вашій колекції")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={boughtBook()} />,
};
