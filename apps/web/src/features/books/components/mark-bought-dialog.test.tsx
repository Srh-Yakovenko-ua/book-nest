import "@testing-library/jest-dom/vitest";

import type { BookStoreLinksView } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { subDays } from "date-fns";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeStoreLink } from "@/features/books-to-buy/model/books-to-buy.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { MarkBoughtDialog } from "./mark-bought-dialog";

const TODAY = new Date(2026, 7, 1, 9, 0, 0);
const TODAY_ISO = "2026-08-01";

const book = makeBookView({ ownershipStatus: "want_to_buy", purchaseInfo: null });

const readeat = makeStoreLink({
  bookId: book.id,
  id: "link-readeat",
  price: 449,
  storeName: "Readeat",
  url: "https://readeat.com/last-wish",
});
const yakaboo = makeStoreLink({
  bookId: book.id,
  currency: "USD",
  id: "link-yakaboo",
  price: 20,
  storeName: "Yakaboo",
  url: "https://yakaboo.ua/last-wish",
});
const bookYe = makeStoreLink({
  bookId: book.id,
  currency: null,
  id: "link-book-ye",
  price: null,
  storeName: "Книгарня «Є»",
  url: "https://book-ye.com.ua/last-wish",
});

const trackedLinks: BookStoreLinksView = {
  bestOffer: { currency: "UAH", price: 449 },
  storeLinks: [yakaboo, readeat, bookYe],
};

const RADIO_NAMES = {
  bookYe: "Книгарня «Є» ціна не вказана",
  other: "Інше місце",
  readeat: "Readeat 449 грн",
  yakaboo: "Yakaboo 20 $",
} as const;

const fetchMock = vi.fn();

let respondToStoreLinks: () => Response;
let respondToMarkBought: () => Response;

function currencyTrigger() {
  return screen.getByRole("combobox", { name: "Валюта" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function markBoughtCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}/ownership/mark-bought`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function markBoughtPayload() {
  return JSON.parse(String(markBoughtCall()?.[1].body)) as unknown;
}

function priceInput() {
  return screen.getByLabelText("Ціна");
}

async function renderDialog(links: BookStoreLinksView = trackedLinks, onOpenChange = vi.fn()) {
  respondToStoreLinks = () => jsonResponse(links);
  renderWithProviders(<MarkBoughtDialog book={book} onOpenChange={onOpenChange} open />);
  await screen.findByLabelText("Ціна");
}

async function submitDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Підтвердити" }));
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  respondToStoreLinks = () => jsonResponse(trackedLinks);
  respondToMarkBought = () => jsonResponse(makeBookView({ ownershipStatus: "owned" }));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes(`/api/books/${book.id}/store-links`) && method === "GET")
      return Promise.resolve(respondToStoreLinks());
    if (url.includes("/api/books/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes("/ownership/mark-bought") && method === "POST")
      return Promise.resolve(respondToMarkBought());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MarkBoughtDialog source options", () => {
  it("lists every tracked store with its price and preselects the cheapest", async () => {
    await renderDialog();

    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: RADIO_NAMES.yakaboo })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: RADIO_NAMES.bookYe })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: RADIO_NAMES.readeat })).toBeChecked();
    expect(screen.getByRole("radio", { name: RADIO_NAMES.other })).not.toBeChecked();
  });

  it("names the source picker for assistive technology", async () => {
    await renderDialog();

    expect(screen.getByRole("radiogroup", { name: "Де ви купили книгу?" })).toBeInTheDocument();
  });

  it("prefills the price and the currency of the picked store", async () => {
    await renderDialog();

    expect(priceInput()).toHaveValue(449);

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.yakaboo }));

    expect(priceInput()).toHaveValue(20);
    expect(currencyTrigger()).toHaveTextContent("USD");

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.bookYe }));

    expect(priceInput()).toHaveValue(null);
    expect(currencyTrigger()).toHaveTextContent("UAH");
  });

  it("reveals the manual store field when the book was bought somewhere else", async () => {
    await renderDialog();

    expect(screen.queryByLabelText("Магазин")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.other }));

    expect(screen.getByLabelText("Магазин")).toBeInTheDocument();
  });

  it("drops the price of the store you leave behind for another place", async () => {
    await renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.yakaboo }));

    expect(priceInput()).toHaveValue(20);
    expect(currencyTrigger()).toHaveTextContent("USD");

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.other }));

    expect(priceInput()).toHaveValue(null);
    expect(currencyTrigger()).toHaveTextContent("UAH");
  });

  it("skips the source picker when the book has no tracked links", async () => {
    await renderDialog({ bestOffer: null, storeLinks: [] });

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Магазин")).toBeInTheDocument();
  });

  it("warns when the tracked stores could not be loaded", async () => {
    respondToStoreLinks = () => jsonResponse({ message: "boom" }, 500);
    renderWithProviders(<MarkBoughtDialog book={book} onOpenChange={vi.fn()} open />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити збережені магазини",
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Магазин")).toBeInTheDocument();
  });

  it("keeps the legacy purchase plan as the manual default", async () => {
    respondToStoreLinks = () => jsonResponse({ bestOffer: null, storeLinks: [] });
    const legacyBook = makeBookView({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 310,
        note: null,
        purchasedAt: null,
        storeName: "Книгарня «Є»",
        storeUrl: null,
      },
    });
    renderWithProviders(<MarkBoughtDialog book={legacyBook} onOpenChange={vi.fn()} open />);

    expect(await screen.findByLabelText("Магазин")).toHaveValue("Книгарня «Є»");
    expect(priceInput()).toHaveValue(310);
  });
});

describe("MarkBoughtDialog payload", () => {
  it("posts the store name of the selected link verbatim", async () => {
    const onOpenChange = vi.fn();
    await renderDialog(trackedLinks, onOpenChange);

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.yakaboo }));
    await submitDialog();

    await waitFor(() => expect(markBoughtCall()).toBeDefined());
    expect(markBoughtPayload()).toEqual({
      currency: "USD",
      expectedPrice: 20,
      purchasedAt: TODAY_ISO,
      storeName: "Yakaboo",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("posts an edited price together with the selected store", async () => {
    await renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.yakaboo }));
    await userEvent.clear(priceInput());
    await userEvent.type(priceInput(), "380");
    await submitDialog();

    await waitFor(() => expect(markBoughtCall()).toBeDefined());
    expect(markBoughtPayload()).toEqual({
      currency: "USD",
      expectedPrice: 380,
      purchasedAt: TODAY_ISO,
      storeName: "Yakaboo",
    });
  });

  it("posts the manually typed store", async () => {
    await renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: RADIO_NAMES.other }));
    await userEvent.type(screen.getByLabelText("Магазин"), "Книгарня біля дому");
    await userEvent.type(priceInput(), "500");
    await submitDialog();

    await waitFor(() => expect(markBoughtCall()).toBeDefined());
    expect(markBoughtPayload()).toEqual({
      currency: "UAH",
      expectedPrice: 500,
      purchasedAt: TODAY_ISO,
      storeName: "Книгарня біля дому",
    });
  });
});

describe("MarkBoughtDialog validation", () => {
  it("refuses a purchase date that is in the future", async () => {
    await renderDialog();

    vi.setSystemTime(subDays(TODAY, 2));
    await submitDialog();

    expect(await screen.findByText("Дата не може бути в майбутньому.")).toBeInTheDocument();
    expect(markBoughtCall()).toBeUndefined();
  });
});
