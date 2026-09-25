import "@testing-library/jest-dom/vitest";

import type { BookOrderItemRowShipmentView, BookOrderItemRowView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

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

function bulkBar(): HTMLElement {
  return screen.getByRole("region", { name: "Масові дії" });
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

function listRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => /\/books\/in-transit(\?|$)/.test(url));
}

function parcelCheckbox(title: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `Вибрати: ${title}` });
}

function receiveCall(): undefined | unknown[] {
  return fetchMock.mock.calls.find(([url]) =>
    String(url).includes("/api/delivery/shipments/receive"),
  );
}

function renderPage() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
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

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/in-transit/summary")) {
      return Promise.resolve(jsonResponse(makeDeliveryInTransitSummary()));
    }
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
