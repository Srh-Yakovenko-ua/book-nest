import "@testing-library/jest-dom/vitest";

import type { BulkPagesCountResult, ReadingQueueItemView } from "@app/shared";

import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { QueueVolumeDataDialog } from "./queue-volume-data-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = messages.readingQueue.volumeModal;

const BOOK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const BOOK_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const BOOK_C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const [BELOW_CURRENT_PAGE_PREFIX = ""] = copy.errors.belowCurrentPage.split("{count");
const SAVED_PARTIAL_TAIL = copy.savedPartial.split("}. ").at(-1) ?? "";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function missingPagesItem(
  position: number,
  id: string,
  title: string,
  formats: ReadingQueueItemView["book"]["formats"] = ["paper"],
): ReadingQueueItemView {
  return {
    book: makeBookView({
      formats,
      id,
      isInReadingQueue: true,
      pagesCount: null,
      readingProgress: null,
      readingStatus: "want_to_read",
      title,
    }),
    position,
  };
}

function mockBulkFetch(respond: (body: unknown) => Promise<Response>) {
  const calls: unknown[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("/api/books/bulk/pages-count")) {
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push(body);
    return respond(body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function pagesInputFor(title: string): HTMLElement {
  return within(rowOf(title)).getByLabelText(copy.pagesLabel);
}

function progressAt(currentPage: number) {
  return {
    abandonedAt: null,
    currentPage,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
  };
}

function renderDialog(items: ReadingQueueItemView[], onOpenChange = vi.fn()): void {
  renderWithProviders(<QueueVolumeDataDialog items={items} onOpenChange={onOpenChange} open />);
}

function rowOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest("li");
  if (row === null) throw new Error(`row not found: ${title}`);
  return row;
}

function successResult(result: Partial<BulkPagesCountResult> = {}): BulkPagesCountResult {
  return { failed: [], updated: [], ...result };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QueueVolumeDataDialog", () => {
  it("blocks the submit when a page count is lower than the saved progress", async () => {
    const { fetchMock } = mockBulkFetch(() => Promise.resolve(jsonResponse(successResult())));
    const user = userEvent.setup();

    renderDialog([
      {
        book: makeBookView({
          formats: ["paper"],
          id: BOOK_A,
          isInReadingQueue: true,
          pagesCount: 200,
          readingProgress: progressAt(300),
          readingStatus: "reading",
          title: "Неузгоджений прогрес",
        }),
        position: 1,
      },
    ]);

    await user.type(pagesInputFor("Неузгоджений прогрес"), "250");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/300 сторінок/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the rows that were filled in", async () => {
    const { calls } = mockBulkFetch(() =>
      Promise.resolve(jsonResponse(successResult({ updated: [BOOK_A] }))),
    );
    const user = userEvent.setup();

    renderDialog([
      missingPagesItem(1, BOOK_A, "Перша без сторінок"),
      missingPagesItem(2, BOOK_B, "Друга без сторінок"),
    ]);

    await user.type(pagesInputFor("Перша без сторінок"), "320");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      items: [
        {
          bookId: BOOK_A,
          expectedUpdatedAt: "2026-02-01T00:00:00.000Z",
          kind: "pages_count",
          pagesCount: 320,
        },
      ],
    });
  });

  it("keeps failed rows with their reason and drops the saved ones", async () => {
    mockBulkFetch(() =>
      Promise.resolve(
        jsonResponse(
          successResult({
            failed: [
              { bookId: BOOK_B, reason: "stale" },
              { bookId: BOOK_C, reason: "below_current_page" },
            ],
            updated: [BOOK_A],
          }),
        ),
      ),
    );
    const user = userEvent.setup();

    renderDialog([
      missingPagesItem(1, BOOK_A, "Збережеться"),
      missingPagesItem(2, BOOK_B, "Застаріла"),
      {
        book: makeBookView({
          formats: ["paper"],
          id: BOOK_C,
          isInReadingQueue: true,
          pagesCount: null,
          readingProgress: progressAt(400),
          readingStatus: "reading",
          title: "Замало сторінок",
        }),
        position: 3,
      },
    ]);

    await user.type(pagesInputFor("Збережеться"), "100");
    await user.type(pagesInputFor("Застаріла"), "200");
    await user.type(pagesInputFor("Замало сторінок"), "500");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    await vi.waitFor(() => expect(screen.queryByText("Збережеться")).not.toBeInTheDocument());
    expect(screen.getByText(copy.failure.stale)).toBeInTheDocument();
    expect(rowOf("Замало сторінок")).toHaveTextContent(BELOW_CURRENT_PAGE_PREFIX);
    expect(pagesInputFor("Замало сторінок")).toHaveValue(500);
  });

  it("stays open and toasts when only some rows were saved", async () => {
    mockBulkFetch(() => Promise.resolve(jsonResponse(successResult({ updated: [BOOK_A] }))));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderDialog(
      [missingPagesItem(1, BOOK_A, "Заповнена"), missingPagesItem(2, BOOK_B, "Незаповнена")],
      onOpenChange,
    );

    await user.type(pagesInputFor("Заповнена"), "320");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    await vi.waitFor(() => expect(screen.queryByText("Заповнена")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(SAVED_PARTIAL_TAIL));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(rowOf("Незаповнена")).toBeInTheDocument();
  });

  it("closes and reports success when every row was saved", async () => {
    mockBulkFetch(() => Promise.resolve(jsonResponse(successResult({ updated: [BOOK_A] }))));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog([missingPagesItem(1, BOOK_A, "Єдина")], onOpenChange);

    await user.type(pagesInputFor("Єдина"), "320");
    await user.click(screen.getByRole("button", { name: copy.submit }));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("disables and clears the number field when the book has no stable page count", async () => {
    mockBulkFetch(() => Promise.resolve(jsonResponse(successResult())));
    const user = userEvent.setup();

    renderDialog([missingPagesItem(1, BOOK_A, "Електронна", ["ebook"])]);

    const input = pagesInputFor("Електронна");
    await user.type(input, "320");
    await user.click(screen.getByRole("checkbox", { name: copy.unavailableLabel }));

    expect(input).toBeDisabled();
    expect(input).toHaveValue(null);
  });

  it("hides the unavailable checkbox and its hint for paper books", () => {
    mockBulkFetch(() => Promise.resolve(jsonResponse(successResult())));

    renderDialog([missingPagesItem(1, BOOK_A, "Паперова")]);

    expect(screen.queryByRole("checkbox", { name: copy.unavailableLabel })).toBeNull();
    expect(screen.queryByText(copy.unavailableHint)).toBeNull();
  });

  it("shows the checkbox only in rows without a paper edition", () => {
    mockBulkFetch(() => Promise.resolve(jsonResponse(successResult())));

    renderDialog([
      missingPagesItem(1, BOOK_A, "Електронна", ["ebook"]),
      missingPagesItem(2, BOOK_B, "Паперова й електронна", ["paper", "ebook"]),
      missingPagesItem(3, BOOK_C, "Без формату", []),
    ]);

    expect(within(rowOf("Електронна")).getByRole("checkbox")).toBeInTheDocument();
    expect(within(rowOf("Паперова й електронна")).queryByRole("checkbox")).toBeNull();
    expect(within(rowOf("Без формату")).getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText(copy.unavailableHint)).toBeInTheDocument();
  });

  it("sends the unavailable flag instead of a page count", async () => {
    const { calls } = mockBulkFetch(() =>
      Promise.resolve(jsonResponse(successResult({ updated: [BOOK_A] }))),
    );
    const user = userEvent.setup();

    renderDialog([missingPagesItem(1, BOOK_A, "Електронна", ["ebook"])]);

    await user.click(screen.getByRole("checkbox", { name: copy.unavailableLabel }));
    await user.click(screen.getByRole("button", { name: copy.submit }));

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      items: [
        {
          bookId: BOOK_A,
          expectedUpdatedAt: "2026-02-01T00:00:00.000Z",
          kind: "pages_count_unavailable",
        },
      ],
    });
  });

  it("disables the submit button while the request is in flight", async () => {
    mockBulkFetch(() => new Promise<Response>(() => {}));
    const user = userEvent.setup();

    renderDialog([missingPagesItem(1, BOOK_A, "Єдина")]);

    await user.type(pagesInputFor("Єдина"), "320");
    const submit = screen.getByRole("button", { name: copy.submit });
    await user.click(submit);

    await vi.waitFor(() => expect(submit).toBeDisabled());
  });

  it("refuses to submit when nothing was filled in", async () => {
    const { fetchMock } = mockBulkFetch(() => Promise.resolve(jsonResponse(successResult())));
    const user = userEvent.setup();

    renderDialog([missingPagesItem(1, BOOK_A, "Єдина")]);

    await user.click(screen.getByRole("button", { name: copy.submit }));

    expect(await screen.findByText(copy.errors.nothingToSave)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
