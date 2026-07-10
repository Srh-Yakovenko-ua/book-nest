import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { BookDetails } from "./book-details";
import { DETAILS_GENRES_FIXTURE, makeBookView } from "./book-details.fixtures";

type Handler = (path: string, init?: RequestInit) => Response;

function detailHandler(id: string, book: BookView | null): Handler {
  return (path, init) => {
    if (path.includes("/api/genres")) return jsonResponse(200, DETAILS_GENRES_FIXTURE);
    if (path.includes(id) && (init?.method ?? "GET") === "GET") {
      if (book === null) return jsonResponse(404, { code: "not_found", message: "Book not found" });
      return jsonResponse(200, book);
    }
    return jsonResponse(200, {});
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path, init));
  }) as typeof fetch;
}

const meta = {
  component: BookDetails,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/BookDetails",
} satisfies Meta<typeof BookDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SoloBook: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-solo00000001" },
  beforeEach: () => {
    mockFetch(
      detailHandler(
        "aaaaaaaa-aaaa-4aaa-8aaa-solo00000001",
        makeBookView({ id: "aaaaaaaa-aaaa-4aaa-8aaa-solo00000001" }),
      ),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole("heading", { name: "Останнє бажання" })).toBeVisible();
    });
    await expect(canvas.getByText("Про книгу")).toBeVisible();
    await expect(canvas.getByText("Коротка інформація")).toBeVisible();
    await expect(canvas.getByText("Статуси")).toBeVisible();
    await waitFor(async () => {
      await expect(canvas.getByText("Пригоди")).toBeVisible();
    });
    await expect(canvas.getByText("Сергій Легеза")).toBeVisible();
    await expect(canvas.getByText("9786176791393")).toBeVisible();
  },
};

export const SeriesBook: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-series0000001" },
  beforeEach: () => {
    mockFetch(
      detailHandler(
        "aaaaaaaa-aaaa-4aaa-8aaa-series0000001",
        makeBookView({
          bookType: "series_part",
          id: "aaaaaaaa-aaaa-4aaa-8aaa-series0000001",
          partNumber: 1,
          series: {
            authors: [{ id: "11111111-1111-4111-8111-111111111111", name: "Анджей Сапковський" }],
            booksInSeries: 8,
            createdAt: "2026-01-01T00:00:00.000Z",
            description: null,
            finishedInSeries: 2,
            genres: [],
            id: "series-1",
            lastActivityAt: "2026-01-05T00:00:00.000Z",
            name: "Відьмак",
            nextBook: null,
            readingInSeries: 0,
            status: "ongoing",
            totalBooks: 8,
          },
        }),
      ),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Відьмак · частина 1")).toBeVisible();
    });
  },
};

export const EmptyOptionalBlocks: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-empty00000001" },
  beforeEach: () => {
    mockFetch(
      detailHandler(
        "aaaaaaaa-aaaa-4aaa-8aaa-empty00000001",
        makeBookView({
          ageCategory: "not_specified",
          cover: null,
          dedication: null,
          description: null,
          formats: [],
          genres: [],
          id: "aaaaaaaa-aaaa-4aaa-8aaa-empty00000001",
          illustrator: null,
          isbn: null,
          pagesCount: null,
          publicationYear: null,
          publisher: null,
          readingProgress: null,
          tags: [],
          translator: null,
        }),
      ),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Опис ще не додано.")).toBeVisible();
    });
    await expect(canvas.getByText("Деталі видання ще не додані.")).toBeVisible();
  },
};

export const NotFound: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-missing000001" },
  beforeEach: () => {
    mockFetch(detailHandler("aaaaaaaa-aaaa-4aaa-8aaa-missing000001", null));
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Книгу не знайдено")).toBeVisible();
    });
    await expect(canvas.getByRole("button", { name: "До бібліотеки" })).toBeVisible();
  },
};
