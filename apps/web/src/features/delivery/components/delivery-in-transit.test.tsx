import "@testing-library/jest-dom/vitest";

import type {
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  BookOrderView,
  InTransitQuickCounts,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { matchesDeliveryKey } from "../api/delivery-keys";
import { bookOrderQueryOptions } from "../api/use-book-order";
import { useDeliverySelectionStore } from "../model/delivery-selection-store";
import { DeliveryInTransit } from "./delivery-in-transit";
import {
  makeDeliveryInTransitPage,
  makeDeliveryInTransitSummary,
  makeDeliveryItemRow,
  makeDeliveryItemRowShipment,
} from "./delivery.fixtures";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const { toastMock } = vi.hoisted(() => ({
  toastMock: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const travellingParcel = makeDeliveryItemRowShipment({
  activeItemsCount: 3,
  id: "shipment-a",
  status: "in_transit",
});

const waitingParcel = makeDeliveryItemRowShipment({
  activeItemsCount: 1,
  expectedDeliveryDate: null,
  id: "shipment-b",
  pickupUntil: "2026-07-20",
  status: "ready_for_pickup",
  trackingNumber: null,
  trackingUrl: null,
});

const fetchMock = vi.fn();

let libraryTotal: number;
let respondToList: (url: string) => Promise<Response> | Response;
let respondToOrder: (url: string) => Promise<Response>;
let respondToQuickCounts: (url: string) => Promise<Response>;
let respondToStatusChange: (url: string) => Promise<Response>;

const QUICK_COUNTS: InTransitQuickCounts = {
  all: 4,
  delayed: 0,
  in_transit: 2,
  ordered: 1,
  ready_for_pickup: 1,
};

function bulkBar(): HTMLElement {
  return screen.getByRole("region", { name: "Масові дії" });
}

function chipNames(): string[] {
  return screen.getAllByRole("radio").map((chip) => chip.textContent ?? "");
}

function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function enterSelection(): Promise<void> {
  await userEvent.click(await screen.findByRole("button", { name: "Вибрати" }));
}

function isStatusChange(url: string): boolean {
  return /\/api\/delivery\/shipments\/[^/]+\/(in-transit|ready-for-pickup)$/.test(url);
}

function itemRow(
  id: string,
  title: string,
  shipment: Nullable<BookOrderItemRowShipmentView>,
): BookOrderItemRowView {
  const base = makeDeliveryItemRow();
  return makeDeliveryItemRow({
    book: { ...base.book, id: `book-of-${id}`, title },
    id,
    shipment,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function libraryOverview(total: number) {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: 0,
      total,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function listRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => /\/books\/in-transit(\?|$)/.test(url));
}

async function openOrderEditor(): Promise<void> {
  await userEvent.click(
    await screen.findByRole("button", { name: messages.delivery.card.orderActionsAria }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", { name: messages.delivery.card.editOrder }),
  );
}

function orderDetail(storeName: string): BookOrderView {
  return {
    createdAt: "2026-07-05T10:00:00.000Z",
    currency: "UAH",
    deliveryPrice: null,
    derivedStatus: "active",
    discount: null,
    id: "order-1",
    isFree: false,
    items: [],
    note: null,
    orderDate: "2026-07-05",
    orderNumber: "ORD-10241",
    shipments: [],
    storeName,
    totalAmount: 480,
    updatedAt: "2026-07-05T10:00:00.000Z",
  };
}

function parcelCheckbox(title: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `Вибрати: ${title}` });
}

function quickCountsRequests(): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/in-transit/quick-counts"))
    .map((url) => new URL(url, "http://localhost").searchParams);
}

function receiveCall(): undefined | unknown[] {
  return fetchMock.mock.calls.find(([url]) =>
    String(url).includes("/api/delivery/shipments/receive"),
  );
}

function renderPage(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={searchParams}>
      <DeliveryInTransit />
    </NuqsTestingAdapter>,
  );
}

function selectAllCheckbox(): HTMLElement {
  return within(screen.getByText(/Вибрати всі видимі посилки/)).getByRole("checkbox");
}

function statusChangeRequests(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url)).filter(isStatusChange);
}

beforeEach(() => {
  useDeliverySelectionStore.getState().exitSelection();

  libraryTotal = 3;
  respondToList = () =>
    jsonResponse(
      makeDeliveryInTransitPage([
        itemRow("item-1", "Таємна історія", travellingParcel),
        itemRow("item-2", "Амадока", travellingParcel),
        itemRow("item-3", "Нічний цирк", waitingParcel),
        itemRow("item-4", "Місто", null),
      ]),
    );

  respondToOrder = (url) => Promise.reject(new Error(`unexpected ${url}`));
  respondToQuickCounts = () => Promise.resolve(jsonResponse(QUICK_COUNTS));
  respondToStatusChange = (url) => Promise.reject(new Error(`unexpected ${url}`));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/in-transit/summary")) {
      return Promise.resolve(jsonResponse(makeDeliveryInTransitSummary()));
    }
    if (url.includes("/in-transit/quick-counts")) return respondToQuickCounts(url);
    if (url.includes("/in-transit/impact")) return Promise.resolve(jsonResponse({ items: [] }));
    if (url.includes("/shipments/receive")) {
      return Promise.resolve(jsonResponse({ receivedShipmentIds: ["shipment-b"], skipped: [] }));
    }
    if (url.includes("/api/delivery/orders/order-1")) return respondToOrder(url);
    if (url.includes("/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/api/books/overview")) {
      return Promise.resolve(jsonResponse(libraryOverview(libraryTotal)));
    }
    if (isStatusChange(url)) return respondToStatusChange(url);
    if (url.includes("/in-transit")) return Promise.resolve(respondToList(url));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryInTransit on a clean account", () => {
  beforeEach(() => {
    libraryTotal = 0;
    respondToList = () => jsonResponse(makeDeliveryInTransitPage([]));
  });

  it("opens the plain create form before any order form", async () => {
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: messages.books.firstBook.cta }),
    );

    expect(routerPush).toHaveBeenCalledWith("/books/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides the summary cards and the attention and next shipment panels", async () => {
    renderPage();

    await screen.findByRole("button", { name: messages.books.firstBook.cta });

    expect(screen.queryByText(messages.delivery.summary.activeOrders)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.delivery.attention.title)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.delivery.nextShipment.title)).not.toBeInTheDocument();
  });

  it("drops the header add-order action while the account has no books", async () => {
    renderPage();

    await screen.findByRole("button", { name: messages.books.firstBook.cta });

    expect(
      screen.queryByRole("button", { name: messages.delivery.actions.addOrder }),
    ).not.toBeInTheDocument();
  });
});

describe("DeliveryInTransit selection", () => {
  it("leaves only the add-order action in the page header", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: "Додати замовлення" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Позначити всі як отримані" }),
    ).not.toBeInTheDocument();
  });

  it("gives every active parcel a checkbox and the books without a parcel none", async () => {
    renderPage();
    await enterSelection();

    expect(await screen.findByText("Ще не відправлено")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(selectAllCheckbox()).toBeInTheDocument();
    expect(parcelCheckbox("Посилка 1")).toBeInTheDocument();
    expect(parcelCheckbox("Посилка 2")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Вибрати: Посилка 3" })).not.toBeInTheDocument();
  });

  it("picks the parcels of one order independently", async () => {
    renderPage();
    await enterSelection();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Вибрати: Посилка 1" }));

    expect(parcelCheckbox("Посилка 1")).toBeChecked();
    expect(parcelCheckbox("Посилка 2")).not.toBeChecked();
    expect(within(bulkBar()).getByText("Вибрано 1 посилку")).toBeInTheDocument();
    expect(within(bulkBar()).getByText("3 книги")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("walks select-all-visible from none through mixed to all and back", async () => {
    renderPage();
    await enterSelection();

    expect(await screen.findByText("Вибрати всі видимі посилки (0)")).toBeInTheDocument();
    expect(selectAllCheckbox()).not.toBeChecked();

    await userEvent.click(parcelCheckbox("Посилка 1"));
    expect(selectAllCheckbox()).toBePartiallyChecked();

    await userEvent.click(selectAllCheckbox());
    expect(parcelCheckbox("Посилка 1")).toBeChecked();
    expect(parcelCheckbox("Посилка 2")).toBeChecked();
    expect(screen.getByText("Вибрати всі видимі посилки (2)")).toBeInTheDocument();
    expect(within(bulkBar()).getByText("Вибрано 2 посилки")).toBeInTheDocument();
    expect(within(bulkBar()).getByText("4 книги")).toBeInTheDocument();

    await userEvent.click(selectAllCheckbox());
    expect(parcelCheckbox("Посилка 1")).not.toBeChecked();
    expect(screen.queryByRole("region", { name: "Масові дії" })).not.toBeInTheDocument();
  });

  it("receives exactly the parcels that were picked", async () => {
    renderPage();
    await enterSelection();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Вибрати: Посилка 2" }));
    await userEvent.click(within(bulkBar()).getByRole("button", { name: "Позначити отриманими" }));
    await userEvent.click(await screen.findByRole("button", { name: "Позначити як отримані" }));

    await waitFor(() => expect(receiveCall()).toBeDefined());
    expect(receiveCall()?.[1]).toMatchObject({
      body: JSON.stringify({ shipmentIds: ["shipment-b"] }),
      method: "POST",
    });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Масові дії" })).not.toBeInTheDocument(),
    );
  });

  it("keeps the single-parcel receive on the card itself", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Позначити отриманою" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "1 книга буде позначена як отримана",
    );
  });

  it("drops the parcels a new quick filter took off the page", async () => {
    renderPage();
    await enterSelection();

    await screen.findByText(/Вибрати всі видимі посилки/);
    await userEvent.click(selectAllCheckbox());
    expect(within(bulkBar()).getByText("Вибрано 2 посилки")).toBeInTheDocument();

    respondToList = () =>
      jsonResponse(makeDeliveryInTransitPage([itemRow("item-3", "Нічний цирк", waitingParcel)]));

    await userEvent.click(screen.getByRole("radio", { name: /Готові до отримання/ }));

    await waitFor(() =>
      expect(within(bulkBar()).getByText("Вибрано 1 посилку")).toBeInTheDocument(),
    );
    expect(within(bulkBar()).getByText("1 книга")).toBeInTheDocument();
  });
});

describe("DeliveryInTransit quick filter counts", () => {
  it("puts the quick counts on the chips", async () => {
    renderPage();

    await waitFor(() =>
      expect(chipNames()).toEqual([
        "Усі4",
        "Очікують відправлення1",
        "В дорозі2",
        "Готові до отримання1",
        "Затримуються0",
      ]),
    );
  });

  it("shows no numbers before the first counts arrive", async () => {
    const pending = deferred();
    respondToQuickCounts = () => pending.promise;
    renderPage();

    await screen.findByText("Таємна історія");

    expect(chipNames()).toEqual([
      "Усі",
      "Очікують відправлення",
      "В дорозі",
      "Готові до отримання",
      "Затримуються",
    ]);

    pending.resolve(jsonResponse(QUICK_COUNTS));
    await waitFor(() => expect(chipNames()[0]).toBe("Усі4"));
  });

  it("keeps a chip at zero clickable", async () => {
    renderPage();

    const delayed = await screen.findByRole("radio", { name: /Затримуються/ });
    await waitFor(() => expect(delayed).toHaveTextContent("Затримуються0"));

    expect(delayed).toBeEnabled();
    await userEvent.click(delayed);
    expect(delayed).toBeChecked();
  });

  it("keeps the counts on screen while a search refetches them, then updates them", async () => {
    renderPage();
    await waitFor(() => expect(chipNames()[0]).toBe("Усі4"));

    const searched = deferred();
    respondToQuickCounts = () => searched.promise;
    await userEvent.type(screen.getByRole("textbox", { name: "Пошук доставок" }), "Амадока");

    await waitFor(() => expect(quickCountsRequests().at(-1)?.get("search")).toBe("Амадока"));
    expect(chipNames()[0]).toBe("Усі4");

    searched.resolve(
      jsonResponse({ all: 1, delayed: 0, in_transit: 1, ordered: 0, ready_for_pickup: 0 }),
    );

    await waitFor(() =>
      expect(chipNames()).toEqual([
        "Усі1",
        "Очікують відправлення0",
        "В дорозі1",
        "Готові до отримання0",
        "Затримуються0",
      ]),
    );
  });

  it("counts under the advanced filters the list uses", async () => {
    renderPage("?store=Yakaboo&structure=multiple_shipments");

    await waitFor(() => expect(quickCountsRequests()).not.toHaveLength(0));
    const [request] = quickCountsRequests();

    expect(request?.getAll("store")).toEqual(["Yakaboo"]);
    expect(request?.getAll("structure")).toEqual(["multiple_shipments"]);
    await waitFor(() => expect(chipNames()[0]).toBe("Усі4"));
  });

  it("never sends the selected quick filter with the counts", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("radio", { name: /В дорозі/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("filter=in_transit")),
      ).toBe(true),
    );

    expect(quickCountsRequests().every((params) => !params.has("filter"))).toBe(true);
    expect(quickCountsRequests().every((params) => !params.has("sort"))).toBe(true);
  });

  it("keeps the summary cards on the summary endpoint numbers", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/in-transit/summary")) {
        return Promise.resolve(
          jsonResponse(makeDeliveryInTransitSummary({ activeBooksCount: 9, orderedCount: 7 })),
        );
      }
      if (url.includes("/in-transit/quick-counts")) return respondToQuickCounts(url);
      if (url.includes("/in-transit/impact")) return Promise.resolve(jsonResponse({ items: [] }));
      if (url.includes("/in-transit")) return Promise.resolve(respondToList(url));
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    renderPage();

    expect((await screen.findAllByText(/7 очікують відправлення/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(chipNames()[1]).toBe("Очікують відправлення1"));
  });
});

describe("DeliveryInTransit endless scrolling", () => {
  const viewport = mockIntersectionObserver();

  function respondWithTwoPages(failSecondPage: () => boolean) {
    respondToList = (url) => {
      if (!url.includes("pageNumber=2")) {
        return jsonResponse(
          makeDeliveryInTransitPage([itemRow("item-1", "Таємна історія", travellingParcel)], {
            pagesCount: 2,
            totalCount: 2,
          }),
        );
      }
      if (failSecondPage()) throw new Error("network is down");
      return jsonResponse(
        makeDeliveryInTransitPage([itemRow("item-5", "Дюна", waitingParcel)], {
          page: 2,
          pagesCount: 2,
          totalCount: 2,
        }),
      );
    };
  }

  it("loads the next page once the sentinel reaches the viewport", async () => {
    respondWithTwoPages(() => false);
    renderPage();

    expect(await screen.findByText("Таємна історія")).toBeInTheDocument();
    expect(screen.queryByText("Дюна")).not.toBeInTheDocument();
    expect(listRequests()).toHaveLength(1);

    viewport.enterViewport();

    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(screen.getByText("Таємна історія")).toBeInTheDocument();
  });

  it("asks for nothing more once the last page is loaded", async () => {
    respondWithTwoPages(() => false);
    renderPage();

    await screen.findByText("Таємна історія");
    viewport.enterViewport();
    await screen.findByText("Дюна");

    viewport.enterViewport();

    expect(listRequests()).toHaveLength(2);
  });

  it("stops at a retry when the next page fails and recovers on click", async () => {
    let isBroken = true;
    respondWithTwoPages(() => isBroken);
    renderPage();

    await screen.findByText("Таємна історія");
    viewport.enterViewport();

    const retry = await screen.findByRole("button", { name: "Спробувати ще раз" });
    expect(
      within(screen.getByRole("alert")).getByText("Не вдалося завантажити ще замовлення"),
    ).toBeInTheDocument();

    isBroken = false;
    await userEvent.click(retry);

    expect(await screen.findByText("Дюна")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("DeliveryInTransit refetch failure", () => {
  it("keeps the loaded books and shows the refresh banner when a refetch fails", async () => {
    const { queryClient } = renderPage();
    expect(await screen.findByText("Таємна історія")).toBeInTheDocument();

    respondToList = () => jsonResponse({}, 500);
    await act(() => queryClient.invalidateQueries({ predicate: matchesDeliveryKey }));

    expect(await screen.findByText(messages.common.refetchError)).toBeInTheDocument();
    expect(screen.getByText("Таємна історія")).toBeInTheDocument();
    expect(screen.queryByText(messages.delivery.states.error.title)).not.toBeInTheDocument();
  });
});

describe("DeliveryInTransit order editor", () => {
  it("fills the editor from the server once the cached order went out of date", async () => {
    const { queryClient } = renderPage();
    const order = bookOrderQueryOptions("order-1");
    queryClient.setQueryDefaults(order.queryKey, { gcTime: Infinity });
    queryClient.setQueryData(order.queryKey, orderDetail("Old Store"));
    await act(() => queryClient.invalidateQueries({ queryKey: order.queryKey }));
    respondToOrder = () => Promise.resolve(jsonResponse(orderDetail("New Store")));

    await openOrderEditor();

    const editor = await screen.findByRole("dialog", { name: messages.delivery.manage.editOrder });
    expect(within(editor).getByLabelText(messages.delivery.manage.store)).toHaveValue("New Store");
  });

  it("reports a failed order load instead of opening the editor", async () => {
    respondToOrder = () => Promise.resolve(jsonResponse({}, 500));
    renderPage();

    await openOrderEditor();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("dialog", { name: messages.delivery.manage.editOrder }),
    ).not.toBeInTheDocument();
  });
});

describe("DeliveryInTransit shipment next step", () => {
  const card = messages.delivery.card;

  it("ignores a second click while the status change is in flight", async () => {
    respondToStatusChange = () => deferred().promise;
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: card.markReadyForPickupCompact }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: card.markReadyForPickupCompact })).toBeDisabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: card.markReadyForPickupCompact }));

    expect(statusChangeRequests()).toHaveLength(1);
  });

  it("stays disabled until the refreshed list shows the new status", async () => {
    const arrivedParcel: BookOrderItemRowShipmentView = {
      ...travellingParcel,
      status: "ready_for_pickup",
    };
    const statusChange = deferred();
    respondToStatusChange = () => statusChange.promise;
    renderPage();
    const arrival = await screen.findByRole("button", { name: card.markReadyForPickupCompact });
    const loadedListRequests = listRequests().length;
    const refreshedList = deferred();
    respondToList = () => refreshedList.promise;

    await userEvent.click(arrival);
    statusChange.resolve(jsonResponse(orderDetail("Yakaboo")));
    await waitFor(() => expect(listRequests()).toHaveLength(loadedListRequests + 1));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: card.markReadyForPickupCompact })).toBeDisabled(),
    );

    refreshedList.resolve(
      jsonResponse(
        makeDeliveryInTransitPage([
          itemRow("item-1", "Таємна історія", arrivedParcel),
          itemRow("item-2", "Амадока", arrivedParcel),
          itemRow("item-3", "Нічний цирк", waitingParcel),
          itemRow("item-4", "Місто", null),
        ]),
      ),
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { busy: false, name: card.receiveShipmentCompact }),
      ).toHaveLength(2),
    );
  });

  it("keeps every shipment with a status change in flight disabled", async () => {
    respondToList = () =>
      jsonResponse(
        makeDeliveryInTransitPage([
          itemRow("item-1", "Таємна історія", travellingParcel),
          itemRow(
            "item-5",
            "Дюна",
            makeDeliveryItemRowShipment({ id: "shipment-c", status: "ordered" }),
          ),
        ]),
      );
    respondToStatusChange = () => deferred().promise;
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: card.markReadyForPickupCompact }),
    );
    await userEvent.click(screen.getByRole("button", { name: card.markInTransitCompact }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: card.markInTransitCompact })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: card.markReadyForPickupCompact })).toBeDisabled();
  });

  it("marks the reading statistics stale once a shipment changes status", async () => {
    const statisticsKey = ["/api/statistics", "overview", { period: "year" }];
    respondToStatusChange = () => Promise.resolve(jsonResponse(orderDetail("Yakaboo")));
    const { queryClient } = renderPage();
    queryClient.setQueryDefaults(statisticsKey, { gcTime: Infinity });
    queryClient.setQueryData(statisticsKey, {});

    await userEvent.click(
      await screen.findByRole("button", { name: card.markReadyForPickupCompact }),
    );

    await waitFor(() => expect(queryClient.getQueryState(statisticsKey)?.isInvalidated).toBe(true));
  });
});
