import type { BookView, LoanContactView, LoanDirection } from "@app/shared";
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

const CONTACT: LoanContactView = {
  archivedAt: null,
  contact: null,
  createdAt: "2026-01-10T10:00:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  loanCount: 2,
  name: "Ігор",
  updatedAt: "2026-01-10T10:00:00.000Z",
};

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

function mockApi(loanResponse: () => Response) {
  globalThis.fetch = ((input: RequestInfo | URL) =>
    Promise.resolve(
      String(input).includes("/api/loans/contacts")
        ? jsonResponse(200, { items: [CONTACT] })
        : loanResponse(),
    )) as typeof fetch;
}

async function pickContact(body: ReturnType<typeof within>, label: string) {
  await userEvent.click(body.getByLabelText(label));
  await userEvent.click(await body.findByText(CONTACT.name));
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
  render: () => {
    mockApi(() => jsonResponse(200, loanBook()));
    return <Harness book={loanBook()} direction="borrowed" />;
  },
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
  render: () => {
    mockApi(() => jsonResponse(200, loanBook({ ownershipStatus: "owned" })));
    return <Harness book={loanBook({ ownershipStatus: "owned" })} direction="lent" />;
  },
};

export const RequiresContact: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Оберіть людину зі списку або створіть нову.")).toBeVisible(),
    );
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => {
    mockApi(() => jsonResponse(200, loanBook()));
    return <Harness book={loanBook()} direction="borrowed" />;
  },
};

export const ReminderNeedsDate: Story = {
  play: async () => {
    const body = within(document.body);
    await pickContact(body, "У кого взяли");
    await userEvent.click(body.getByRole("switch"));
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Оберіть дату повернення для нагадування.")).toBeVisible(),
    );
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => {
    mockApi(() => jsonResponse(200, loanBook()));
    return <Harness book={loanBook()} direction="borrowed" />;
  },
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    const body = within(document.body);
    await pickContact(body, "У кого взяли");
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => {
    mockApi(() =>
      jsonResponse(
        200,
        loanBook({
          loanInfo: {
            contact: null,
            expectedReturnDate: null,
            loanContactId: CONTACT.id,
            loanDate: "2026-07-02",
            loanType: "borrowed_from_someone",
            loanUiStatus: "no_return_date",
            note: null,
            personName: CONTACT.name,
            remindBeforeDays: null,
            remindToReturn: false,
          },
          ownershipStatus: "borrowed_from_someone",
        }),
      ),
    );
    return <Harness book={loanBook()} direction="borrowed" />;
  },
};
