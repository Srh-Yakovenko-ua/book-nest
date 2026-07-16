import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeStoreLink, makeWishlistBook } from "../model/books-to-buy.fixtures";
import { StoreLinkDialog } from "./store-link-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const book = makeWishlistBook();
const fetchMock = vi.fn();

let respondToSave: () => Response;

function editCall() {
  return storeLinkCall("PATCH");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderCreateDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(
    <StoreLinkDialog book={book} mode="create" onOpenChange={onOpenChange} open />,
  );
}

function saveCall() {
  return storeLinkCall("POST");
}

function savedPayload() {
  return JSON.parse(String(saveCall()?.[1].body)) as unknown;
}

function storeLinkCall(method: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}/store-links`) &&
      (init?.method ?? "GET").toUpperCase() === method,
  ) as [string, RequestInit] | undefined;
}

async function typeStoreAndUrl(url = "https://yakaboo.ua/book") {
  await userEvent.type(screen.getByLabelText("Магазин"), "Yakaboo");
  await userEvent.type(screen.getByLabelText("Посилання"), url);
}

beforeEach(() => {
  respondToSave = () => jsonResponse(makeStoreLink());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/books/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (
      url.includes(`/api/books/${book.id}/store-links`) &&
      (method === "POST" || method === "PATCH")
    )
      return Promise.resolve(respondToSave());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StoreLinkDialog validation", () => {
  it("refuses a store link that is not served over https", async () => {
    renderCreateDialog();

    await typeStoreAndUrl("http://yakaboo.ua/book");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Посилання має починатися з https://")).toBeInTheDocument();
    expect(saveCall()).toBeUndefined();
  });

  it("requires a store link at all", async () => {
    renderCreateDialog();

    await userEvent.type(screen.getByLabelText("Магазин"), "Yakaboo");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Додайте посилання на магазин")).toBeInTheDocument();
    expect(saveCall()).toBeUndefined();
  });

  it("requires a store name", async () => {
    renderCreateDialog();

    await userEvent.type(screen.getByLabelText("Посилання"), "https://yakaboo.ua/book");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Оберіть магазин")).toBeInTheDocument();
    expect(saveCall()).toBeUndefined();
  });

  it("refuses a price of zero", async () => {
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.type(screen.getByLabelText("Ціна"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Ціна має бути більшою за 0")).toBeInTheDocument();
    expect(saveCall()).toBeUndefined();
  });
});

describe("StoreLinkDialog payload", () => {
  it("sends the trimmed store, url, price and currency", async () => {
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.type(screen.getByLabelText("Ціна"), "450");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await waitFor(() => expect(saveCall()).toBeDefined());
    expect(savedPayload()).toEqual({
      currency: "UAH",
      price: 450,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/book",
    });
  });

  it("sends an omitted price as null rather than an empty string", async () => {
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await waitFor(() => expect(saveCall()).toBeDefined());
    expect(savedPayload()).toEqual({
      currency: null,
      price: null,
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/book",
    });
  });

  it("confirms a saved link with a toast and closes the dialog", async () => {
    const onOpenChange = vi.fn();
    renderCreateDialog(onOpenChange);

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Посилання додано"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates an existing link through the edit mode", async () => {
    const link = makeStoreLink({ price: 450, storeName: "Yakaboo" });
    renderWithProviders(
      <StoreLinkDialog book={book} link={link} mode="edit" onOpenChange={vi.fn()} open />,
    );

    await userEvent.clear(screen.getByLabelText("Ціна"));
    await userEvent.type(screen.getByLabelText("Ціна"), "380");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(editCall()).toBeDefined());
    expect(JSON.parse(String(editCall()?.[1].body))).toMatchObject({ price: 380 });
  });
});

describe("StoreLinkDialog server errors", () => {
  it("explains that the link is already tracked for this book", async () => {
    respondToSave = () => jsonResponse({ code: "DUPLICATE_URL", message: "duplicate" }, 409);
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Таке посилання вже додане для цієї книги")).toBeInTheDocument();
  });

  it("keeps the dialog open when the server rejects the link", async () => {
    respondToSave = () => jsonResponse({ code: "DUPLICATE_URL", message: "duplicate" }, 409);
    const onOpenChange = vi.fn();
    renderCreateDialog(onOpenChange);

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await screen.findByRole("alert");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("reports that the book reached its store-link limit", async () => {
    respondToSave = () => jsonResponse({ code: "MAX_LINKS_REACHED", message: "too many" }, 409);
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Досягнуто ліміт у 20 посилань на книгу")).toBeInTheDocument();
  });

  it("falls back to a generic message for an unexpected failure", async () => {
    respondToSave = () => jsonResponse({ message: "boom" }, 500);
    renderCreateDialog();

    await typeStoreAndUrl();
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    expect(await screen.findByText("Не вдалося зберегти посилання")).toBeInTheDocument();
  });
});
