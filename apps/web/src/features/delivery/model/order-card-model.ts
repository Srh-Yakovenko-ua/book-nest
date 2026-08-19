import type {
  ActiveShipmentStatus,
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  Currency,
  DeliveryUiStatus,
  Nullable,
  ShipmentStatus,
} from "@app/shared";

import { isActiveShipmentStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";
import type { StatusEntry, StatusTone } from "@/lib/book-status";

import { deliveryStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { isHttpsUrl } from "@/lib/is-https-url";

import { toOrderStatusBadge } from "./statistics-view-model";

export type DeliveryBadgeKey =
  "arriving_soon" | "delayed" | "in_transit" | "no_delivery_date" | "ordered" | "ready_for_pickup";

export type DeliveryCardLabels = {
  badge: (key: DeliveryBadgeKey) => string;
  orderStatus: (key: BookOrderItemRowOrderView["derivedStatus"]) => string;
  seriesPosition: (position: number, total: number) => string;
};

export type DeliveryOrderBookModel = {
  authorName: string;
  bookHref: string;
  bookId: string;
  coverSrc?: string;
  currency: Nullable<Currency>;
  id: string;
  price: Nullable<number>;
  priceText: Nullable<string>;
  resetsOrderTotal: boolean;
  series: Nullable<DeliveryOrderBookSeriesModel>;
  title: string;
};

export type DeliveryOrderBookSeriesModel = {
  href: string;
  name: string;
  positionLabel: Nullable<string>;
};

export type DeliveryOrderCardModel = {
  badge: StatusEntry;
  booksCount: number;
  id: string;
  incompleteTotal: Nullable<IncompleteOrderTotal>;
  orderDate: Nullable<string>;
  orderDateText: Nullable<string>;
  orderNumber: Nullable<string>;
  shipments: DeliveryShipmentGroupModel[];
  storeName: string;
  totalText: Nullable<string>;
};

export type DeliveryShipmentGroupModel = {
  activeItemsCount: number;
  badge: StatusEntry;
  books: DeliveryOrderBookModel[];
  expectedDate: Nullable<string>;
  expectedDateText: Nullable<string>;
  id: Nullable<string>;
  note: Nullable<string>;
  pickupUntil: Nullable<string>;
  pickupUntilText: Nullable<string>;
  serviceName: Nullable<string>;
  status: Nullable<ShipmentStatus>;
  trackingHref: Nullable<string>;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
};

export type IncompleteOrderTotal = { itemsCount: number; pricedItemsCount: number };

export type SelectableShipment = { activeItemsCount: number; id: string };

export type SelectableShipmentGroup = DeliveryShipmentGroupModel & {
  id: string;
  status: ActiveShipmentStatus;
};

type CardOptions = { labels: DeliveryCardLabels; locale: string };

type OrderGroup = {
  items: BookOrderItemRowView[];
  order: BookOrderItemRowOrderView;
  shipments: Map<Nullable<string>, ShipmentGroup>;
};

type OrderTotalContext = {
  hasStoredTotal: boolean;
  itemsCount: number;
  pricedItemsCount: number;
};

type ShipmentGroup = {
  first: BookOrderItemRowView;
  id: Nullable<string>;
  items: BookOrderItemRowView[];
};

const UI_BADGE_META: Record<DeliveryUiStatus, { icon: UiIconName; tone: StatusTone }> = {
  arriving_soon: { icon: "clock", tone: "info" },
  delayed: { icon: "alert-triangle", tone: "danger" },
  no_delivery_date: { icon: "circle-slash", tone: "neutral" },
};

export function isSelectableShipment(
  group: DeliveryShipmentGroupModel,
): group is SelectableShipmentGroup {
  return group.id !== null && group.status !== null && isActiveShipmentStatus(group.status);
}

export function toDeliveryOrderCards(
  items: BookOrderItemRowView[],
  options: CardOptions,
): DeliveryOrderCardModel[] {
  return groupByOrder(items).map((group) => {
    const orderTotal = toOrderTotalContext(group);

    return {
      badge: toOrderStatusBadge(group.order.derivedStatus, options.labels.orderStatus),
      booksCount: group.items.length,
      id: group.order.id,
      incompleteTotal: toIncompleteOrderTotal(orderTotal),
      orderDate: group.order.orderDate,
      orderDateText:
        group.order.orderDate === null ? null : formatDate(group.order.orderDate, options.locale),
      orderNumber: group.order.orderNumber,
      shipments: dispatchedFirst(group).map((shipment) =>
        toShipmentGroupModel(shipment, options, orderTotal),
      ),
      storeName: group.order.storeName,
      totalText: formatPrice(
        group.order.effectiveTotalAmount,
        group.order.currency,
        options.locale,
      ),
    };
  });
}

export function toSelectableShipments(orders: DeliveryOrderCardModel[]): SelectableShipment[] {
  return orders.flatMap((order) =>
    order.shipments
      .filter(isSelectableShipment)
      .map((group) => ({ activeItemsCount: group.activeItemsCount, id: group.id })),
  );
}

function dispatchedFirst(group: OrderGroup): ShipmentGroup[] {
  const shipments = Array.from(group.shipments.values());
  return [
    ...shipments.filter((shipment) => shipment.id !== null),
    ...shipments.filter((shipment) => shipment.id === null),
  ];
}

function formatPrice(
  price: Nullable<number>,
  currency: Nullable<Currency>,
  locale: string,
): Nullable<string> {
  if (price === null) return null;
  const amount = new Intl.NumberFormat(locale).format(price);
  return currency === null ? amount : `${amount} ${currency}`;
}

function groupByOrder(items: BookOrderItemRowView[]): OrderGroup[] {
  const orders = new Map<string, OrderGroup>();

  for (const item of items) {
    const group = orders.get(item.order.id) ?? {
      items: [],
      order: item.order,
      shipments: new Map<Nullable<string>, ShipmentGroup>(),
    };
    orders.set(item.order.id, group);
    group.items.push(item);

    const shipmentId = item.shipment?.id ?? null;
    const shipment = group.shipments.get(shipmentId);
    if (shipment === undefined) {
      group.shipments.set(shipmentId, { first: item, id: shipmentId, items: [item] });
      continue;
    }
    shipment.items.push(item);
  }

  return Array.from(orders.values());
}

function resetsOrderTotal(item: BookOrderItemRowView, orderTotal: OrderTotalContext): boolean {
  if (!orderTotal.hasStoredTotal) return false;
  const unpricedItemCount = orderTotal.itemsCount - orderTotal.pricedItemsCount;
  return unpricedItemCount - (item.price === null ? 1 : 0) > 0;
}

function resolveDeliveryBadge(
  input: {
    shipment: Nullable<BookOrderItemRowShipmentView>;
    uiStatus: Nullable<DeliveryUiStatus>;
  },
  label: (key: DeliveryBadgeKey) => string,
): StatusEntry {
  if (input.uiStatus !== null) {
    const meta = UI_BADGE_META[input.uiStatus];
    return {
      icon: meta.icon,
      label: label(input.uiStatus),
      tone: meta.tone,
      value: input.uiStatus,
    };
  }

  const key = shipmentBadgeKey(input.shipment);
  const base = deliveryStatuses.find((entry) => entry.value === key) ?? deliveryStatuses[0];
  return { ...base, label: label(key) };
}

function shipmentBadgeKey(shipment: Nullable<BookOrderItemRowShipmentView>): DeliveryBadgeKey {
  if (shipment === null) return "ordered";
  if (shipment.status === "in_transit") return "in_transit";
  if (shipment.status === "ready_for_pickup") return "ready_for_pickup";
  return "ordered";
}

function toBookModel(
  item: BookOrderItemRowView,
  options: CardOptions,
  orderTotal: OrderTotalContext,
): DeliveryOrderBookModel {
  const { book, order } = item;

  return {
    authorName: book.firstAuthorName,
    bookHref: `/books/${book.id}`,
    bookId: book.id,
    coverSrc: book.cover?.urls.thumb,
    currency: order.currency,
    id: item.id,
    price: item.price,
    priceText: formatPrice(item.price, order.currency, options.locale),
    resetsOrderTotal: resetsOrderTotal(item, orderTotal),
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
    title: book.title,
  };
}

function toIncompleteOrderTotal(orderTotal: OrderTotalContext): Nullable<IncompleteOrderTotal> {
  if (orderTotal.hasStoredTotal) return null;
  if (orderTotal.pricedItemsCount === 0) return null;
  if (orderTotal.pricedItemsCount === orderTotal.itemsCount) return null;
  return { itemsCount: orderTotal.itemsCount, pricedItemsCount: orderTotal.pricedItemsCount };
}

function toOrderTotalContext(group: OrderGroup): OrderTotalContext {
  return {
    hasStoredTotal: group.order.totalAmount !== null,
    itemsCount: group.order.itemsCount,
    pricedItemsCount: group.order.pricedItemsCount,
  };
}

function toShipmentGroupModel(
  group: ShipmentGroup,
  options: CardOptions,
  orderTotal: OrderTotalContext,
): DeliveryShipmentGroupModel {
  const { shipment } = group.first;
  const trackingUrl = shipment?.trackingUrl ?? null;
  const expectedDeliveryDate = shipment?.expectedDeliveryDate ?? null;
  const pickupUntil = shipment?.pickupUntil ?? null;

  return {
    activeItemsCount: shipment?.activeItemsCount ?? 0,
    badge: resolveDeliveryBadge(
      { shipment, uiStatus: shipment === null ? null : group.first.uiStatus },
      options.labels.badge,
    ),
    books: group.items.map((item) => toBookModel(item, options, orderTotal)),
    expectedDate: expectedDeliveryDate,
    expectedDateText:
      expectedDeliveryDate === null ? null : formatDate(expectedDeliveryDate, options.locale),
    id: group.id,
    note: shipment?.note ?? null,
    pickupUntil,
    pickupUntilText: pickupUntil === null ? null : formatDate(pickupUntil, options.locale),
    serviceName: shipment?.deliveryService?.name ?? null,
    status: shipment?.status ?? null,
    trackingHref: trackingUrl !== null && isHttpsUrl(trackingUrl) ? trackingUrl : null,
    trackingNumber: shipment?.trackingNumber ?? null,
    trackingUrl,
  };
}
