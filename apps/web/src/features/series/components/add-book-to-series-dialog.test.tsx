import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { AddBookToSeriesDialog } from "./add-book-to-series-dialog";

const addBookDialog = messages.series.addBookDialog;

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SERIES_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SOLO_BOOKS_PAGE = {
  items: [makeBookView({ id: BOOK_ID, series: null, title: "The Shadow of the Wind" })],
  page: 1,
  pagesCount: 1,
  pageSize: 20,
  totalCount: 1,
};

const EXCEEDS_TOTAL_BODY = {
  errorsMessages: [
    {
      code: "BOOK_PART_NUMBER_EXCEEDS_TOTAL",
      field: "partNumber",
      message: "Some other wording",
    },
  ],
};

const UNKNOWN_FIELD_ERROR_BODY = {
  errorsMessages: [{ code: "too_big", field: "partNumber", message: "Too big" }],
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddBookToSeriesDialog", () => {
  it("shows the exceeds-total error under the part number when the server reports that code", async () => {
    answerLinkWith(() => Promise.resolve(jsonResponse(EXCEEDS_TOTAL_BODY, 400)));
    renderWithProviders(
      <AddBookToSeriesDialog
        defaultPartNumber={3}
        onOpenChange={vi.fn()}
        open
        seriesId={SERIES_ID}
      />,
    );

    await chooseBookAndSubmit();

    expect(await screen.findByText(addBookDialog.partNumberExceedsTotal)).toBeInTheDocument();
    const partNumber = screen.getByRole("spinbutton", { name: addBookDialog.partNumber });
    expect(partNumber).toHaveAccessibleDescription(addBookDialog.partNumberExceedsTotal);
  });

  it("shows the generic error instead of the raw server wording for an unknown field error", async () => {
    answerLinkWith(() => Promise.resolve(jsonResponse(UNKNOWN_FIELD_ERROR_BODY, 400)));
    renderWithProviders(
      <AddBookToSeriesDialog
        defaultPartNumber={3}
        onOpenChange={vi.fn()}
        open
        seriesId={SERIES_ID}
      />,
    );

    await chooseBookAndSubmit();

    expect(await screen.findByText(addBookDialog.genericError)).toBeInTheDocument();
    expect(screen.queryByText("Too big")).not.toBeInTheDocument();
  });

  it("stays open on Escape while the book is being added", async () => {
    const onOpenChange = vi.fn();
    answerLinkWith(() => new Promise<Response>(() => undefined));
    renderWithProviders(
      <AddBookToSeriesDialog
        defaultPartNumber={3}
        onOpenChange={onOpenChange}
        open
        seriesId={SERIES_ID}
      />,
    );

    await chooseBookAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: addBookDialog.submit })).toBeDisabled(),
    );
    await userEvent.click(screen.getByRole("textbox", { name: addBookDialog.searchLabel }));
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes on Escape when nothing is being added", async () => {
    const onOpenChange = vi.fn();
    answerLinkWith(() => new Promise<Response>(() => undefined));
    renderWithProviders(
      <AddBookToSeriesDialog
        defaultPartNumber={3}
        onOpenChange={onOpenChange}
        open
        seriesId={SERIES_ID}
      />,
    );

    await userEvent.click(searchOptionButton());
    await screen.findByRole("radiogroup", { name: addBookDialog.selectBook });
    await userEvent.click(screen.getByRole("textbox", { name: addBookDialog.searchLabel }));
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

function answerLinkWith(respondToLink: () => Promise<Response>) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method === "PATCH" && url.includes(`/api/books/${BOOK_ID}`)) return respondToLink();
    if ((init?.method ?? "GET") === "GET" && url.includes("/api/books")) {
      return Promise.resolve(jsonResponse(SOLO_BOOKS_PAGE, 200));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

async function chooseBookAndSubmit() {
  await userEvent.click(searchOptionButton());
  const books = await screen.findByRole("radiogroup", { name: addBookDialog.selectBook });
  await userEvent.click(within(books).getByRole("radio"));
  await userEvent.type(
    screen.getByRole("spinbutton", { name: addBookDialog.partNumber }),
    "{ArrowUp}",
  );
  await userEvent.click(screen.getByRole("button", { name: addBookDialog.submit }));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function searchOptionButton(): HTMLElement {
  return screen.getByRole("button", {
    name: (accessibleName) => accessibleName.startsWith(addBookDialog.optionSearchTitle),
  });
}
