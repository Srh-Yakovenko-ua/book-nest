import "@testing-library/jest-dom/vitest";

import type { BookView, Nullable } from "@app/shared";

import { act } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { BookSelectOption } from "../model/book-select-option";
import type { BookSingleSelectPickerLabels } from "./book-single-select-picker";

import { makeBookView } from "./book-details.fixtures";
import { BookSingleSelectPicker } from "./book-single-select-picker";

const LABELS: BookSingleSelectPickerLabels = {
  change: "Змінити",
  collapse: "Згорнути",
  empty: "Книг не знайдено",
  loadError: "Не вдалося завантажити книги",
  loading: "Шукаємо книги...",
  results: "Ваші книги",
  resultsCount: (count: number) => `Показано ${count} книг`,
  search: "Пошук за назвою або автором",
};

const PICKER_FIELD_LABEL = "Книга";

const bookOptionName = (index: number) => `Книга ${index} Автор ${index}`;

const LIST_METRICS = { clientHeight: 240, scrollHeight: 1200 } as const;
const MEASURED_PROPERTIES = ["clientHeight", "scrollHeight", "scrollTop"] as const;

const fetchMock = vi.fn();
const onChange = vi.fn();

let respondToBooks: (params: URLSearchParams) => Response;
let scrollTop = 0;
let restoreMetrics: () => void = () => undefined;

async function bookRow(index: number): Promise<HTMLElement> {
  return screen.findByRole("radio", { name: bookOptionName(index) });
}

function booksPage(items: BookView[], page = 1, pagesCount = 1): Response {
  return new Response(
    JSON.stringify({
      items,
      page,
      pagesCount,
      pageSize: 20,
      totalCount: pagesCount * 20,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

async function holdArrowDown() {
  await userEvent.keyboard("{ArrowDown>}");
  await userEvent.keyboard("{/ArrowDown}");
}

function listParams(): URLSearchParams[] {
  return fetchMock.mock.calls.map(
    ([input]) => new URL(String(input), "http://localhost").searchParams,
  );
}

function makeBook(index: number): BookView {
  return makeBookView({
    authors: [{ id: `author-${index}`, name: `Автор ${index}` }],
    id: `book-${index}`,
    title: `Книга ${index}`,
  });
}

function PickerHarness({
  initialValue = null,
  required = false,
}: {
  initialValue?: Nullable<BookSelectOption>;
  required?: boolean;
}) {
  const [value, setValue] = useState<Nullable<BookSelectOption>>(initialValue);

  return (
    <>
      <label htmlFor="picker" id="picker-label">
        Книга
      </label>
      <BookSingleSelectPicker
        id="picker"
        labelledBy="picker-label"
        labels={LABELS}
        onChange={(book) => {
          onChange(book);
          setValue(toOption(book));
        }}
        required={required}
        value={value}
      />
      <button type="button">Наступне поле</button>
    </>
  );
}

async function scrollListToBottom() {
  const wheel = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: LIST_METRICS.scrollHeight - LIST_METRICS.clientHeight,
  });

  await act(async () => {
    screen.getByRole("radiogroup").dispatchEvent(wheel);
  });
}

function searchInput(): HTMLElement {
  return screen.getByRole("textbox", { name: LABELS.search });
}

async function selectBook(index: number) {
  await userEvent.click(await bookRow(index));
}

function stubListMetrics() {
  const original = MEASURED_PROPERTIES.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => LIST_METRICS.clientHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => LIST_METRICS.scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (next: number) => {
      scrollTop = next;
    },
  });

  restoreMetrics = () => {
    for (const [name, descriptor] of original) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
}

function toOption(book: BookView): BookSelectOption {
  return {
    authorName: book.authors[0]?.name ?? "",
    cover: book.cover ?? null,
    id: book.id,
    title: book.title,
  };
}

beforeEach(() => {
  scrollTop = 0;
  stubListMetrics();

  respondToBooks = () => booksPage([makeBook(1), makeBook(2)]);

  onChange.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.startsWith("/api/books?")) return Promise.reject(new Error(`unexpected GET ${url}`));
    return Promise.resolve(respondToBooks(new URL(url, "http://localhost").searchParams));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
  vi.unstubAllGlobals();
});

describe("BookSingleSelectPicker query params", () => {
  it("asks the library for the first page sorted by title", async () => {
    renderWithProviders(<PickerHarness />);

    await screen.findByRole("radio", { name: bookOptionName(1) });

    const [first] = listParams();
    if (first === undefined) throw new Error("no library request was sent");
    expect(first.get("sort")).toBe("title_asc");
    expect(first.get("pageSize")).toBe("20");
    expect(first.get("pageNumber")).toBe("1");
    expect(first.get("q")).toBeNull();
  });

  it("sends the typed search to the backend once the debounce elapses", async () => {
    renderWithProviders(<PickerHarness />);
    await screen.findByRole("radio", { name: bookOptionName(1) });

    await userEvent.type(searchInput(), "Дюна");

    await waitFor(() => expect(listParams().map((params) => params.get("q"))).toContain("Дюна"));
  });
});

describe("BookSingleSelectPicker results", () => {
  it("renders the empty copy once when the library returns nothing", async () => {
    respondToBooks = () => booksPage([]);

    renderWithProviders(<PickerHarness />);

    await screen.findByText("Книг не знайдено");
    expect(screen.getAllByText("Книг не знайдено")).toHaveLength(1);
  });

  it("shows the load error when the library request fails", async () => {
    respondToBooks = () => new Response("boom", { status: 500 });

    renderWithProviders(<PickerHarness />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося завантажити книги");
  });
});

describe("BookSingleSelectPicker selection independence", () => {
  it("keeps the selected book when a new search replaces the results", async () => {
    renderWithProviders(<PickerHarness />);
    await selectBook(1);
    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));

    respondToBooks = () => booksPage([makeBook(3)]);
    await userEvent.type(searchInput(), "Дюна");
    await screen.findByRole("radio", { name: bookOptionName(3) });

    expect(onChange).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: LABELS.collapse }));
    expect(screen.getByText("Книга 1")).toBeInTheDocument();
  });

  it("keeps the selected book when the search is cleared", async () => {
    renderWithProviders(<PickerHarness />);
    await selectBook(1);
    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));
    await userEvent.type(searchInput(), "Дюна");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(searchInput()).toHaveValue("");
    expect(await screen.findByRole("radio", { name: bookOptionName(1) })).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not write the picked title into the search field", async () => {
    renderWithProviders(<PickerHarness />);
    await screen.findByRole("radio", { name: bookOptionName(1) });
    await userEvent.type(searchInput(), "Кни");

    await selectBook(1);
    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));

    expect(searchInput()).toHaveValue("Кни");
  });

  it("collapses to the selected book and reopens the list on Змінити", async () => {
    renderWithProviders(<PickerHarness />);

    await selectBook(1);

    expect(screen.queryByRole("textbox", { name: LABELS.search })).not.toBeInTheDocument();
    expect(screen.getByText("Книга 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));
    expect(searchInput()).toBeInTheDocument();
  });
});

describe("BookSingleSelectPicker paging", () => {
  it("appends the next page when the list is scrolled to the bottom", async () => {
    const firstPage = [makeBook(1), makeBook(2)];
    const secondPage = [makeBook(21), makeBook(22)];
    respondToBooks = (params) =>
      params.get("pageNumber") === "2" ? booksPage(secondPage, 2, 2) : booksPage(firstPage, 1, 2);

    renderWithProviders(<PickerHarness />);
    await screen.findByRole("radio", { name: bookOptionName(1) });

    expect(
      screen.queryByRole("button", { name: /показати ще|завантажити ще/i }),
    ).not.toBeInTheDocument();
    expect(listParams()).toHaveLength(1);

    await scrollListToBottom();

    await screen.findByRole("radio", { name: bookOptionName(21) });
    expect(screen.getByRole("radio", { name: bookOptionName(1) })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("drops the previous search rows when the search changes", async () => {
    respondToBooks = (params) =>
      params.get("q") === null ? booksPage([makeBook(1), makeBook(2)]) : booksPage([makeBook(3)]);

    renderWithProviders(<PickerHarness />);
    await screen.findByRole("radio", { name: bookOptionName(1) });

    await userEvent.type(searchInput(), "Книга 3");

    await screen.findByRole("radio", { name: bookOptionName(3) });
    expect(screen.queryByRole("radio", { name: bookOptionName(1) })).not.toBeInTheDocument();
    expect(screen.queryByText("Книга 2")).not.toBeInTheDocument();
  });
});

describe("BookSingleSelectPicker keyboard browsing", () => {
  it("keeps the list open while the arrow keys move through the rows", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);

    await userEvent.tab();
    await userEvent.tab();
    await holdArrowDown();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(searchInput()).toBeInTheDocument();
    expect(await bookRow(2)).toHaveFocus();
  });

  it("moves focus to the change button when a row is picked with the pointer", async () => {
    renderWithProviders(<PickerHarness />);

    await selectBook(1);

    expect(screen.getByRole("button", { name: LABELS.change })).toHaveFocus();
  });

  it("moves focus into the search field when the selection is reopened", async () => {
    renderWithProviders(<PickerHarness />);
    await selectBook(1);

    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));

    expect(searchInput()).toHaveFocus();
  });

  it("collapses to the selected book once focus leaves the picker", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);

    await userEvent.tab();
    await userEvent.tab();
    await holdArrowDown();
    await userEvent.click(screen.getByRole("button", { name: "Наступне поле" }));

    expect(screen.queryByRole("textbox", { name: LABELS.search })).not.toBeInTheDocument();
    expect(screen.getByText("Книга 2")).toBeInTheDocument();
  });
});

describe("BookSingleSelectPicker announcements", () => {
  it("names the search field by its purpose, not by the group label", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);

    const group = screen.getByRole("group", { name: PICKER_FIELD_LABEL });
    expect(group).toContainElement(searchInput());
  });

  it("mounts the live region empty, before anything it must announce", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces the search while the stale rows stay in the list", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);
    respondToBooks = () => booksPage([makeBook(3)]);

    await userEvent.type(searchInput(), "Дюна");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Шукаємо книги..."));
    expect(screen.getByRole("radio", { name: bookOptionName(1) })).toBeInTheDocument();
  });

  it("announces the grown result count after an infinite-scroll append", async () => {
    const firstPage = [makeBook(1), makeBook(2)];
    const secondPage = [makeBook(21), makeBook(22)];
    respondToBooks = (params) =>
      params.get("pageNumber") === "2" ? booksPage(secondPage, 2, 2) : booksPage(firstPage, 1, 2);

    renderWithProviders(<PickerHarness />);
    await bookRow(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await scrollListToBottom();

    await screen.findByRole("radio", { name: bookOptionName(21) });
    expect(screen.getByRole("status")).toHaveTextContent("Показано 4 книг");
  });
});

describe("BookSingleSelectPicker required state", () => {
  it("tells assistive tech the radiogroup must be answered", async () => {
    renderWithProviders(<PickerHarness required />);
    await bookRow(1);

    expect(screen.getByRole("radiogroup", { name: LABELS.results })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("leaves the radiogroup optional when the field is not required", async () => {
    renderWithProviders(<PickerHarness />);
    await bookRow(1);

    expect(screen.getByRole("radiogroup", { name: LABELS.results })).toHaveAttribute(
      "aria-required",
      "false",
    );
  });
});

describe("BookSingleSelectPicker collapsed value", () => {
  it("describes the change button with the selected book", async () => {
    renderWithProviders(<PickerHarness />);

    await selectBook(1);

    expect(screen.getByRole("button", { name: LABELS.change })).toHaveAccessibleDescription(
      /Книга 1/,
    );
  });
});
