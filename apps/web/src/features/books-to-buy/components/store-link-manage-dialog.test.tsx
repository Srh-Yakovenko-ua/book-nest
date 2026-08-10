import "@testing-library/jest-dom/vitest";

import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";

import { MAX_STORE_LINKS_PER_BOOK, UpdateBookStoreLinkInputSchema } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeStoreLink, makeWishlistBook } from "../model/books-to-buy.fixtures";
import { StoreLinkManageDialog } from "./store-link-manage-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const book = makeWishlistBook({ title: "Це зіткане королівство" });
const fetchMock = vi.fn();

let bestOffer: Nullable<BestOfferView>;
let storeLinks: BookStoreLinkView[];
let failStoreLinks: boolean;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function linkIdOf(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

function linksAtLimit(): BookStoreLinkView[] {
  return Array.from({ length: MAX_STORE_LINKS_PER_BOOK }, (_, index) =>
    tracked({
      id: `link-${index}`,
      storeName: `Магазин ${index + 1}`,
      url: `https://store-${index}.example.com/a`,
    }),
  );
}

function renderDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(
    <StoreLinkManageDialog book={book} onOpenChange={onOpenChange} open />,
  );
}

function requestOf(method: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}/store-links`) &&
      (init?.method ?? "GET").toUpperCase() === method,
  ) as [string, RequestInit] | undefined;
}

function rowsOf(list: HTMLElement) {
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

function tracked(overrides: Partial<BookStoreLinkView>): BookStoreLinkView {
  return makeStoreLink({ bookId: book.id, ...overrides });
}

beforeEach(() => {
  bestOffer = { currency: "UAH", price: 449 };
  failStoreLinks = false;
  storeLinks = [
    tracked({ id: "yakaboo", price: 512, storeName: "Yakaboo", url: "https://yakaboo.ua/a" }),
    tracked({ id: "ye", price: 470, storeName: "Книгарня Є", url: "https://book-ye.com.ua/a" }),
    tracked({ id: "readeat", price: 449, storeName: "Readeat", url: "https://readeat.com/a" }),
    tracked({ id: "nf", price: 528, storeName: "Наш Формат", url: "https://nashformat.ua/a" }),
  ];

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/books/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (!url.includes("/store-links"))
      return Promise.reject(new Error(`unexpected ${method} ${url}`));

    if (method === "GET") {
      if (failStoreLinks) return Promise.resolve(jsonResponse({ message: "boom" }, 500));
      return Promise.resolve(jsonResponse({ bestOffer, storeLinks }));
    }

    if (method === "DELETE") {
      const linkId = linkIdOf(url);
      storeLinks = storeLinks.filter((link) => link.id !== linkId);
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (method === "PATCH") {
      const linkId = linkIdOf(url);
      const payload = UpdateBookStoreLinkInputSchema.parse(JSON.parse(String(init?.body)));
      storeLinks = storeLinks.map((link) => (link.id === linkId ? { ...link, ...payload } : link));
      return Promise.resolve(jsonResponse(tracked({ id: linkId, ...payload })));
    }

    const created = tracked({ id: "created", storeName: "Новий магазин" });
    storeLinks = [...storeLinks, created];
    return Promise.resolve(jsonResponse(created));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StoreLinkManageDialog", () => {
  it("shows every tracked store, including the ones the row hides", async () => {
    renderDialog();

    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByRole("link", { name: /Наш Формат/ })).toBeInTheDocument();
    expect(
      screen.getByText(`4 посилання · максимум ${MAX_STORE_LINKS_PER_BOOK}`),
    ).toBeInTheDocument();
  });

  it("orders the stores by price and sinks the ones without a price", async () => {
    storeLinks = [
      tracked({ currency: null, id: "nf", price: null, storeName: "Наш Формат" }),
      tracked({ id: "yakaboo", price: 512, storeName: "Yakaboo" }),
      tracked({ id: "readeat", price: 449, storeName: "Readeat" }),
    ];

    renderDialog();

    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    const [cheapest, pricier, unpriced] = rowsOf(list);
    expect(cheapest).toContain("Readeat");
    expect(pricier).toContain("Yakaboo");
    expect(unpriced).toContain("Наш Формат");
  });

  it("badges the link that the best offer points at", async () => {
    renderDialog();

    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    const [cheapest] = rowsOf(list);
    expect(cheapest).toContain("Readeat");
    expect(cheapest).toContain("найдешевше");
  });

  it("leaves the pricier stores without the cheapest badge", async () => {
    renderDialog();

    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    expect(within(list).getAllByText("найдешевше")).toHaveLength(1);
  });

  it("stays silent about currencies while every price uses the same one", async () => {
    renderDialog();

    await screen.findByRole("list", { name: "Магазини та ціни" });
    expect(
      screen.queryByText("Ціни в різних валютах — курси не враховуються"),
    ).not.toBeInTheDocument();
  });

  it("warns that prices in several currencies are not converted", async () => {
    bestOffer = { currency: "UAH", price: 390 };
    storeLinks = [
      tracked({ currency: "UAH", id: "ksd", price: 390, storeName: "КСД" }),
      tracked({ currency: "EUR", id: "bw", price: 12.5, storeName: "Blackwell's" }),
    ];

    renderDialog();

    expect(
      await screen.findByText("Ціни в різних валютах — курси не враховуються"),
    ).toBeInTheDocument();
  });

  it("swaps the dialog content to the edit form filled with the chosen link", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Редагувати посилання" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ціна")).toHaveValue(512);
    expect(screen.getByLabelText("Посилання")).toHaveValue("https://yakaboo.ua/a");
  });

  it("keeps a single dialog on screen and hides the list while the form is shown", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );

    await screen.findByRole("heading", { name: "Редагувати посилання" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Магазини та ціни" })).not.toBeInTheDocument();
  });

  it("returns to the list from the edit form through the back control", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Назад" }));

    expect(await screen.findByRole("list", { name: "Магазини та ціни" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Редагувати посилання" })).not.toBeInTheDocument();
  });

  it("returns focus to the edit button after the back control", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Назад" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Редагувати посилання «Yakaboo»" })).toHaveFocus(),
    );
  });

  it("keeps the dialog open and returns to the list when Escape is pressed in the form", async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await screen.findByRole("heading", { name: "Редагувати посилання" });
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByRole("list", { name: "Магазини та ціни" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("returns focus to the edit button after Escape leaves the form", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await screen.findByRole("heading", { name: "Редагувати посилання" });
    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Редагувати посилання «Yakaboo»" })).toHaveFocus(),
    );
  });

  it("closes the whole dialog when Escape is pressed in the list view", async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await screen.findByRole("list", { name: "Магазини та ціни" });
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("refreshes the list after an edit is saved", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await userEvent.clear(await screen.findByLabelText("Ціна"));
    await userEvent.type(screen.getByLabelText("Ціна"), "380");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(requestOf("PATCH")).toBeDefined());
    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    await waitFor(() => expect(rowsOf(list)[0]).toContain("380 грн"));
    expect(rowsOf(list)[0]).toContain("Yakaboo");
  });

  it("returns focus to the edit button after a successful save", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await userEvent.clear(await screen.findByLabelText("Ціна"));
    await userEvent.type(screen.getByLabelText("Ціна"), "380");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(requestOf("PATCH")).toBeDefined());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Редагувати посилання «Yakaboo»" })).toHaveFocus(),
    );
  });

  it("returns focus to the edit button once the edit form is cancelled", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Редагувати посилання «Yakaboo»" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Редагувати посилання «Yakaboo»" })).toHaveFocus(),
    );
  });

  it("drops a deleted link from the list and offers to undo it", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Видалити посилання «Наш Формат»" }),
    );

    await waitFor(() => expect(requestOf("DELETE")).toBeDefined());
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Наш Формат/ })).not.toBeInTheDocument(),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Посилання видалено",
      expect.objectContaining({ action: expect.objectContaining({ label: "Скасувати" }) }),
    );
  });

  it("moves focus to the next row after a deletion", async () => {
    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Видалити посилання «Readeat»" }),
    );

    expect(screen.getByRole("button", { name: "Редагувати посилання «Книгарня Є»" })).toHaveFocus();
  });

  it("falls back to the add button when the last link is deleted", async () => {
    bestOffer = null;
    storeLinks = [tracked({ currency: null, id: "only", price: null, storeName: "Readeat" })];

    renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Видалити посилання «Readeat»" }),
    );

    expect(screen.getByRole("button", { name: "Додати посилання" })).toHaveFocus();
  });

  it("hides the add button once the book reached the store-link limit", async () => {
    storeLinks = linksAtLimit();

    renderDialog();

    await screen.findByRole("list", { name: "Магазини та ціни" });
    expect(screen.queryByRole("button", { name: "Додати посилання" })).not.toBeInTheDocument();
  });

  it("replaces the counter with the reason the add button is gone at the limit", async () => {
    storeLinks = linksAtLimit();

    renderDialog();

    await screen.findByRole("list", { name: "Магазини та ціни" });
    expect(
      screen.getByText("Досягнуто максимум — більше посилань додати не можна"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/· максимум/)).not.toBeInTheDocument();
  });

  it("swaps the dialog content to the add form from the footer", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Додати посилання" }));

    expect(
      await screen.findByRole("heading", { name: "Додати посилання на магазин" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("adds a link from inside the dialog and returns to the list", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Додати посилання" }));
    await userEvent.type(await screen.findByLabelText("Магазин"), "Новий магазин");
    await userEvent.type(screen.getByLabelText("Посилання"), "https://new-store.example.com/a");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await waitFor(() => expect(requestOf("POST")).toBeDefined());
    const list = await screen.findByRole("list", { name: "Магазини та ціни" });
    await waitFor(() => expect(rowsOf(list).join(" ")).toContain("Новий магазин"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("returns focus to the add button after a link is added", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Додати посилання" }));
    await userEvent.type(await screen.findByLabelText("Магазин"), "Новий магазин");
    await userEvent.type(screen.getByLabelText("Посилання"), "https://new-store.example.com/a");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти посилання" }));

    await waitFor(() => expect(requestOf("POST")).toBeDefined());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Додати посилання" })).toHaveFocus(),
    );
  });

  it("says that no link has been tracked yet", async () => {
    bestOffer = null;
    storeLinks = [];

    renderDialog();

    expect(await screen.findByText("Посилань ще немає")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати посилання" })).toBeInTheDocument();
  });

  it("reports that the tracked stores could not be loaded", async () => {
    failStoreLinks = true;

    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити збережені магазини",
    );
  });
});
