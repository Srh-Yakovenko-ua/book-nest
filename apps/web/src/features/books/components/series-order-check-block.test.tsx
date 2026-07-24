import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeApplySeriesOrderFixResponse,
  makeSeriesOrderBook,
  makeSeriesOrderFixPreview,
  makeSeriesOrderIssue,
  makeSeriesOrderIssues,
  makeSeriesOrderIssuesView,
  QUEUE_VERSION,
  SERIES_TITLE,
} from "../model/series-order-check.fixtures";
import { SeriesOrderCheckBlock } from "./series-order-check-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const soc = messages.readingQueue.seriesOrderCheck;
const actions = soc.actions;
const preview = soc.preview;
const filters = soc.filters;
const sort = soc.sort;

const ADD_BEFORE_LABEL = "Додати попередню книгу";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let handleIssues: (url: string) => Promise<Response>;
let handlePreview: () => Promise<Response>;
let handleApply: () => Promise<Response>;
let handleIgnore: () => Promise<Response>;
let handleDisable: () => Promise<Response>;

function bodyOf(suffix: string, method: string): unknown {
  const [init] = callsTo(
    (url, requestInit) => url.endsWith(suffix) && requestInit?.method === method,
  );
  if (init?.body === undefined || init.body === null) return undefined;
  return JSON.parse(String(init.body));
}

function callsTo(predicate: (url: string, init?: RequestInit) => boolean): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => predicate(String(input), init))
    .map(([, init]) => init ?? {});
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ code, message: "failed" }, status);
}

function issuesGetCount(): number {
  return callsTo(
    (url, init) =>
      url.includes("/api/reading-queue/series-order-issues") &&
      !url.includes("/preview") &&
      !url.includes("/apply") &&
      !url.includes("/ignore") &&
      (init?.method ?? "GET").toUpperCase() === "GET",
  ).length;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openPreview(label = ADD_BEFORE_LABEL) {
  await userEvent.click(await screen.findByRole("button", { name: label }));
  return screen.findByRole("dialog");
}

function requestedLimits(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/reading-queue/series-order-issues?"))
    .map((url) => new URL(url, "http://test.local").searchParams.get("limit") ?? "");
}

function wasCalled(suffix: string, method: string): boolean {
  return callsTo((url, init) => url.endsWith(suffix) && init?.method === method).length > 0;
}

function withIssues(...args: Parameters<typeof makeSeriesOrderIssuesView>) {
  const view = makeSeriesOrderIssuesView(...args);
  handleIssues = () => Promise.resolve(jsonResponse(view));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  handleIssues = () => Promise.resolve(jsonResponse(makeSeriesOrderIssuesView()));
  handlePreview = () => Promise.resolve(jsonResponse(makeSeriesOrderFixPreview()));
  handleApply = () => Promise.resolve(jsonResponse(makeApplySeriesOrderFixResponse()));
  handleIgnore = () => Promise.resolve(jsonResponse(makeSeriesOrderIssuesView({ items: [] })));
  handleDisable = () => Promise.resolve(jsonResponse({ enabled: false }));

  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/preview")) return handlePreview();
    if (url.endsWith("/apply")) return handleApply();
    if (url.endsWith("/ignore")) return handleIgnore();
    if (url.includes("/order-check-preference")) return handleDisable();
    if (url.includes("/api/reading-queue/series-order-issues")) return handleIssues(url);
    return Promise.resolve(jsonResponse({}));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SeriesOrderCheckBlock states", () => {
  it("shows a loading skeleton while the check is running", () => {
    handleIssues = () => new Promise<Response>(() => {});
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(screen.getByRole("status", { name: soc.loading })).toBeInTheDocument();
  });

  it("shows an error when the check fails", async () => {
    handleIssues = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findByText(soc.error.load)).toBeInTheDocument();
  });

  it("retries the check and renders the issues that load on the retry", async () => {
    handleIssues = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderWithProviders(<SeriesOrderCheckBlock />);

    await screen.findByText(soc.error.load);
    withIssues({
      items: [makeSeriesOrderIssue({ series: { id: "s-1", title: "Відновлена серія" } })],
    });

    await userEvent.click(screen.getByRole("button", { name: actions.retry }));

    expect(await screen.findByRole("link", { name: "Відновлена серія" })).toBeInTheDocument();
  });

  it("shows a green resolved state and an empty live region when the queue has no order problems", async () => {
    withIssues({ items: [] });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findByText(soc.resolved)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
    expect(screen.queryByRole("heading", { name: soc.title })).not.toBeInTheDocument();
  });

  it("shows the attention callout when the queue has order problems", async () => {
    withIssues({ items: makeSeriesOrderIssues(3), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findByText(soc.attention.title)).toBeInTheDocument();
  });

  it("asks the backend for three issues in the sidebar", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);

    await screen.findByRole("heading", { name: soc.title });
    expect(requestedLimits()).toContain("3");
  });
});

describe("SeriesOrderCheckBlock list", () => {
  it("shows the three issues the backend returned", async () => {
    withIssues({ items: makeSeriesOrderIssues(3), total: 3 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findByRole("link", { name: "Серія 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Серія 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Серія 3" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("shows the total count from the api rather than the number of cards", async () => {
    withIssues({ items: makeSeriesOrderIssues(3), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    const badge = await screen.findByLabelText("Знайдено проблем із порядком: 7");
    expect(badge).toHaveTextContent("7");
  });

  it("offers to view all issues when there are more than the sidebar shows", async () => {
    withIssues({ items: makeSeriesOrderIssues(3), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(
      await screen.findByRole("button", { name: new RegExp(soc.viewAll) }),
    ).toBeInTheDocument();
  });

  it("hides the view all button when every issue already fits", async () => {
    withIssues({ items: makeSeriesOrderIssues(2), total: 2 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    await screen.findByRole("link", { name: "Серія 1" });
    expect(screen.queryByRole("button", { name: new RegExp(soc.viewAll) })).not.toBeInTheDocument();
  });

  it("shows one card per series even when the series has related problems", async () => {
    withIssues({
      items: [
        makeSeriesOrderIssue({
          relatedProblems: [
            {
              affectedBookId: "book-3",
              previousBookId: "book-2",
              problemType: "previous_book_paused",
            },
          ],
        }),
      ],
      total: 1,
    });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findAllByRole("link", { name: SERIES_TITLE })).toHaveLength(1);
    expect(screen.getByText("Ще 1 конфлікт у цій серії")).toBeInTheDocument();
  });

  it("loads up to fifty issues when all issues are opened", async () => {
    withIssues({ items: makeSeriesOrderIssues(3), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(soc.viewAll) }));

    expect(await screen.findByRole("dialog", { name: soc.allIssues.title })).toBeInTheDocument();
    await waitFor(() => expect(requestedLimits()).toContain("50"));
  });
});

describe("SeriesOrderCheckBlock fix preview", () => {
  it("previews the fix without touching the queue", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    await openPreview();

    await waitFor(() => expect(wasCalled("/fp-1/preview", "POST")).toBe(true));
    expect(wasCalled("/fp-1/apply", "POST")).toBe(false);
  });

  it("sends the current queue version as a string when previewing", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    await openPreview();

    await waitFor(() => expect(wasCalled("/fp-1/preview", "POST")).toBe(true));
    expect(bodyOf("/fp-1/preview", "POST")).toEqual({
      expectedQueueVersion: QUEUE_VERSION,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });
  });

  it("shows what will be added and how the queue shifts", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText(preview.addedTitle)).toBeInTheDocument();
    expect(within(dialog).getByText(preview.queueChangesTitle)).toBeInTheDocument();
    expect(within(dialog).getByText("Нова позиція: #1")).toBeInTheDocument();
    expect(within(dialog).getByText(preview.newBook)).toBeInTheDocument();
  });

  it("tells the reader how many books keep their position", async () => {
    handlePreview = () =>
      Promise.resolve(
        jsonResponse(
          makeSeriesOrderFixPreview({
            before: [
              { belongsToAffectedSeries: true, bookId: "b1", queuePosition: 1, title: "Книга 1" },
              { belongsToAffectedSeries: false, bookId: "b2", queuePosition: 2, title: "Книга 2" },
              { belongsToAffectedSeries: false, bookId: "b3", queuePosition: 3, title: "Книга 3" },
              { belongsToAffectedSeries: false, bookId: "b4", queuePosition: 4, title: "Книга 4" },
            ],
            changes: [
              { bookId: "new", fromPosition: null, title: "Нова", toPosition: 1, type: "add" },
              { bookId: "b1", fromPosition: 1, title: "Книга 1", toPosition: 2, type: "move" },
            ],
          }),
        ),
      );
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(
      await within(dialog).findByText("3 книги залишаться на своїх позиціях."),
    ).toBeInTheDocument();
  });

  it("collapses a long list of moves behind a show-all toggle", async () => {
    const moves = Array.from({ length: 7 }, (_, index) => ({
      bookId: `m-${index}`,
      fromPosition: index + 1,
      title: `Переміщена ${index + 1}`,
      toPosition: index + 2,
      type: "move" as const,
    }));
    handlePreview = () =>
      Promise.resolve(
        jsonResponse(
          makeSeriesOrderFixPreview({
            changes: [
              { bookId: "new", fromPosition: null, title: "Нова", toPosition: 1, type: "add" },
              ...moves,
            ],
          }),
        ),
      );
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText("Переміщена 1")).toBeInTheDocument();
    expect(within(dialog).queryByText("Переміщена 7")).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: preview.showAllMoves }));

    expect(within(dialog).getByText("Переміщена 7")).toBeInTheDocument();
  });

  it("shows the warnings the backend attached to the preview", async () => {
    handlePreview = () =>
      Promise.resolve(jsonResponse(makeSeriesOrderFixPreview({ warnings: ["Черга майже повна"] })));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText("Черга майже повна")).toBeInTheDocument();
  });

  it("shows an error and blocks confirming when the preview fails", async () => {
    handlePreview = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText(preview.error)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: preview.confirmInsert })).toBeDisabled();
    expect(wasCalled("/fp-1/apply", "POST")).toBe(false);
  });

  it("names the confirm action after the reorder strategy", async () => {
    withIssues({
      items: [
        makeSeriesOrderIssue({
          allowedActions: ["REORDER_SERIES_SLOTS"],
          problemType: "multiple_books_out_of_order",
        }),
      ],
    });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview(actions.fixOrder);

    expect(
      await within(dialog).findByRole("button", { name: preview.confirmReorder }),
    ).toBeInTheDocument();
  });

  it("does not apply the fix when the preview is cancelled", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(await within(dialog).findByRole("button", { name: preview.cancel }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(wasCalled("/fp-1/apply", "POST")).toBe(false);
  });

  it("does not apply the fix when the preview is dismissed with escape", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    await openPreview();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(wasCalled("/fp-1/apply", "POST")).toBe(false);
  });
});

describe("SeriesOrderCheckBlock applying a fix", () => {
  it("applies the fix only after it is confirmed", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(wasCalled("/fp-1/apply", "POST")).toBe(true));
  });

  it("applies the fix with the queue version it previewed", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(wasCalled("/fp-1/apply", "POST")).toBe(true));
    expect(bodyOf("/fp-1/apply", "POST")).toEqual({
      expectedQueueVersion: QUEUE_VERSION,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });
  });

  it("adds every previous book when that strategy is chosen", async () => {
    withIssues({ items: [makeSeriesOrderIssue({ allowedActions: ["ADD_ALL_PREVIOUS_BEFORE"] })] });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview(actions.addAll);

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(wasCalled("/fp-1/apply", "POST")).toBe(true));
    expect(bodyOf("/fp-1/apply", "POST")).toEqual({
      expectedQueueVersion: QUEUE_VERSION,
      strategy: "ADD_ALL_PREVIOUS_BEFORE",
    });
  });

  it("reorders the series slots when that strategy is chosen", async () => {
    withIssues({
      items: [
        makeSeriesOrderIssue({
          allowedActions: ["REORDER_SERIES_SLOTS"],
          problemType: "multiple_books_out_of_order",
        }),
      ],
    });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview(actions.fixOrder);

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmReorder }),
    );

    await waitFor(() => expect(wasCalled("/fp-1/apply", "POST")).toBe(true));
    expect(bodyOf("/fp-1/apply", "POST")).toEqual({
      expectedQueueVersion: QUEUE_VERSION,
      strategy: "REORDER_SERIES_SLOTS",
    });
  });

  it("closes the dialog and confirms the fix to the reader", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(soc.success.fixed);
  });

  it("refreshes the issues after a fix so the sidebar matches the queue", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();
    const callsBefore = issuesGetCount();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(issuesGetCount()).toBeGreaterThan(callsBefore));
  });

  it("announces the fix and returns focus to the block heading", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const heading = screen.getByRole("heading", { name: soc.title });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent(soc.success.fixed);
  });
});

describe("SeriesOrderCheckBlock fix errors", () => {
  it.each([
    [409, "QUEUE_STALE", soc.error.queueStale],
    [409, "ISSUE_STALE", soc.error.issueStale],
    [409, "ALREADY_IN_QUEUE", soc.error.alreadyInQueue],
  ] as const)(
    "reports a %i %s as a stale queue and closes the dialog",
    async (status, code, message) => {
      handleApply = () => Promise.resolve(errorResponse(status, code));
      renderWithProviders(<SeriesOrderCheckBlock />);
      const dialog = await openPreview();

      await userEvent.click(
        await within(dialog).findByRole("button", { name: preview.confirmInsert }),
      );

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(await screen.findByRole("button", { name: ADD_BEFORE_LABEL })).toBeEnabled();
    },
  );

  it("refetches the issues after a stale conflict", async () => {
    handleApply = () => Promise.resolve(errorResponse(409, "QUEUE_STALE"));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();
    const callsBefore = issuesGetCount();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );

    await waitFor(() => expect(issuesGetCount()).toBeGreaterThan(callsBefore));
  });

  it.each([
    [422, "QUEUE_LIMIT_REACHED", soc.error.queueLimit],
    [404, "NOT_FOUND", soc.error.notFound],
    [403, "FORBIDDEN", soc.error.forbidden],
    [500, "INTERNAL", soc.error.generic],
  ] as const)(
    "keeps the dialog usable and explains a %i failure",
    async (status, code, message) => {
      handleApply = () => Promise.resolve(errorResponse(status, code));
      renderWithProviders(<SeriesOrderCheckBlock />);
      const dialog = await openPreview();

      await userEvent.click(
        await within(dialog).findByRole("button", { name: preview.confirmInsert }),
      );

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
      expect(toast.error).toHaveBeenCalledWith(message);
      expect(within(dialog).getByRole("button", { name: preview.confirmInsert })).toBeEnabled();
    },
  );

  it("lets the reader cancel after a failed fix", async () => {
    handleApply = () => Promise.resolve(errorResponse(422, "QUEUE_LIMIT_REACHED"));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    await userEvent.click(
      await within(dialog).findByRole("button", { name: preview.confirmInsert }),
    );
    await within(dialog).findByRole("alert");
    await userEvent.click(within(dialog).getByRole("button", { name: preview.cancel }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: ADD_BEFORE_LABEL })).toBeEnabled();
  });
});

describe("SeriesOrderCheckBlock ignoring an issue", () => {
  it("ignores only the fingerprint the reader chose", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);

    await userEvent.click(await screen.findByRole("button", { name: actions.ignore }));

    await waitFor(() => expect(wasCalled("/fp-1/ignore", "POST")).toBe(true));
  });

  it("drops the ignored issue and updates the count", async () => {
    withIssues({ items: makeSeriesOrderIssues(2), total: 2 });
    renderWithProviders(<SeriesOrderCheckBlock />);

    await screen.findByRole("link", { name: "Серія 1" });
    handleIssues = () =>
      Promise.resolve(
        jsonResponse(
          makeSeriesOrderIssuesView({
            items: [
              makeSeriesOrderIssue({
                fingerprint: "fp-2",
                series: { id: "series-2", title: "Серія 2" },
              }),
            ],
            total: 1,
          }),
        ),
      );

    const [firstIgnore] = screen.getAllByRole("button", { name: actions.ignore });
    if (firstIgnore === undefined) throw new Error("no ignore button rendered");
    await userEvent.click(firstIgnore);

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Серія 1" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Серія 2" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Знайдено проблем із порядком: 1")).toBeInTheDocument();
  });

  it("announces that the warning is hidden", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);

    await userEvent.click(await screen.findByRole("button", { name: actions.ignore }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(soc.success.ignored));
  });

  it("explains a failure to ignore and keeps the issue actionable", async () => {
    handleIgnore = () => Promise.resolve(errorResponse(409, "ISSUE_STALE"));
    renderWithProviders(<SeriesOrderCheckBlock />);

    await userEvent.click(await screen.findByRole("button", { name: actions.ignore }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(soc.error.issueStale));
    await waitFor(() => expect(screen.getByRole("button", { name: actions.ignore })).toBeEnabled());
  });
});

describe("SeriesOrderCheckBlock disabling a series", () => {
  async function chooseDisable() {
    await userEvent.click(
      await screen.findByRole("button", { name: `Більше дій для серії «${SERIES_TITLE}»` }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: actions.disableSeries }));
    return screen.findByRole("alertdialog");
  }

  it("asks for confirmation before disabling the check", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await chooseDisable();

    expect(within(dialog).getByText(soc.disable.title)).toBeInTheDocument();
    expect(wasCalled("/order-check-preference", "PUT")).toBe(false);
  });

  it("disables the check for the series once confirmed", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await chooseDisable();

    await userEvent.click(within(dialog).getByRole("button", { name: soc.disable.confirm }));

    await waitFor(() =>
      expect(wasCalled("/series/series-1/order-check-preference", "PUT")).toBe(true),
    );
    expect(bodyOf("/series/series-1/order-check-preference", "PUT")).toEqual({ enabled: false });
    expect(toast.success).toHaveBeenCalledWith(soc.success.disabled);
  });

  it("keeps the check enabled when the confirmation is cancelled", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await chooseDisable();

    await userEvent.click(within(dialog).getByRole("button", { name: soc.disable.cancel }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(wasCalled("/order-check-preference", "PUT")).toBe(false);
  });

  it("explains a failure to disable the check", async () => {
    handleDisable = () => Promise.resolve(errorResponse(404, "NOT_FOUND"));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await chooseDisable();

    await userEvent.click(within(dialog).getByRole("button", { name: soc.disable.confirm }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(soc.error.notFound));
  });
});

describe("SeriesOrderCheckBlock ownership actions", () => {
  it("opens the wishlist dialog instead of mutating the queue", async () => {
    withIssues({
      items: [
        makeSeriesOrderIssue({
          allowedActions: ["ADD_PREVIOUS_TO_WISHLIST"],
          problemType: "previous_book_not_owned",
        }),
      ],
    });
    renderWithProviders(<SeriesOrderCheckBlock />);

    await userEvent.click(await screen.findByRole("button", { name: actions.addToWishlist }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(wasCalled("/fp-1/apply", "POST")).toBe(false);
  });

  it.each([
    ["previous_book_lent_out", "OPEN_LOAN", actions.openLoan],
    ["previous_book_in_transit", "OPEN_ORDER", actions.openOrder],
    ["previous_book_want_to_buy", "OPEN_PURCHASE", actions.openPurchase],
    ["previous_book_paused", "RESUME_PREVIOUS_BOOK", actions.resumeBook],
  ] as const)("links %s straight to the previous book", async (problemType, code, label) => {
    withIssues({ items: [makeSeriesOrderIssue({ allowedActions: [code], problemType })] });
    renderWithProviders(<SeriesOrderCheckBlock />);

    expect(await screen.findByRole("link", { name: label })).toHaveAttribute(
      "href",
      "/books/book-previous",
    );
  });
});

describe("SeriesOrderCheckBlock all issues toolbar", () => {
  function dialogSeriesTitles(dialog: HTMLElement): string[] {
    return within(dialog)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/series/"))
      .map((link) => link.textContent ?? "");
  }

  function makeToolbarIssues() {
    return [
      makeSeriesOrderIssue({
        affectedBook: makeSeriesOrderBook({ queuePosition: 1 }),
        fingerprint: "fp-error",
        series: { id: "s-gamma", title: "Гамма" },
        severity: "error",
      }),
      makeSeriesOrderIssue({
        affectedBook: makeSeriesOrderBook({ queuePosition: 3 }),
        fingerprint: "fp-warning",
        series: { id: "s-alpha", title: "Альфа" },
        severity: "warning",
      }),
      makeSeriesOrderIssue({
        affectedBook: makeSeriesOrderBook({ queuePosition: 2 }),
        fingerprint: "fp-info",
        series: { id: "s-beta", title: "Бета" },
        severity: "info",
      }),
    ];
  }

  async function openAllIssues() {
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(soc.viewAll) }));
    return screen.findByRole("dialog", { name: soc.allIssues.title });
  }

  async function chooseSort(dialog: HTMLElement, name: string) {
    await userEvent.click(within(dialog).getByRole("combobox", { name: sort.label }));
    await userEvent.click(await screen.findByRole("option", { name }));
  }

  it("shows a chip with a count for every severity that is present", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    expect(within(dialog).getByRole("radio", { name: `${filters.all} 3` })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: `${filters.error} 1` })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: `${filters.warning} 1` })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: `${filters.info} 1` })).toBeInTheDocument();
  });

  it("hides a severity chip when no issue has that severity", async () => {
    withIssues({ items: [makeSeriesOrderIssue({ severity: "warning" })], total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    expect(within(dialog).getByRole("radio", { name: `${filters.warning} 1` })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("radio", { name: new RegExp(filters.error) }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("radio", { name: new RegExp(filters.info) }),
    ).not.toBeInTheDocument();
  });

  it("filters the list down to the chosen severity", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    await userEvent.click(within(dialog).getByRole("radio", { name: `${filters.error} 1` }));

    expect(within(dialog).getByRole("link", { name: "Гамма" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Альфа" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Бета" })).not.toBeInTheDocument();
  });

  it("marks the active severity chip as pressed", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    const errorChip = within(dialog).getByRole("radio", { name: `${filters.error} 1` });
    await userEvent.click(errorChip);

    expect(errorChip).toHaveAttribute("data-state", "on");
    expect(within(dialog).getByRole("radio", { name: `${filters.all} 3` })).toHaveAttribute(
      "data-state",
      "off",
    );
  });

  it("orders the issues by queue position by default", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    expect(dialogSeriesTitles(dialog)).toEqual(["Гамма", "Бета", "Альфа"]);
  });

  it("re-sorts the issues by problem severity", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    await chooseSort(dialog, sort.byType);

    expect(dialogSeriesTitles(dialog)).toEqual(["Гамма", "Альфа", "Бета"]);
  });

  it("re-sorts the issues by series title", async () => {
    withIssues({ items: makeToolbarIssues(), total: 7 });
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openAllIssues();

    await chooseSort(dialog, sort.bySeries);

    expect(dialogSeriesTitles(dialog)).toEqual(["Альфа", "Бета", "Гамма"]);
  });
});
