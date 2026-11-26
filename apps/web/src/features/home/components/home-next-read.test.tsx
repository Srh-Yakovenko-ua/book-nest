import type { HomeNextReadCandidate, HomeNextReadView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { homeNextReadState } from "../model/home-next-read";
import { HomeNextRead } from "./home-next-read";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, info: vi.fn(), success: vi.fn() }),
}));

const nextRead = messages.home.nextRead;
const startDialog = messages.readingQueue.start;
const BOOK_IDS = [
  "cccccccc-0000-4000-8000-000000000001",
  "cccccccc-0000-4000-8000-000000000002",
  "cccccccc-0000-4000-8000-000000000003",
] as const;

type CandidateBook = { id: string; title: string };

const FIRST_BOOK: CandidateBook = { id: BOOK_IDS[0], title: "Нейромант" };

const fetchMock = vi.fn();
let respondToStatusChange: () => Promise<Response>;

function candidate(
  { id, title }: CandidateBook = FIRST_BOOK,
  overrides: Partial<HomeNextReadCandidate> = {},
): HomeNextReadCandidate {
  return {
    action: "start",
    book: {
      authors: [{ id: "author-1", name: "Вільям Ґібсон" }],
      cover: null,
      currentPage: null,
      id,
      isFavorite: false,
      ownershipStatus: "owned",
      pagesCount: 320,
      progressPercent: null,
      readingStatus: "want_to_read",
      title,
    },
    queue: null,
    reason: "planned",
    series: null,
    source: "library",
    ...overrides,
  };
}

function queueCandidate(): HomeNextReadCandidate {
  return candidate(FIRST_BOOK, {
    queue: { position: 1, priority: null, reason: null, targetDate: null },
    reason: "queue_next",
    source: "queue",
  });
}

function showNextRead(view: HomeNextReadView) {
  return renderWithProviders(
    <HomeNextRead
      isRetrying={false}
      onRetry={vi.fn()}
      state={homeNextReadState({ data: view, isError: false })}
    />,
  );
}

function statusChangeCalls() {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/reading-status"));
}

beforeEach(() => {
  respondToStatusChange = () => new Promise<Response>(() => {});
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/reading-status") && method === "POST") return respondToStatusChange();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HomeNextRead queue candidate", () => {
  it("opens the start reading dialog with the remove-from-queue choice", async () => {
    showNextRead({ candidates: [queueCandidate()], unavailableSources: [] });

    await userEvent.click(screen.getByRole("button", { name: nextRead.action.start }));

    expect(await screen.findByRole("dialog", { name: startDialog.title })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: startDialog.removeLabel })).toBeChecked();
    expect(statusChangeCalls()).toHaveLength(0);
  });
});

describe("HomeNextRead library candidate", () => {
  it("starts reading through the reading status request", async () => {
    showNextRead({ candidates: [candidate()], unavailableSources: [] });

    await userEvent.click(screen.getByRole("button", { name: nextRead.action.start }));

    await waitFor(() => expect(statusChangeCalls()).toHaveLength(1));
    const [url, init] = statusChangeCalls()[0] ?? [];
    expect(String(url)).toContain(`/api/books/${BOOK_IDS[0]}/reading-status`);
    expect(JSON.parse(String(init?.body))).toEqual({ status: "reading" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the start while the request is pending and sends nothing on a second click", async () => {
    showNextRead({ candidates: [candidate()], unavailableSources: [] });

    const start = screen.getByRole("button", { name: nextRead.action.start });
    await userEvent.click(start);
    await waitFor(() => expect(start).toBeDisabled());
    await userEvent.click(start);

    expect(statusChangeCalls()).toHaveLength(1);
  });

  it("keeps the same candidate and reports the error when starting fails", async () => {
    respondToStatusChange = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "boom" }), {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }),
      );
    showNextRead({
      candidates: [candidate(), candidate({ id: BOOK_IDS[1], title: "Дюна" })],
      unavailableSources: [],
    });

    await userEvent.click(screen.getByRole("button", { name: nextRead.action.start }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(nextRead.startError));
    expect(screen.getByRole("link", { name: "Нейромант" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: nextRead.action.start })).toBeEnabled();
  });
});

describe("HomeNextRead another book", () => {
  it("cycles to the next candidate and wraps around", async () => {
    showNextRead({
      candidates: [
        candidate(),
        candidate({ id: BOOK_IDS[1], title: "Дюна" }),
        candidate({ id: BOOK_IDS[2], title: "Соляріс" }),
      ],
      unavailableSources: [],
    });

    const another = screen.getByRole("button", { name: nextRead.another });
    await userEvent.click(another);
    expect(screen.getByRole("link", { name: "Дюна" })).toBeInTheDocument();

    await userEvent.click(another);
    expect(screen.getByRole("link", { name: "Соляріс" })).toBeInTheDocument();

    await userEvent.click(another);
    expect(screen.getByRole("link", { name: "Нейромант" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Соляріс" })).not.toBeInTheDocument();
  });

  it("is hidden with a single candidate", () => {
    showNextRead({ candidates: [candidate()], unavailableSources: [] });

    expect(screen.queryByRole("button", { name: nextRead.another })).not.toBeInTheDocument();
  });
});

describe("HomeNextRead completeness", () => {
  it("notes that the advice may be incomplete when a source failed", () => {
    showNextRead({ candidates: [candidate()], unavailableSources: ["favorite_series"] });

    expect(screen.getByRole("status")).toHaveTextContent(nextRead.incomplete.note);
    expect(screen.getByRole("link", { name: "Нейромант" })).toBeInTheDocument();
  });

  it("shows no incomplete note when every source answered", () => {
    showNextRead({ candidates: [candidate()], unavailableSources: [] });

    expect(screen.queryByText(nextRead.incomplete.note)).not.toBeInTheDocument();
  });

  it("shows the empty message with queue and library links when nothing is left to suggest", () => {
    showNextRead({ candidates: [], unavailableSources: [] });

    expect(screen.getByText(nextRead.empty.description)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: nextRead.empty.toQueue })).toHaveAttribute(
      "href",
      "/reading-queue",
    );
    expect(screen.getByRole("link", { name: nextRead.empty.toCatalogue })).toHaveAttribute(
      "href",
      "/books",
    );
  });

  it("does not claim an empty library when a source failed and nothing came back", () => {
    showNextRead({ candidates: [], unavailableSources: ["queue"] });

    expect(screen.getByRole("alert")).toHaveTextContent(nextRead.incomplete.empty);
    expect(screen.queryByText(nextRead.empty.description)).not.toBeInTheDocument();
  });
});
