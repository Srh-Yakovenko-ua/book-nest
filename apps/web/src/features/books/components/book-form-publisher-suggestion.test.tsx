import "@testing-library/jest-dom/vitest";

import type { BookView, SeriesView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeSeriesView } from "@/features/series/model/series.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { BookForm } from "./book-form";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const VIVAT = { bookCount: 5, id: "publisher-vivat", name: "Vivat" };
const KSD = { bookCount: 3, id: "publisher-ksd", name: "КСД" };

const DRAFT_KEY = "book-form-draft:create";

function empirean(dominantPublisher: SeriesView["dominantPublisher"]): SeriesView {
  return makeSeriesView({
    authors: [],
    dominantPublisher,
    genres: [],
    id: "series-empirean",
    name: "Емпіреї",
    totalBooks: null,
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function mockApi(...series: SeriesView[]) {
  fetchMock.mockImplementation((input, init) => {
    const path = String(input);
    if (path.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (path.includes("/api/publishers/recent")) return Promise.resolve(jsonResponse([]));
    if (path.includes("/api/series") && init?.method !== "POST") {
      return Promise.resolve(page(series));
    }
    return Promise.resolve(page([]));
  });
}

function page(items: unknown[]): Response {
  return jsonResponse({
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
  });
}

async function pickSeries(name: string) {
  await userEvent.click(screen.getByLabelText("Серія"));
  await userEvent.click(await screen.findByText(name));
  await waitFor(() => expect(screen.getByLabelText("Серія")).toHaveValue(name));
}

async function pickWitcher() {
  await userEvent.click(screen.getByRole("radio", { name: "Частина серії" }));
  await pickSeries("Відьмак");
}

function publisherField(): HTMLElement {
  const field = publisherInput().closest("div");
  if (field === null) throw new Error("publisher field wrapper is missing");
  return field;
}

function publisherInput(): HTMLElement {
  return screen.getByLabelText(/Видавництво/);
}

function seriesBook(series: SeriesView): BookView {
  return makeBookView({
    bookType: "series_part",
    partNumber: 1,
    publisher: null,
    series,
  });
}

function storeDraft(draft: { publisherEdited: boolean }) {
  sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      authorSelections: [],
      loanContactSelection: null,
      locale: "en",
      publisherEdited: draft.publisherEdited,
      publisherSelection: null,
      seriesSelection: null,
      values: {},
    }),
  );
}

function witcher(dominantPublisher: SeriesView["dominantPublisher"]): SeriesView {
  return makeSeriesView({
    authors: [],
    dominantPublisher,
    genres: [],
    id: "series-witcher",
    name: "Відьмак",
    totalBooks: null,
  });
}

vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  mockApi(witcher(VIVAT));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BookForm publisher suggestion", () => {
  it("prefills the publisher with the dominant publisher of the picked series", async () => {
    renderWithProviders(<BookForm mode="create" />);

    expect(publisherInput()).toHaveValue("");

    await pickWitcher();

    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));
    expect(
      screen.getByText(
        "Підставили Vivat: це видавництво 5 книг цієї серії. Змініть, якщо це інше видання.",
      ),
    ).toBeInTheDocument();
  });

  it("describes the publisher field with the suggestion hint", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();

    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));
    expect(publisherInput()).toHaveAccessibleDescription(/Підставили Vivat/);
  });

  it("leaves the publisher empty when the series publishers tie", async () => {
    mockApi(witcher(null));
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();

    expect(publisherInput()).toHaveValue("");
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("keeps the publisher empty after the user clears it and picks the same series again", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();
    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));

    await userEvent.click(within(publisherField()).getByRole("button", { name: "Очистити" }));
    expect(publisherInput()).toHaveValue("");

    await userEvent.click(screen.getByLabelText("Серія"));
    await userEvent.click(await screen.findByText("Відьмак"));

    expect(publisherInput()).toHaveValue("");
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("lets the publisher the user arrived with win over the series suggestion", async () => {
    renderWithProviders(
      <BookForm
        initialPublisher={{ id: "publisher-ranok", kind: "catalog", name: "Ранок" }}
        mode="create"
      />,
    );

    expect(publisherInput()).toHaveValue("Ранок");

    await pickWitcher();

    expect(publisherInput()).toHaveValue("Ранок");
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("replaces the suggested publisher when another series is picked", async () => {
    mockApi(witcher(VIVAT), empirean(KSD));
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();
    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));

    await pickSeries("Емпіреї");

    await waitFor(() => expect(publisherInput()).toHaveValue("КСД"));
    expect(screen.getByText(/Підставили КСД/)).toBeInTheDocument();
    expect(screen.queryByText(/Підставили Vivat/)).not.toBeInTheDocument();
  });

  it("drops the suggested publisher when the book stops being part of a series", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();
    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));

    await userEvent.click(screen.getByRole("radio", { name: "Окрема книга" }));

    await waitFor(() => expect(publisherInput()).toHaveValue(""));
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("suggests nothing in edit mode when the series changes", async () => {
    mockApi(empirean(KSD));
    renderWithProviders(<BookForm book={seriesBook(witcher(null))} mode="edit" />);

    expect(publisherInput()).toHaveValue("");

    await pickSeries("Емпіреї");

    expect(publisherInput()).toHaveValue("");
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("keeps a publisher the user cleared before switching the interface language empty", async () => {
    storeDraft({ publisherEdited: true });
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();

    expect(publisherInput()).toHaveValue("");
    expect(screen.queryByText(/Підставили/)).not.toBeInTheDocument();
  });

  it("still suggests after an interface language switch when the publisher was never touched", async () => {
    storeDraft({ publisherEdited: false });
    renderWithProviders(<BookForm mode="create" />);

    await pickWitcher();

    await waitFor(() => expect(publisherInput()).toHaveValue("Vivat"));
    expect(screen.getByText(/Підставили Vivat/)).toBeInTheDocument();
  });
});
