import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { DeliveryHistoryCard } from "./delivery-history-card";
import {
  historyCardModels,
  makeHistoryBook,
  makeHistoryCardModel,
  makeHistoryShipmentGroup,
} from "./delivery-history.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function cancelledOrder() {
  return historyCardModels[2] ?? makeHistoryCardModel();
}

function receivedOrder() {
  return historyCardModels[1] ?? makeHistoryCardModel();
}

describe("DeliveryHistoryCard", () => {
  it("shows the store, the order meta and the canonical order total in its header", () => {
    renderWithProviders(<DeliveryHistoryCard model={makeHistoryCardModel()} search="" />);

    const header = screen.getByRole("heading", { level: 3 }).closest("header");
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent("Yakaboo");
    expect(header).toHaveTextContent("ORD-10241 · 5 лип. 2026");
    expect(header).toHaveTextContent("480 UAH");
  });

  it("counts only the books the current tab renders", () => {
    renderWithProviders(<DeliveryHistoryCard model={receivedOrder()} search="" />);

    expect(screen.getByText("3 книги")).toBeVisible();
  });

  it("keeps every parcel of a split order as its own section", () => {
    renderWithProviders(<DeliveryHistoryCard model={receivedOrder()} search="" />);

    const titles = screen.getAllByRole("heading", { level: 4 }).map((node) => node.textContent);
    expect(titles).toEqual(["Посилка 1", "Посилка 2"]);
  });

  it("dates each parcel by when it actually arrived", () => {
    renderWithProviders(<DeliveryHistoryCard model={receivedOrder()} search="" />);

    expect(screen.getByText("Отримано 12 серп. 2026")).toBeVisible();
    expect(screen.getByText("Отримано 18 серп. 2026")).toBeVisible();
  });

  it("keeps the expected date as a secondary note next to the actual one", () => {
    renderWithProviders(<DeliveryHistoryCard model={receivedOrder()} search="" />);

    expect(screen.getByText("Очікувалось 14 серп. 2026")).toBeVisible();
  });

  it("carries the service, the tracking number and the tracking link of a parcel", () => {
    renderWithProviders(<DeliveryHistoryCard model={makeHistoryCardModel()} search="" />);

    expect(screen.getByText("Нова Пошта")).toBeVisible();
    expect(screen.getByText("20450012345678")).toBeVisible();
    expect(screen.getByRole("link", { name: /Відкрити трекінг/ })).toHaveAttribute(
      "href",
      "https://tracking.example.com/20450012345678",
    );
  });

  it("offers no mutating action anywhere on the card", () => {
    renderWithProviders(<DeliveryHistoryCard model={receivedOrder()} search="" />);

    expect(screen.queryByRole("button", { name: "Дії із замовленням" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Позначити отриманою")).not.toBeInTheDocument();
    expect(screen.queryByText("Позначити прибуття")).not.toBeInTheDocument();
    expect(screen.queryByText("Позначити в дорозі")).not.toBeInTheDocument();
    expect(screen.queryByText("Редагувати замовлення")).not.toBeInTheDocument();
  });

  it("reaches the book through its cover and title instead of a row menu", () => {
    renderWithProviders(<DeliveryHistoryCard model={makeHistoryCardModel()} search="" />);

    expect(screen.getByRole("link", { name: "Таємна історія" })).toHaveAttribute(
      "href",
      "/books/1",
    );
    expect(screen.queryByRole("button", { name: /Дії для/ })).not.toBeInTheDocument();
  });

  it("labels the books that never reached a parcel and still lists them", () => {
    renderWithProviders(<DeliveryHistoryCard model={cancelledOrder()} search="" />);

    expect(screen.getByText("Ще не відправлено")).toBeVisible();
    expect(screen.getByRole("link", { name: "Маленьке життя" })).toBeVisible();
  });

  it("keeps a cancellation reason on the book it belongs to", () => {
    renderWithProviders(<DeliveryHistoryCard model={cancelledOrder()} search="" />);

    expect(screen.getByText("Знайшла дешевше в іншому магазині.")).toBeVisible();
    expect(
      screen.getByText("Магазин скасував замовлення — книги немає в наявності."),
    ).toBeVisible();
  });

  it("shows three books of a parcel until the order is expanded", async () => {
    const user = userEvent.setup();
    const model = makeHistoryCardModel({
      booksCount: 5,
      shipments: [
        makeHistoryShipmentGroup({
          books: Array.from({ length: 5 }, (_, index) =>
            makeHistoryBook({ id: `item-${index}`, title: `Книга ${index}` }),
          ),
        }),
      ],
    });

    renderWithProviders(<DeliveryHistoryCard model={model} search="" />);

    expect(screen.queryByText("Книга 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Показати ще/ }));

    expect(screen.getByText("Книга 4")).toBeVisible();
    expect(screen.getByRole("button", { name: /Згорнути/ })).toBeVisible();
  });

  it("opens the collapsed books when the search match hides behind them", () => {
    const model = makeHistoryCardModel({
      booksCount: 5,
      revealsSearchMatch: true,
      shipments: [
        makeHistoryShipmentGroup({
          books: Array.from({ length: 5 }, (_, index) =>
            makeHistoryBook({ id: `item-${index}`, title: `Книга ${index}` }),
          ),
        }),
      ],
    });

    renderWithProviders(<DeliveryHistoryCard model={model} search="Книга 4" />);

    expect(screen.getByText("Книга 4")).toBeVisible();
  });

  it("shows the order comment above the parcels, outside any of them", () => {
    const model = makeHistoryCardModel({ note: "Замовляли на подарунок" });

    renderWithProviders(<DeliveryHistoryCard model={model} search="" />);

    const comment = screen.getByText("Замовляли на подарунок");
    expect(comment).toBeVisible();
    expect(comment.closest("[data-shipment-id]")).toBeNull();
    expect(screen.getByText("Коментар до замовлення:")).toHaveClass("sr-only");
  });

  it("shows the comment of a parcel inside that parcel", () => {
    const model = makeHistoryCardModel({
      shipments: [makeHistoryShipmentGroup({ note: "Лишили у відділенні" })],
    });

    renderWithProviders(<DeliveryHistoryCard model={model} search="" />);

    const comment = screen.getByText("Лишили у відділенні");
    expect(comment).toBeVisible();
    expect(comment.closest("[data-shipment-id]")).toHaveAttribute("data-shipment-id", "shipment-1");
    expect(screen.getByText("Коментар до посилки:")).toHaveClass("sr-only");
  });

  it("renders no comment row when the order and its parcel carry none", () => {
    renderWithProviders(<DeliveryHistoryCard model={makeHistoryCardModel()} search="" />);

    expect(screen.queryByText("Коментар до замовлення:")).not.toBeInTheDocument();
    expect(screen.queryByText("Коментар до посилки:")).not.toBeInTheDocument();
  });
});
