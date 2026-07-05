import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { ReadingProgressBlock } from "./reading-progress-block";

function readingBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-block00000001",
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
  component: ReadingProgressBlock,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-80 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/ReadingProgressBlock",
} satisfies Meta<typeof ReadingProgressBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reading: Story = {
  args: { book: readingBook() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прогрес читання")).toBeVisible();
    await expect(canvas.getByText("220 з 540 стор. · 41%")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Оновити прогрес" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Змінити статус" })).toBeVisible();
  },
};

export const NotStarted: Story = {
  args: { book: readingBook({ readingProgress: null, readingStatus: "not_started" }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Ви ще не почали читати цю книгу.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Почати читати" })).toBeVisible();
  },
};

export const Finished: Story = {
  args: { book: makeBookView() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("336 з 336 стор. · 100%")).toBeVisible();
    await expect(canvas.getByText("9/10")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Оновити прогрес" })).toBeNull();
  },
};

export const DidNotFinish: Story = {
  args: {
    book: readingBook({
      pagesCount: 336,
      readingProgress: {
        abandonedAt: "2026-03-01",
        currentPage: 120,
        finishedAt: null,
        impression: null,
        lastProgressUpdateAt: null,
        note: "Занадто повільний сюжет",
        pausedAt: null,
        rating: null,
        startedAt: "2026-01-20",
      },
      readingStatus: "dnf",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Причина")).toBeVisible();
    await expect(canvas.getByText("Занадто повільний сюжет")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Змінити статус" })).toBeVisible();
  },
};

export const OpensUpdateDialog: Story = {
  args: { book: readingBook() },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Оновити прогрес" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Оновити прогрес" })).toBeVisible(),
    );
  },
};
