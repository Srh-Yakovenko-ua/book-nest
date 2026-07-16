import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  AFFECTED_BOOK_TITLE,
  makeApplySeriesOrderFixResponse,
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

const ADD_BEFORE_LABEL = `Додати перед «${AFFECTED_BOOK_TITLE}»`;

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

  it("shows nothing but an empty live region when the queue has no order problems", async () => {
    withIssues({ items: [] });
    renderWithProviders(<SeriesOrderCheckBlock />);

    await waitFor(() => expect(issuesGetCount()).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
    expect(screen.queryByRole("heading", { name: soc.title })).not.toBeInTheDocument();
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

  it("shows the queue before and after the fix", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText(preview.afterFix)).toBeInTheDocument();
    expect(within(dialog).getByText(`«Перша книга» буде додана на позицію 1.`)).toBeInTheDocument();
    expect(within(dialog).getByText("«Друга книга»: позиція 1 → 2")).toBeInTheDocument();
  });

  it("reassures that unrelated books keep their positions", async () => {
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(await within(dialog).findByText(preview.unrelatedUnchanged)).toBeInTheDocument();
  });

  it("warns how many unrelated books will shift", async () => {
    handlePreview = () =>
      Promise.resolve(jsonResponse(makeSeriesOrderFixPreview({ shiftedUnrelatedBooksCount: 2 })));
    renderWithProviders(<SeriesOrderCheckBlock />);
    const dialog = await openPreview();

    expect(
      await within(dialog).findByText("2 сторонні книги змістяться на нову позицію."),
    ).toBeInTheDocument();
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
    const dialog = await openPreview(actions.arrangeBySeries);

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
    const dialog = await openPreview(actions.arrangeBySeries);

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
