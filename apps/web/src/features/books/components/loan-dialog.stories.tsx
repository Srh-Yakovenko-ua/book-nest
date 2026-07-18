import type { BookView, LoanDirection } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { LoanDialog } from "./loan-dialog";

function Harness({ book, direction }: { book: BookView; direction: LoanDirection }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <LoanDialog book={book} direction={direction} onOpenChange={setOpen} open={open} />
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

function loanBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-loan00000001",
    loanInfo: null,
    ownershipStatus: "none",
    purchaseInfo: null,
    ...overrides,
  });
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(status, body))) as typeof fetch;
}

const meta = {
  args: { book: loanBook(), direction: "borrowed", onOpenChange: () => {}, open: true },
  component: LoanDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/LoanDialog",
} satisfies Meta<typeof LoanDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Borrowed: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Позначити як позичену" })).toBeVisible(),
    );
    await expect(body.getByLabelText("У кого взяли")).toBeVisible();
    await expect(body.getByText("Дата позики")).toBeVisible();
  },
  render: () => <Harness book={loanBook()} direction="borrowed" />,
};

export const Lent: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Дати комусь почитати" })).toBeVisible(),
    );
    await expect(body.getByLabelText("Кому даєте")).toBeVisible();
    await expect(body.getByText("Дата передачі")).toBeVisible();
  },
  render: () => <Harness book={loanBook({ ownershipStatus: "owned" })} direction="lent" />,
};

export const RequiresPersonName: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Імʼя має містити щонайменше 2 символи.")).toBeVisible(),
    );
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={loanBook()} direction="borrowed" />,
};

export const ReminderNeedsDate: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("У кого взяли"), "Тест");
    await userEvent.click(body.getByRole("switch"));
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Оберіть дату повернення для нагадування.")).toBeVisible(),
    );
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={loanBook()} direction="borrowed" />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(
      200,
      loanBook({
        loanInfo: {
          contact: null,
          expectedReturnDate: null,
          loanDate: "2026-07-02",
          loanType: "borrowed_from_someone",
          loanUiStatus: "no_return_date",
          note: null,
          personName: "Тест",
          remindToReturn: false,
        },
        ownershipStatus: "borrowed_from_someone",
      }),
    );
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("У кого взяли"), "Тест");
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness book={loanBook()} direction="borrowed" />,
};
