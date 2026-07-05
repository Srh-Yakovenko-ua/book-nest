import type { BookView, ReadingStatus } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";

function Harness({ book, defaultStatus }: { book: BookView; defaultStatus?: ReadingStatus }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <ChangeReadingStatusDialog
        book={book}
        defaultStatus={defaultStatus}
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

function readingBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-status0000001",
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
  component: ChangeReadingStatusDialog,
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/ChangeReadingStatusDialog",
} satisfies Meta<typeof ChangeReadingStatusDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DisabledWhenUnchanged: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Змінити статус читання" })).toBeVisible(),
    );
    await expect(body.getByRole("radio", { name: "Читаю" })).toBeChecked();
    await expect(body.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  },
  render: () => <Harness book={readingBook()} />,
};

export const SelectPausedRevealsNote: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("radio", { name: "Призупинено" }));
    await waitFor(() => expect(body.getByRole("textbox", { name: "Нотатка" })).toBeVisible());
    await expect(body.getByRole("button", { name: "Зберегти" })).toBeEnabled();
  },
  render: () => <Harness book={readingBook()} />,
};

export const NotStartedRevealsReset: Story = {
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole("radio", { name: "Не почато" }));
    await waitFor(() =>
      expect(body.getByText("Книга повернеться до стану «Не почато».")).toBeVisible(),
    );
    await expect(body.getByLabelText("Скинути прогрес читання")).toBeVisible();
  },
  render: () => <Harness book={readingBook()} />,
};

export const PreselectFromStartCta: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("radio", { name: "Читаю" })).toBeChecked());
    await expect(body.getByRole("button", { name: "Зберегти" })).toBeEnabled();
  },
  render: () => (
    <Harness
      book={readingBook({ readingProgress: null, readingStatus: "not_started" })}
      defaultStatus="reading"
    />
  ),
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, readingBook({ readingStatus: "paused" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("radio", { name: "Призупинено" }));
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
  render: () => <Harness book={readingBook()} />,
};
