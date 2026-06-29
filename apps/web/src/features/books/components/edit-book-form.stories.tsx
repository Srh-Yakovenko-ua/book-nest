import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { BookForm } from "./book-form";
import { EditBookForm } from "./edit-book-form";

type Handler = (path: string, init?: RequestInit) => Promise<Response> | Response;

function emptyPage(pageSize: number) {
  return jsonResponse(200, { items: [], page: 1, pagesCount: 0, pageSize, totalCount: 0 });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeBook(overrides: Partial<BookView> = {}): BookView {
  return {
    ageCategory: "16_plus",
    author: { id: "11111111-1111-4111-8111-111111111111", name: "Ліна Костенко" },
    bookType: "solo",
    createdAt: "2026-01-01T00:00:00.000Z",
    dedication: null,
    deliveryInfo: null,
    description: "Роман у віршах.",
    formats: ["paper"],
    genres: ["poetry", "historical_fiction"],
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    illustrator: null,
    isbn: null,
    isFavorite: true,
    isInReadingQueue: false,
    language: "ukrainian",
    lists: [],
    loanInfo: null,
    originalTitle: null,
    ownershipStatus: "owned",
    pagesCount: 304,
    partNumber: null,
    publicationYear: 1979,
    publisher: null,
    purchaseInfo: null,
    queuePriority: null,
    readingProgress: {
      abandonedAt: null,
      currentPage: null,
      finishedAt: "2026-02-10",
      impression: "Прекрасно",
      note: null,
      pausedAt: null,
      rating: 5,
      startedAt: null,
    },
    readingStatus: "finished",
    series: null,
    tags: [{ id: "tag-1", name: "класика" }],
    title: "Маруся Чурай",
    translator: null,
    updatedAt: "2026-02-01T00:00:00.000Z",
    userId: "user-1",
    ...overrides,
  };
}

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path, init));
  }) as typeof fetch;
}

const GENRES_FIXTURE = [
  { groupKey: "fiction", groupName: "Художня література", key: "poetry", name: "Поезія" },
  {
    groupKey: "fiction",
    groupName: "Художня література",
    key: "historical_fiction",
    name: "Історична проза",
  },
].map((genre, index) => ({ ...genre, id: `genre-${index}`, isDefault: true }));

function taxonomyHandler(extra?: Handler): Handler {
  return (path, init) => {
    if (path.includes("/api/publishers/recent")) return jsonResponse(200, []);
    if (path.includes("/api/books/purchase-stores")) return jsonResponse(200, []);
    if (path.includes("/api/genres") && (init?.method ?? "GET") === "GET") {
      return jsonResponse(200, GENRES_FIXTURE);
    }
    if (path.includes("/api/tags")) return emptyPage(20);
    if (path.includes("/api/series") && init?.method !== "POST") return emptyPage(8);
    if (path.includes("/api/lists") && init?.method !== "POST") return emptyPage(50);
    if (path.includes("/api/authors")) return emptyPage(8);
    return extra?.(path, init) ?? emptyPage(8);
  };
}

const meta = {
  component: EditBookForm,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/EditBookForm",
} satisfies Meta<typeof EditBookForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrefilledFromBookView: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-prefill00001" },
  beforeEach: () => {
    mockFetch(
      taxonomyHandler((path, init) => {
        if (
          path.includes("aaaaaaaa-aaaa-4aaa-8aaa-prefill00001") &&
          (init?.method ?? "GET") === "GET"
        ) {
          return jsonResponse(200, makeBook({ id: "aaaaaaaa-aaaa-4aaa-8aaa-prefill00001" }));
        }
        return emptyPage(8);
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByLabelText("Назва")).toHaveValue("Маруся Чурай");
    });
    await expect(canvas.getByLabelText("Автор")).toHaveValue("Ліна Костенко");
    await expect(canvas.getByRole("radio", { checked: true, name: "Прочитано" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Зберегти зміни/ })).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Додати до черги читання" })).toBeVisible();
  },
};

export const NotFoundState: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-notfound0001" },
  beforeEach: () => {
    mockFetch(
      taxonomyHandler((path) => {
        if (path.includes("aaaaaaaa-aaaa-4aaa-8aaa-notfound0001")) {
          return jsonResponse(404, { code: "not_found", message: "Book not found" });
        }
        return emptyPage(8);
      }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText("Книгу не знайдено")).toBeVisible();
    });
    await expect(canvas.getByRole("button", { name: "До бібліотеки" })).toBeVisible();
  },
};

export const ChangingReadingStatusFiresConfirm: Story = {
  args: { id: "aaaaaaaa-aaaa-4aaa-8aaa-confirm00001" },
  beforeEach: () => {
    mockFetch(
      taxonomyHandler((path, init) => {
        if (
          path.includes("aaaaaaaa-aaaa-4aaa-8aaa-confirm00001") &&
          (init?.method ?? "GET") === "GET"
        ) {
          return jsonResponse(200, makeBook({ id: "aaaaaaaa-aaaa-4aaa-8aaa-confirm00001" }));
        }
        return emptyPage(8);
      }),
    );
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await waitFor(
      async () => {
        await expect(canvas.getByLabelText("Назва")).toHaveValue("Маруся Чурай");
      },
      { timeout: 5000 },
    );
    await waitFor(async () => {
      await expect(canvas.getByRole("radio", { checked: true, name: "Прочитано" })).toBeVisible();
    });

    await userEvent.click(canvas.getByRole("radio", { name: "Читаю" }));

    const dialog = within(await surface.findByRole("alertdialog"));
    await expect(dialog.getByText("Змінити статус читання?")).toBeVisible();

    await userEvent.click(dialog.getByRole("button", { name: "Так, змінити" }));

    await waitFor(() => expect(surface.queryByRole("alertdialog")).toBeNull());
    await expect(canvas.getByRole("radio", { checked: true, name: "Читаю" })).toBeVisible();
    await expect(canvas.queryByLabelText("Враження")).toBeNull();
  },
};

export const EditSubmitSendsPatch: StoryObj<typeof BookForm> = {
  play: async ({ canvas }) => {
    let patchPayload: unknown = null;
    let patchUrl = "";
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books/") && init?.method === "PATCH") {
          patchUrl = path;
          patchPayload = JSON.parse(String(init.body));
          return jsonResponse(200, makeBook({ title: "Маруся Чурай (виправлено)" }));
        }
        return emptyPage(8);
      }),
    );

    const titleInput = canvas.getByLabelText("Назва");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Маруся Чурай (виправлено)");

    await userEvent.click(canvas.getByRole("button", { name: /Зберегти зміни/ }));

    await waitFor(() => expect(patchPayload).not.toBeNull());
    await expect(patchUrl).toContain("/api/books/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await expect(patchPayload).toMatchObject({
      author: { id: "11111111-1111-4111-8111-111111111111" },
      isFavorite: true,
      readingStatus: "finished",
      title: "Маруся Чурай (виправлено)",
    });
  },
  render: () => <BookForm book={makeBook()} mode="edit" />,
};

export const QueuePrefilledAndRemovalConfirms: StoryObj<typeof BookForm> = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    const queueSwitch = canvas.getByRole("switch", { name: "Додати до черги читання" });
    await waitFor(async () => {
      await expect(queueSwitch).toBeChecked();
    });
    await expect(canvas.getByRole("radio", { checked: true, name: "Високий" })).toBeVisible();

    await userEvent.click(queueSwitch);

    await waitFor(async () => {
      await expect(surface.getByText("Прибрати книгу з черги?")).toBeVisible();
    });
    await userEvent.click(await surface.findByRole("button", { name: "Так, змінити" }));

    await waitFor(() => expect(surface.queryByRole("alertdialog")).toBeNull());
    await expect(canvas.queryByRole("radio", { name: "Високий" })).toBeNull();
  },
  render: () => (
    <BookForm book={makeBook({ isInReadingQueue: true, queuePriority: "high" })} mode="edit" />
  ),
};

export const MarkAsReceivedSetsOwned: StoryObj<typeof BookForm> = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    await waitFor(async () => {
      await expect(canvas.getByRole("radio", { checked: true, name: "У дорозі" })).toBeVisible();
    });

    const receivedButton = canvas.getByRole("button", { name: "Позначити як отриману" });
    await expect(receivedButton).toBeVisible();

    await userEvent.click(receivedButton);

    await expect(canvas.getByRole("radio", { checked: true, name: "У наявності" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Позначити як отриману" })).toBeNull();
  },
  render: () => (
    <BookForm
      book={makeBook({
        deliveryInfo: {
          deliveryStatus: "in_transit",
          expectedDeliveryDate: null,
          note: null,
          orderDate: null,
          orderNumber: "100200300",
          storeName: "Yakaboo",
        },
        ownershipStatus: "in_transit",
      })}
      mode="edit"
    />
  ),
};

export const CancelWithDirtyFormConfirms: StoryObj<typeof BookForm> = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    const titleInput = canvas.getByLabelText("Назва");
    await userEvent.type(titleInput, " (чернетка)");

    await userEvent.click(canvas.getByRole("button", { name: "Скасувати" }));

    await waitFor(async () => {
      await expect(surface.getByText("Скасувати зміни?")).toBeVisible();
    });
  },
  render: () => <BookForm book={makeBook()} mode="edit" />,
};
