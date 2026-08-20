import type {
  Currency,
  Nullable,
  OrderHistoryBookView,
  OrderHistoryGroupView,
  OrderHistoryShipmentGroupView,
  OrderHistoryShipmentView,
  ShipmentStatus,
} from "@app/shared";

import type { StatusEntry } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { isHttpsUrl } from "@/lib/is-https-url";

import type { DeliveryHistoryTab } from "./history-params";

import { formatMoney } from "./money-format";
import { ORDER_CARD_LAYOUT } from "./order-card-model";

export type HistoryBookModel = {
  authorName: string;
  bookHref: string;
  cancelReason: Nullable<string>;
  coverSrc?: string;
  id: string;
  priceText: Nullable<string>;
  series: Nullable<HistoryBookSeriesModel>;
  terminalText: Nullable<string>;
  title: string;
};

export type HistoryBookSeriesModel = {
  href: string;
  name: string;
  positionLabel: Nullable<string>;
};

export type HistoryCardLabels = {
  cancelledOn: (date: string) => string;
  expectedOn: (date: string) => string;
  receivedOn: (date: string) => string;
  seriesPosition: (position: number, total: number) => string;
  status: (key: ShipmentStatus) => string;
};

export type HistoryOrderCardModel = {
  booksCount: number;
  id: string;
  orderDateText: Nullable<string>;
  orderNumber: Nullable<string>;
  revealsSearchMatch: boolean;
  shipments: HistoryShipmentGroupModel[];
  storeName: string;
  totalText: Nullable<string>;
};

export type HistoryShipmentGroupModel = {
  badge: Nullable<StatusEntry>;
  books: HistoryBookModel[];
  cancelReason: Nullable<string>;
  expectedText: Nullable<string>;
  id: Nullable<string>;
  note: Nullable<string>;
  serviceName: Nullable<string>;
  terminalText: Nullable<string>;
  trackingHref: Nullable<string>;
  trackingNumber: Nullable<string>;
};

type BookOptions = OrderOptions & { shipmentDate: Nullable<string> };

type CardOptions = {
  labels: HistoryCardLabels;
  locale: string;
  search: string;
  tab: DeliveryHistoryTab;
};

type OrderOptions = CardOptions & { currency: Nullable<Currency> };

type ShipmentTerminal = {
  cancelReason: Nullable<string>;
  date: Nullable<string>;
  text: Nullable<string>;
};

export function toHistoryOrderCards(
  groups: OrderHistoryGroupView[],
  options: CardOptions,
): HistoryOrderCardModel[] {
  return groups.map((group) => {
    const orderOptions: OrderOptions = { ...options, currency: group.order.currency };
    const shipments = group.shipments.map((shipmentGroup) =>
      toShipmentGroupModel(shipmentGroup, orderOptions),
    );

    return {
      booksCount: group.booksCount,
      id: group.order.id,
      orderDateText:
        group.order.orderDate === null ? null : formatDate(group.order.orderDate, options.locale),
      orderNumber: group.order.orderNumber,
      revealsSearchMatch: hidesSearchMatch({ search: options.search, shipments }),
      shipments,
      storeName: group.order.storeName,
      totalText: toOrderTotalText(group, options.locale),
    };
  });
}

function bookHaystack(book: HistoryBookModel): string {
  return [book.title, book.authorName, book.series?.name, book.cancelReason]
    .filter((part) => part !== null && part !== undefined)
    .join(" ")
    .toLocaleLowerCase();
}

function hidesSearchMatch({
  search,
  shipments,
}: {
  search: string;
  shipments: HistoryShipmentGroupModel[];
}): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (needle === "") return false;

  return shipments.some((group) =>
    group.books
      .slice(ORDER_CARD_LAYOUT.bookLimit)
      .some((book) => bookHaystack(book).includes(needle)),
  );
}

function toBookModel(entry: OrderHistoryBookView, options: BookOptions): HistoryBookModel {
  const { book } = entry;
  const ownDate = toBookTerminalDate(entry, options.locale);

  return {
    authorName: book.firstAuthorName,
    bookHref: `/books/${book.id}`,
    cancelReason: entry.cancelReason,
    coverSrc: book.cover?.urls.thumb,
    id: entry.id,
    priceText:
      entry.price === null
        ? null
        : formatMoney({ amount: entry.price, currency: options.currency, locale: options.locale }),
    series:
      book.series === null
        ? null
        : {
            href: `/series/${book.series.id}`,
            name: book.series.name,
            positionLabel:
              book.series.partNumber === null
                ? null
                : book.series.totalBooks === null
                  ? String(book.series.partNumber)
                  : options.labels.seriesPosition(book.series.partNumber, book.series.totalBooks),
          },
    terminalText:
      ownDate === null || ownDate === options.shipmentDate
        ? null
        : toTerminalText({ date: ownDate, entry, labels: options.labels }),
    title: book.title,
  };
}

function toBookTerminalDate(entry: OrderHistoryBookView, locale: string): Nullable<string> {
  if (entry.cancelledAt !== null) return formatDate(entry.cancelledAt, locale);
  if (entry.receivedAt !== null) return formatDate(entry.receivedAt, locale);
  return null;
}

function toExpectedText({
  options,
  shipment,
  terminal,
}: {
  options: OrderOptions;
  shipment: Nullable<OrderHistoryShipmentView>;
  terminal: ShipmentTerminal;
}): Nullable<string> {
  if (options.tab !== "received") return null;
  if (shipment === null || shipment.expectedDeliveryDate === null) return null;
  if (terminal.date === null) return null;

  const expected = formatDate(shipment.expectedDeliveryDate, options.locale);
  return expected === terminal.date ? null : options.labels.expectedOn(expected);
}

function toOrderTotalText(group: OrderHistoryGroupView, locale: string): Nullable<string> {
  const { effectiveTotalAmount } = group.order;
  if (effectiveTotalAmount === null) return null;

  return formatMoney({
    amount: effectiveTotalAmount,
    currency: group.order.currency,
    locale,
  });
}

function toShipmentBadge(
  shipment: Nullable<OrderHistoryShipmentView>,
  label: (key: ShipmentStatus) => string,
): Nullable<StatusEntry> {
  if (shipment === null) return null;

  const base = deliveryStatuses.find((entry) => entry.value === shipment.status);
  return base === undefined ? null : { ...base, label: label(shipment.status) };
}

function toShipmentGroupModel(
  group: OrderHistoryShipmentGroupView,
  options: OrderOptions,
): HistoryShipmentGroupModel {
  const { shipment } = group;
  const terminal = toShipmentTerminal(shipment, options);
  const trackingUrl = shipment?.trackingUrl ?? null;

  return {
    badge: toShipmentBadge(shipment, options.labels.status),
    books: group.books.map((entry) =>
      toBookModel(entry, { ...options, shipmentDate: terminal.date }),
    ),
    cancelReason: terminal.cancelReason,
    expectedText: toExpectedText({ options, shipment, terminal }),
    id: shipment?.id ?? null,
    note: shipment?.note ?? null,
    serviceName: shipment?.deliveryService?.name ?? null,
    terminalText: terminal.text,
    trackingHref: trackingUrl !== null && isHttpsUrl(trackingUrl) ? trackingUrl : null,
    trackingNumber: shipment?.trackingNumber ?? null,
  };
}

function toShipmentTerminal(
  shipment: Nullable<OrderHistoryShipmentView>,
  options: OrderOptions,
): ShipmentTerminal {
  if (shipment === null) return { cancelReason: null, date: null, text: null };

  if (shipment.status === "received" && shipment.receivedAt !== null) {
    const date = formatDate(shipment.receivedAt, options.locale);
    return { cancelReason: null, date, text: options.labels.receivedOn(date) };
  }

  if (shipment.status === "cancelled" && shipment.cancelledAt !== null) {
    const date = formatDate(shipment.cancelledAt, options.locale);
    return { cancelReason: shipment.cancelReason, date, text: options.labels.cancelledOn(date) };
  }

  return { cancelReason: null, date: null, text: null };
}

function toTerminalText({
  date,
  entry,
  labels,
}: {
  date: string;
  entry: OrderHistoryBookView;
  labels: HistoryCardLabels;
}): string {
  return entry.cancelledAt === null ? labels.receivedOn(date) : labels.cancelledOn(date);
}
