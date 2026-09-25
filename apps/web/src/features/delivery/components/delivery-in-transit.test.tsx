import "@testing-library/jest-dom/vitest";

import type {
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  InTransitQuickCounts,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { useDeliverySelectionStore } from "../model/delivery-selection-store";
import { DeliveryInTransit } from "./delivery-in-transit";
import {
  makeDeliveryInTransitPage,
  makeDeliveryInTransitSummary,
  makeDeliveryItemRow,
  makeDeliveryItemRowShipment,
} from "./delivery.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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

let respondToList: (url: string) => Response;
let respondToQuickCounts: (url: string) => Promise<Response>;

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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
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

beforeEach(() => {
  useDeliverySelectionStore.getState().exitSelection();

  respondToList = () =>
    jsonResponse(
      makeDeliveryInTransitPage([
        itemRow("item-1", "Таємна історія", travellingParcel),
        itemRow("item-2", "Амадока", travellingParcel),
        itemRow("item-3", "Нічний цирк", waitingParcel),
        itemRow("item-4", "Місто", null),
      ]),
    );

  respondToQuickCounts = () => Promise.resolve(jsonResponse(QUICK_COUNTS));

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
    if (url.includes("/in-transit")) return Promise.resolve(respondToList(url));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
