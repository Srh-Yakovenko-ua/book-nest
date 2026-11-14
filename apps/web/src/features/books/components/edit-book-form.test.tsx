import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { bookKeys } from "../api/book-keys";
import { makeBookDetailsView } from "./book-details.fixtures";
import { EditBookForm } from "./edit-book-form";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TYPED_ORIGINAL_TITLE = "Ostatnie zyczenie, wydanie drugie";

const common = messages.common;
const editState = messages.books.editState;
const originalTitleLabel = messages.books.editionDetails.fields.originalTitle;
const titleLabel = messages.books.fields.title;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let detailStatus: number;

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function reply(input: RequestInfo | URL): Promise<Response> {
  const { pathname } = new URL(String(input), "http://localhost");
  if (pathname === `/api/books/${BOOK_ID}`) {
    if (detailStatus !== 200) return json({ message: "boom" }, detailStatus);
    return json(makeBookDetailsView({ id: BOOK_ID }));
  }
  if (pathname.startsWith("/api/genres")) return json([]);
  if (pathname === "/api/publishers/recent") return json([]);
  return json({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 });
}

beforeEach(() => {
  detailStatus = 200;
  fetchMock.mockReset();
  fetchMock.mockImplementation(reply);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditBookForm", () => {
  it("keeps unsaved input and shows the refresh banner when a refetch fails", async () => {
    const { queryClient } = renderWithProviders(<EditBookForm id={BOOK_ID} />);
    const originalTitle = await screen.findByLabelText(originalTitleLabel, { exact: false });
    await userEvent.clear(originalTitle);
    await userEvent.type(originalTitle, TYPED_ORIGINAL_TITLE);

    detailStatus = 500;
    await act(() =>
      queryClient.invalidateQueries({ exact: true, queryKey: bookKeys.detail(BOOK_ID) }),
    );

    expect(await screen.findByText(common.refetchError)).toBeInTheDocument();
    expect(screen.getByLabelText(originalTitleLabel, { exact: false })).toHaveValue(
      TYPED_ORIGINAL_TITLE,
    );
  });

  it("moves focus to the title field when a retried first load succeeds", async () => {
    detailStatus = 500;
    renderWithProviders(<EditBookForm id={BOOK_ID} />);
    await screen.findByRole("heading", { name: editState.errorTitle });

    detailStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(await screen.findByLabelText(titleLabel)).toHaveFocus();
  });
});
