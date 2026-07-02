import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { UpdateReadingProgressDialog } from "./update-reading-progress-dialog";

function Harness({ book }: { book: BookView }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <UpdateReadingProgressDialog book={book} onOpenChange={setOpen} open={open} />
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

function readingBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-reading000001",
    pagesCount: 540,
    readingProgress: {
      abandonedAt: null,
      currentPage: 220,
      finishedAt: null,
      impression: null,
      lastProgressUpdateAt: "2026-01-25",
      note: null,
      pausedAt: null,
      rating: null,
      startedAt: "2026-01-20",
    },
    readingStatus: "reading",
    ...overrides,
  });
}

const meta = {
  args: { book: readingBook(), onOpenChange: () => {}, open: true },
  component: UpdateReadingProgressDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/UpdateReadingProgressDialog",
} satisfies Meta<typeof UpdateReadingProgressDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Оновити прогрес" })).toBeVisible(),
    );
    await expect(body.getByRole("spinbutton", { name: "Сторінка зараз" })).toHaveValue("220");
    await expect(body.getByText("Позначити як прочитану")).toBeVisible();
  },
  render: () => <Harness book={readingBook()} />,
};

export const HelperOnIncrease: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("button", { name: "Збільшити" })).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Збільшити" }));
    await waitFor(() => expect(body.getByText(/з минулого разу/)).toBeVisible());
  },
  render: () => <Harness book={readingBook()} />,
};

export const MarkAsFinishedLocksPage: Story = {
  play: async () => {
    const body = within(document.body);
    const checkbox = await body.findByLabelText("Позначити як прочитану");
    await userEvent.click(checkbox);
    const page = body.getByRole("spinbutton", { name: "Сторінка зараз" });
    await waitFor(() => expect(page).toHaveValue("540"));
    await expect(page).toBeDisabled();
  },
  render: () => <Harness book={readingBook()} />,
};

export const BelowSavedShowsClientError: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зменшити" }));
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Не можна зменшити прогрес нижче 220 стор.")).toBeVisible(),
    );
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={readingBook()} />,
};

export const ServerErrorKeepsOpen: Story = {
  play: async () => {
    mockFetch(422, { message: "Сторінка більша за обсяг книги" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByText("Сторінка більша за обсяг книги")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
  render: () => <Harness book={readingBook()} />,
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(
      200,
      readingBook({
        readingProgress: {
          abandonedAt: null,
          currentPage: 260,
          finishedAt: null,
          impression: null,
          lastProgressUpdateAt: "2026-02-01",
          note: null,
          pausedAt: null,
          rating: null,
          startedAt: "2026-01-20",
        },
      }),
    );
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness book={readingBook()} />,
};
