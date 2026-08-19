import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { CancelDeliveryDialog } from "./cancel-delivery-dialog";

const CANCEL_TARGET = {
  bookId: "aaaaaaaa-aaaa-4aaa-8aaa-cancel000001",
  bookTitle: "Тінь вітру",
  deliveryId: "dddddddd-dddd-4ddd-8ddd-delivery0010",
};

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <CancelDeliveryDialog {...CANCEL_TARGET} onOpenChange={setOpen} open={open} />
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
  args: { ...CANCEL_TARGET, onOpenChange: () => {}, open: true },
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
      expect(body.getByRole("heading", { name: "Скасувати цю книгу?" })).toBeVisible(),
    );
    await expect(
      body.getByText(
        "«Тінь вітру» перейде в історію як скасована. Решта замовлення та інші книги в ньому не зміняться.",
      ),
    ).toBeVisible();
    await expect(body.getByText("Повернути книгу до списку бажань")).toBeVisible();
    await expect(body.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await expect(body.getByRole("checkbox")).toHaveAccessibleDescription(
      "Книга залишиться у списку бажань, щоб замовити її знову",
    );
    await expect(body.getByRole("button", { name: "Підтвердити" })).toBeVisible();
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
    await expect(body.getByRole("checkbox")).toHaveAccessibleDescription(
      "Книга не потрапить у список бажань",
    );
  },
  render: () => <Harness />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(409, { message: "Доставку вже завершено" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Підтвердити" }));
    await waitFor(() => expect(body.getByText("Доставку вже завершено")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, makeBookView({ ownershipStatus: "want_to_buy" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Підтвердити" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness />,
};

export const SubmitsCancelReason: Story = {
  play: async () => {
    let capturedBody: unknown = null;
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body === undefined ? null : JSON.parse(String(init.body));
      return Promise.resolve(jsonResponse(200, makeBookView({ ownershipStatus: "want_to_buy" })));
    }) as typeof fetch;

    const body = within(document.body);
    await userEvent.type(body.getByRole("textbox"), "Замовлення втрачено поштою");
    await userEvent.click(body.getByRole("button", { name: "Підтвердити" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
    await expect(capturedBody).toMatchObject({ cancelReason: "Замовлення втрачено поштою" });
  },
  render: () => <Harness />,
};
