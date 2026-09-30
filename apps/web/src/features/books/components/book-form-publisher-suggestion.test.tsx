import "@testing-library/jest-dom/vitest";

import type { BookView, PublisherDuplicateCandidate, SeriesView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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

const CHAS = { id: "publisher-chas", name: "Видавництво Час" };
const CHASOPYS = { id: "publisher-chasopys", name: "Часопис" };

const SUBMITTED_PUBLISHER_SCHEMA = z.object({
  publisherId: z.string().optional(),
  publisherName: z.string().optional(),
});

const DRAFT_PUBLISHER_SCHEMA = z.object({ publisherQuery: z.string() });

let duplicateCandidates: PublisherDuplicateCandidate[] = [];
let duplicateLookupStatus = 200;

function candidate({
  matchedName,
  matchKind,
  publisher,
}: {
  matchedName: PublisherDuplicateCandidate["matchedName"];
  matchKind: PublisherDuplicateCandidate["matchKind"];
  publisher: { id: string; name: string };
}): PublisherDuplicateCandidate {
  return { id: publisher.id, isCustom: false, matchedName, matchKind, name: publisher.name };
}

function createdBookRequest() {
  return fetchMock.mock.calls.find(
    ([input, init]) => String(input).includes("/api/books") && init?.method === "POST",
  );
}

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

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText("Назва"), "Тестова книга");
  const authorInput = screen.getByPlaceholderText("Почніть вводити імʼя автора…");
  await userEvent.click(authorInput);
  await userEvent.type(authorInput, "Тест Автор");
  await userEvent.click(await screen.findByText("Створити «Тест Автор»"));
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
    if (path.includes("/api/publishers/duplicate-candidates")) {
      if (duplicateLookupStatus !== 200) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "boom" }), {
            headers: { "Content-Type": "application/json" },
            status: duplicateLookupStatus,
          }),
        );
      }
      return Promise.resolve(jsonResponse(duplicateCandidates));
    }
    if (path.includes("/api/books") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(makeBookView({ id: "book-created" })));
    }
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

async function submitBook() {
  await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
}

function submittedPublisher() {
  const request = createdBookRequest();
  if (request === undefined) throw new Error("no book was submitted");
  const body = request[1]?.body;
  if (typeof body !== "string") throw new Error("the submitted book has no JSON body");
  return SUBMITTED_PUBLISHER_SCHEMA.parse(JSON.parse(body));
}

async function typePublisher(name: string) {
  await userEvent.click(publisherInput());
  await userEvent.type(publisherInput(), name);
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
  duplicateCandidates = [];
  duplicateLookupStatus = 200;
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

describe("BookForm publisher submit gate", () => {
  it("submits without a publisher when nothing was typed", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await submitBook();

    await waitFor(() => expect(createdBookRequest()).toBeDefined());
    expect(submittedPublisher()).toEqual({});
  });

  it("resolves typed text that matches exactly one existing publisher and keeps submitting", async () => {
    duplicateCandidates = [candidate({ matchedName: "Час", matchKind: "alias", publisher: CHAS })];
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await typePublisher("Час");
    await submitBook();

    await waitFor(() => expect(createdBookRequest()).toBeDefined());
    expect(submittedPublisher()).toEqual({ publisherId: CHAS.id });
    expect(publisherInput()).toHaveValue(CHAS.name);
  });

  it("stops the submit when the typed text matches several existing publishers", async () => {
    duplicateCandidates = [
      candidate({ matchedName: CHAS.name, matchKind: "exact", publisher: CHAS }),
      candidate({ matchedName: "Час", matchKind: "alias", publisher: CHASOPYS }),
    ];
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await typePublisher("Час");
    await submitBook();

    expect(
      await screen.findByText(
        "Ця назва збігається з кількома видавництвами. Оберіть потрібне зі списку.",
      ),
    ).toBeInTheDocument();
    expect(createdBookRequest()).toBeUndefined();
    expect(publisherInput()).toHaveFocus();
    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
  });

  it("stops the submit when only similar publishers were found", async () => {
    duplicateCandidates = [
      candidate({ matchedName: null, matchKind: "strong", publisher: CHASOPYS }),
    ];
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await typePublisher("Час");
    await submitBook();

    expect(
      await screen.findByText(
        "Оберіть видавництво зі списку або підтвердьте, що «Час» — це нове видавництво.",
      ),
    ).toBeInTheDocument();
    expect(createdBookRequest()).toBeUndefined();
    expect(publisherInput()).toHaveFocus();
    expect(await screen.findByText("Усе одно додати «Час» як власне")).toBeInTheDocument();
  });

  it("stops the submit until the user confirms an unknown publisher", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await typePublisher("Час");
    await submitBook();

    expect(
      await screen.findByText(
        "Видавництва «Час» ще немає. Підтвердьте його створення у списку підказок.",
      ),
    ).toBeInTheDocument();
    expect(createdBookRequest()).toBeUndefined();

    await userEvent.click(await screen.findByText("Використати «Час»"));
    await submitBook();

    await waitFor(() => expect(createdBookRequest()).toBeDefined());
    expect(submittedPublisher()).toEqual({ publisherName: "Час" });
  });

  it("stops the submit when the duplicate lookup fails", async () => {
    duplicateLookupStatus = 500;
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await typePublisher("Час");
    await submitBook();

    expect(
      await screen.findByText("Не вдалося перевірити видавництво. Спробуйте ще раз."),
    ).toBeInTheDocument();
    expect(createdBookRequest()).toBeUndefined();
  });

  it("keeps the typed publisher in the draft so an interface language switch does not lose it", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await typePublisher("Час");

    await waitFor(() => {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw === null) throw new Error("the draft was not persisted");
      expect(DRAFT_PUBLISHER_SCHEMA.parse(JSON.parse(raw)).publisherQuery).toBe("Час");
    });
  });

  it("guards the same way in edit mode, starting from the publisher of the edited book", async () => {
    renderWithProviders(<BookForm book={makeBookView()} mode="edit" />);

    expect(publisherInput()).toHaveValue("Клуб Сімейного Дозвілля");

    await userEvent.click(within(publisherField()).getByRole("button", { name: "Очистити" }));
    await typePublisher("Час");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    expect(
      await screen.findByText(
        "Видавництва «Час» ще немає. Підтвердьте його створення у списку підказок.",
      ),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH" || init?.method === "PUT"),
    ).toBeUndefined();
  });
});

describe("BookForm discard confirmations", () => {
  it("offers to leave the form instead of changing a field", async () => {
    renderWithProviders(<BookForm book={makeBookView()} mode="edit" />);

    await userEvent.type(screen.getByLabelText("Назва"), " (чернетка)");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Скасувати зміни?")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Так, вийти" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Продовжити редагування" })).toBeInTheDocument();
  });

  it("keeps the change wording when a field change clears data", async () => {
    renderWithProviders(<BookForm book={seriesBook(witcher(null))} mode="edit" />);

    await userEvent.click(screen.getByRole("radio", { name: "Окрема книга" }));

    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText("Прибрати книгу із серії?")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Так, змінити" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Залишити як є" })).toBeInTheDocument();
  });
});
