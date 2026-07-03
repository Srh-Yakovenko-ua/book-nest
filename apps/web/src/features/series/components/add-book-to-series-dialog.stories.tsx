import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { makeBookView } from "../../books/components/book-details.fixtures";
import { AddBookToSeriesDialog } from "./add-book-to-series-dialog";

type Mode = "empty" | "results" | "taken";

const soloBooks = [
  makeBookView({ id: "book-1", series: null, title: "Тінь вітру" }),
  makeBookView({
    authors: [{ id: "a2", name: "Террі Пратчетт" }],
    id: "book-2",
    readingStatus: "reading",
    series: null,
    title: "Колір магії",
  }),
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(mode: Mode) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (method === "PATCH" && path.includes("/api/books/")) {
      if (mode === "taken") {
        return Promise.resolve(
          jsonResponse(400, {
            errorsMessages: [
              {
                code: "book_series_part_number_taken",
                field: "partNumber",
                message: "taken",
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse(200, makeBookView({ id: "book-1" })));
    }
    if (path.includes("/api/books")) {
      return Promise.resolve(jsonResponse(200, paginated(mode === "empty" ? [] : soloBooks)));
    }
    return Promise.resolve(jsonResponse(200, {}));
  }) as typeof fetch;
}

function paginated(items: BookView[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length };
}

const meta = {
  args: { defaultPartNumber: 4, onOpenChange: fn(), open: true, seriesId: "series-1" },
  component: AddBookToSeriesDialog,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/AddBookToSeriesDialog",
} satisfies Meta<typeof AddBookToSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Results: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    mockFetch("results");
  },
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByText("Тінь вітру")).toBeVisible());
    await expect(body.getByText("Колір магії")).toBeVisible();
    await expect(body.getByRole("spinbutton", { name: "Номер частини" })).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    mockFetch("empty");
  },
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByText("Немає книг для додавання")).toBeVisible());
    await expect(body.getByRole("link", { name: "Створити нову книгу" })).toBeVisible();
  },
};

export const PartNumberTakenShowsInlineError: Story = {
  beforeEach: () => {
    getQueryClient().clear();
    mockFetch("taken");
  },
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByText("Тінь вітру")).toBeVisible());
    await userEvent.click(body.getByText("Тінь вітру"));
    await userEvent.click(body.getByRole("button", { name: "Додати книгу" }));
    await waitFor(() =>
      expect(body.getByText("У цій серії вже є книга з таким номером частини")).toBeVisible(),
    );
  },
};
