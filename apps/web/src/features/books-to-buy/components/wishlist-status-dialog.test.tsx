import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeStoreLink, makeWishlistBook } from "../model/books-to-buy.fixtures";
import { WishlistStatusDialog } from "./wishlist-status-dialog";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const TODAY_ISO = "2026-08-15";

const readeat = makeStoreLink({
  id: "link-readeat",
  price: 449,
  storeName: "Readeat",
  url: "https://readeat.com/last-wish",
});
const yakaboo = makeStoreLink({
  currency: "USD",
  id: "link-yakaboo",
  price: 20,
  storeName: "Yakaboo",
  url: "https://yakaboo.ua/last-wish",
});

const book = makeWishlistBook({
  bestOffer: { currency: "UAH", price: 449 },
  purchaseInfo: null,
  storeLinks: [yakaboo, readeat],
  title: "Останнє бажання",
});

const OPTIONS = {
  bought: "Куплено",
  dropped: "Більше не цікавить",
  ordered: "Замовлено, у дорозі",
  received: "Отримано інакше",
} as const;

const STORE_RADIOS = {
  other: "Інше місце",
  readeat: "Readeat 449 грн",
  yakaboo: "Yakaboo 20 $",
} as const;

const fetchMock = vi.fn();
const onOpenChange = vi.fn();

let respondToMarkBought: () => Response;
let respondToCreateDelivery: () => Response;
let respondToMarkOwned: () => Response;
let respondToRemove: () => Response;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

function calendarDay(day: string) {
  return within(screen.getByRole("grid")).getByText(day);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openDatePicker(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

function optionRadio(option: keyof typeof OPTIONS) {
  return screen.getByRole("radio", { name: OPTIONS[option] });
}

async function pickOption(option: keyof typeof OPTIONS) {
  await userEvent.click(optionRadio(option));
}

function postCall(path: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}${path}`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function postPayload(path: string) {
  return JSON.parse(String(postCall(path)?.[1].body)) as unknown;
}

function priceInput() {
  return screen.getByLabelText("Ціна");
}

function renderDialog() {
  renderWithProviders(<WishlistStatusDialog book={book} onOpenChange={onOpenChange} open />);
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
  respondToMarkBought = () => jsonResponse(makeBookView({ id: book.id, ownershipStatus: "owned" }));
  respondToCreateDelivery = () =>
    jsonResponse(makeBookView({ id: book.id, ownershipStatus: "in_transit" }));
  respondToMarkOwned = () => jsonResponse(makeBookView({ id: book.id, ownershipStatus: "owned" }));
  respondToRemove = () => jsonResponse(makeBookView({ id: book.id, ownershipStatus: "none" }));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/books/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes("/ownership/mark-bought") && method === "POST")
      return Promise.resolve(respondToMarkBought());
    if (url.includes("/ownership/mark-owned") && method === "POST")
      return Promise.resolve(respondToMarkOwned());
    if (url.includes("/ownership/remove-from-wishlist") && method === "POST")
      return Promise.resolve(respondToRemove());
    if (url.includes("/deliveries") && method === "POST")
      return Promise.resolve(respondToCreateDelivery());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WishlistStatusDialog options", () => {
  it("asks one question and offers the four transitions with the purchase preselected", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Що сталося з книгою?" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Що сталося з книгою?" })).toBeInTheDocument();
    expect(optionRadio("bought")).toBeChecked();
    expect(optionRadio("ordered")).not.toBeChecked();
    expect(optionRadio("received")).not.toBeChecked();
    expect(optionRadio("dropped")).not.toBeChecked();
  });

  it("lands the focus on the preselected option when it opens", async () => {
    renderDialog();

    await waitFor(() => expect(optionRadio("bought")).toHaveFocus());
  });

  it("reads the destination of every option together with its label", () => {
    renderDialog();

    expect(optionRadio("bought")).toHaveAccessibleDescription(
      "Книга перейде в наявні. Магазин, ціну й дату покупки буде збережено",
    );
    expect(optionRadio("ordered")).toHaveAccessibleDescription(
      "Книга перейде в доставки — статус можна буде відстежувати там",
    );
    expect(optionRadio("received")).toHaveAccessibleDescription(
      "Подарунок або інше джерело. Книга перейде в наявні, покупку не записуємо",
    );
    expect(optionRadio("dropped")).toHaveAccessibleDescription(
      "Книга залишиться в бібліотеці, а статус володіння стане «Не вказано»",
    );
  });

  it("expands only the sub-form of the selected option", async () => {
    renderDialog();

    expect(screen.getByRole("radio", { name: STORE_RADIOS.readeat })).toBeChecked();
    expect(screen.queryByLabelText("Дата замовлення")).not.toBeInTheDocument();

    await pickOption("ordered");

    expect(screen.getByLabelText("Дата замовлення")).toBeInTheDocument();
    expect(screen.queryByLabelText("Дата покупки")).not.toBeInTheDocument();

    await pickOption("received");

    expect(screen.queryByRole("radio", { name: STORE_RADIOS.readeat })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ціна")).not.toBeInTheDocument();
  });
});

describe("WishlistStatusDialog bought branch", () => {
  it("posts the store name of the selected link verbatim", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: STORE_RADIOS.yakaboo }));
    await submitDialog();

    await waitFor(() => expect(postCall("/ownership/mark-bought")).toBeDefined());
    expect(postPayload("/ownership/mark-bought")).toEqual({
      currency: "USD",
      expectedPrice: 20,
      purchasedAt: TODAY_ISO,
      storeName: "Yakaboo",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("posts an edited price together with the selected store", async () => {
    renderDialog();

    await userEvent.clear(priceInput());
    await userEvent.type(priceInput(), "380");
    await submitDialog();

    await waitFor(() => expect(postCall("/ownership/mark-bought")).toBeDefined());
    expect(postPayload("/ownership/mark-bought")).toEqual({
      currency: "UAH",
      expectedPrice: 380,
      purchasedAt: TODAY_ISO,
      storeName: "Readeat",
    });
  });

  it("drops the price of the store you leave behind for another place", async () => {
    renderDialog();

    expect(priceInput()).toHaveValue(449);

    await userEvent.click(screen.getByRole("radio", { name: STORE_RADIOS.other }));

    expect(priceInput()).toHaveValue(null);
    expect(screen.getByLabelText("Магазин")).toHaveValue("");
  });
});

describe("WishlistStatusDialog ordered branch", () => {
  it("refuses an order without its order date", async () => {
    renderDialog();

    await pickOption("ordered");
    await openDatePicker("Дата замовлення");
    await userEvent.click(calendarDay("15"));
    await userEvent.keyboard("{Escape}");
    await submitDialog();

    expect(await screen.findByText("Оберіть дату замовлення.")).toBeInTheDocument();
    expect(postCall("/deliveries")).toBeUndefined();
  });

  it("refuses a delivery expected before the order was placed", async () => {
    renderDialog();

    await pickOption("ordered");
    await openDatePicker("Очікувана доставка");
    await userEvent.click(calendarDay("10"));
    await submitDialog();

    expect(
      await screen.findByText("Доставка не може бути раніше за дату замовлення."),
    ).toBeInTheDocument();
    expect(postCall("/deliveries")).toBeUndefined();
  });

  it("creates the delivery with the picked store and the order date", async () => {
    renderDialog();

    await pickOption("ordered");
    await submitDialog();

    await waitFor(() => expect(postCall("/deliveries")).toBeDefined());
    expect(postPayload("/deliveries")).toEqual({
      currency: "UAH",
      isFree: false,
      orderDate: TODAY_ISO,
      price: 449,
      storeName: "Readeat",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces the conflict message when the book already has an active delivery", async () => {
    respondToCreateDelivery = () =>
      jsonResponse({ message: "Ця книга вже має активну доставку" }, 409);
    renderDialog();

    await pickOption("ordered");
    await submitDialog();

    expect(await screen.findByText("Ця книга вже має активну доставку")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Що сталося з книгою?" })).toBeInTheDocument();
  });
});

describe("WishlistStatusDialog direct branches", () => {
  it("moves the book to the shelf without recording a purchase", async () => {
    renderDialog();

    await pickOption("received");
    await submitDialog();

    await waitFor(() => expect(postCall("/ownership/mark-owned")).toBeDefined());
    expect(postCall("/ownership/mark-owned")?.[1].body).toBeUndefined();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("drops the book from the wishlist without a second confirmation", async () => {
    renderDialog();

    await pickOption("dropped");
    await submitDialog();

    await waitFor(() => expect(postCall("/ownership/remove-from-wishlist")).toBeDefined());
    expect(postCall("/ownership/remove-from-wishlist")?.[1].body).toBeUndefined();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and explains a failed update", async () => {
    respondToMarkOwned = () => jsonResponse({ message: "boom" }, 500);
    renderDialog();

    await pickOption("received");
    await submitDialog();

    expect(await screen.findByText("Не вдалося оновити статус книги")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Що сталося з книгою?" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("tells that the book already left the wishlist", async () => {
    respondToRemove = () => jsonResponse({ code: "NOT_IN_WISHLIST", message: "gone" }, 409);
    renderDialog();

    await pickOption("dropped");
    await submitDialog();

    expect(await screen.findByText("Ця книга більше не в списку бажань")).toBeInTheDocument();
  });
});
