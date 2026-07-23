import "@testing-library/jest-dom/vitest";

import type { MediaView, Nullable } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import type { SeriesOrderFixTarget } from "../model/series-order-check";

import {
  AFFECTED_BOOK_TITLE,
  makeSeriesOrderBook,
  makeSeriesOrderCover,
  makeSeriesOrderFixPreview,
  PREVIOUS_BOOK_TITLE,
  QUEUE_VERSION,
  SERIES_TITLE,
} from "../model/series-order-check.fixtures";
import { SeriesOrderFixPreviewDialog } from "./series-order-fix-preview-dialog";

const preview = messages.readingQueue.seriesOrderCheck.preview;

const EXTRA_BOOK_ID = "book-extra";
const EXTRA_BOOK_TITLE = "Третя книга";
const EXTRA_BOOK_COVER_ALT = `Обкладинка «${EXTRA_BOOK_TITLE}»`;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let handlePreview: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeTarget(extraCover: Nullable<MediaView>): SeriesOrderFixTarget {
  return {
    affectedBook: makeSeriesOrderBook(),
    fingerprint: "fp-1",
    previousBook: makeSeriesOrderBook({
      id: "book-previous",
      queuePosition: null,
      seriesPosition: 1,
      title: PREVIOUS_BOOK_TITLE,
    }),
    problemType: "missing_previous_from_queue",
    queueVersion: QUEUE_VERSION,
    recommendedOrder: [
      {
        bookId: "book-previous",
        cover: null,
        queuePosition: 1,
        seriesPosition: 1,
        title: PREVIOUS_BOOK_TITLE,
      },
      {
        bookId: EXTRA_BOOK_ID,
        cover: extraCover,
        queuePosition: 2,
        seriesPosition: 2,
        title: EXTRA_BOOK_TITLE,
      },
      {
        bookId: "book-affected",
        cover: null,
        queuePosition: 3,
        seriesPosition: 3,
        title: AFFECTED_BOOK_TITLE,
      },
    ],
    seriesTitle: SERIES_TITLE,
    strategy: "ADD_ALL_PREVIOUS_BEFORE",
  };
}

const previewWithExtraAdded = makeSeriesOrderFixPreview({
  changes: [
    {
      bookId: EXTRA_BOOK_ID,
      fromPosition: null,
      title: EXTRA_BOOK_TITLE,
      toPosition: 1,
      type: "add",
    },
  ],
  strategy: "ADD_ALL_PREVIOUS_BEFORE",
});

function renderDialog(target: SeriesOrderFixTarget) {
  renderWithProviders(
    <SeriesOrderFixPreviewDialog
      onCloseAutoFocus={vi.fn()}
      onError={vi.fn()}
      onOpenChange={vi.fn()}
      onSuccess={vi.fn()}
      target={target}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  handlePreview = () => Promise.resolve(jsonResponse(makeSeriesOrderFixPreview()));
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/preview")) return handlePreview();
    return Promise.resolve(jsonResponse({}));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SeriesOrderFixPreviewDialog added-book cover", () => {
  it("shows the cover of an added book sourced from the recommended order", async () => {
    handlePreview = () => Promise.resolve(jsonResponse(previewWithExtraAdded));
    renderDialog(makeTarget(makeSeriesOrderCover()));

    expect(await screen.findByRole("img", { name: EXTRA_BOOK_COVER_ALT })).toBeInTheDocument();
  });

  it("shows a placeholder for an added book whose recommended-order cover is null", async () => {
    handlePreview = () => Promise.resolve(jsonResponse(previewWithExtraAdded));
    renderDialog(makeTarget(null));

    await screen.findByText(preview.addedTitle);

    expect(screen.queryByRole("img", { name: EXTRA_BOOK_COVER_ALT })).toBeNull();
  });
});
