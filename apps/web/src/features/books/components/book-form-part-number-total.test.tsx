import "@testing-library/jest-dom/vitest";
import { BOOK_SERIES_ERROR_CODES } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { BookFormInitialSeries } from "../model/create-book-form";

import { makeBookView } from "./book-details.fixtures";
import { BookForm } from "./book-form";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const bookTypeCopy = messages.books.bookType;

const SERVER_PART_NUMBER_MESSAGE = "Part 2 is past the last book of this series";

const WITCHER: BookFormInitialSeries = {
  partNumber: 2,
  selection: {
    authors: [],
    commonGenres: [],
    dominantPublisher: null,
    genres: [],
    id: "66666666-6666-4666-8666-666666666666",
    kind: "existing",
    name: "Відьмак",
  },
};

let respondToCreate: () => Response;

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText("Назва"), "Тестова книга");
  const authorInput = screen.getByPlaceholderText("Почніть вводити імʼя автора…");
  await userEvent.click(authorInput);
  await userEvent.type(authorInput, "Тест Автор");
  await userEvent.click(await screen.findByText("Створити «Тест Автор»"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
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

async function submitBook() {
  await userEvent.click(screen.getByRole("button", { name: messages.books.actions.submit }));
}

beforeEach(() => {
  sessionStorage.clear();
  respondToCreate = () => jsonResponse(makeBookView({ id: "book-created" }));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const path = String(input);
    if (path.includes("/api/books") && init?.method === "POST") {
      return Promise.resolve(respondToCreate());
    }
    if (path.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (path.includes("/api/publishers/recent")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(page([]));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookForm part number above the series total", () => {
  it("shows the localized limit when a new series holds fewer books than the part number", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("radio", { name: bookTypeCopy.options.series_part }));
    await userEvent.type(screen.getByLabelText(bookTypeCopy.series), "Нова сага");
    await userEvent.click(await screen.findByText("Створити «Нова сага»"));

    const seriesDialog = await screen.findByRole("dialog", {
      name: messages.books.series.create.title,
    });
    await userEvent.type(within(seriesDialog).getByLabelText(/Книг у серії/), "3");
    await userEvent.click(
      within(seriesDialog).getByRole("button", { name: messages.books.series.create.confirm }),
    );
    await screen.findByText("Нова серія «Нова сага» буде створена при збереженні.");

    await userEvent.click(screen.getByRole("spinbutton", { name: bookTypeCopy.partNumber }));
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    await submitBook();

    expect(await screen.findByText(bookTypeCopy.errors.exceedsTotal)).toBeInTheDocument();
  });

  it("shows the localized limit for a server part number error worded differently", async () => {
    respondToCreate = () =>
      jsonResponse(
        {
          errorsMessages: [
            {
              code: BOOK_SERIES_ERROR_CODES.partNumberExceedsTotal,
              field: "partNumber",
              message: SERVER_PART_NUMBER_MESSAGE,
            },
          ],
        },
        400,
      );

    renderWithProviders(<BookForm initialSeries={WITCHER} mode="create" />);

    await fillRequiredFields();
    await submitBook();

    expect(await screen.findByText(bookTypeCopy.errors.exceedsTotal)).toBeInTheDocument();
    expect(screen.queryByText(SERVER_PART_NUMBER_MESSAGE)).not.toBeInTheDocument();
  });
});
