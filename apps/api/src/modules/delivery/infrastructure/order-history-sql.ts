import type { Currency, DeliveryHistorySort, DeliveryHistoryTab } from "@app/shared";

import { ShipmentStatusSchema } from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";
import { ilikeContains } from "../../../core/database/like-pattern.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { currencySql } from "./in-transit-sql.js";

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

export const HISTORY_ITEM_SOURCE = Prisma.sql`
  FROM book_order_items item
  JOIN book_orders book_order ON book_order.id = item.order_id
  JOIN books book ON book.id = item.book_id
  LEFT JOIN shipments shipment ON shipment.id = item.shipment_id
`;

export const ITEM_EFFECTIVE_STATUS_SQL = Prisma.sql`
  CASE
    WHEN item.cancelled_at IS NOT NULL THEN ${SHIPMENT_STATUS.cancelled}
    WHEN item.received_at IS NOT NULL THEN ${SHIPMENT_STATUS.received}
    ELSE COALESCE(shipment.status, ${SHIPMENT_STATUS.ordered})
  END
`;

export const LIVE_HISTORY_ITEM_SQL = Prisma.sql`book.deleted_at IS NULL`;

export type HistoryFilterInput = {
  currency: Currency | undefined;
  from: Date | undefined;
  hasTrackingNumber: boolean | undefined;
  hasTrackingUrl: boolean | undefined;
  priceMax: number | undefined;
  priceMin: number | undefined;
  search: string | undefined;
  service: string | undefined;
  store: string | undefined;
  tab: DeliveryHistoryTab;
  to: Date | undefined;
  userId: string;
};

const HISTORY_ORDER_SQL: Record<DeliveryHistorySort, Prisma.Sql> = {
  newest_orders: Prisma.sql`book_order.order_date DESC NULLS LAST`,
  oldest_orders: Prisma.sql`book_order.order_date ASC NULLS LAST`,
  price: Prisma.sql`item.price DESC NULLS LAST`,
  recently_updated: Prisma.sql`GREATEST(
    item.updated_at,
    book_order.updated_at,
    COALESCE(shipment.updated_at, item.updated_at)
  ) DESC`,
  status: Prisma.sql`(${ITEM_EFFECTIVE_STATUS_SQL}) ASC`,
  store: Prisma.sql`book_order.store_name ASC`,
  title: Prisma.sql`book.title ASC`,
};

const HISTORY_SEARCH_COLUMNS: Prisma.Sql[] = [
  Prisma.sql`book.title`,
  Prisma.sql`book.original_title`,
  Prisma.sql`book.first_author_name`,
  Prisma.sql`book_order.store_name`,
  Prisma.sql`book_order.order_number`,
  Prisma.sql`book_order.note`,
  Prisma.sql`shipment.tracking_number`,
  Prisma.sql`shipment.delivery_service_name`,
  Prisma.sql`shipment.note`,
  Prisma.sql`shipment.cancel_reason`,
  Prisma.sql`item.cancel_reason`,
];

export function buildHistoryConditions({
  currency,
  from,
  hasTrackingNumber,
  hasTrackingUrl,
  priceMax,
  priceMin,
  search,
  service,
  store,
  tab,
  to,
  userId,
}: HistoryFilterInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`book_order.user_id = ${userId}::uuid`,
    LIVE_HISTORY_ITEM_SQL,
    historyTabSql(tab),
  ];

  if (store !== undefined) {
    conditions.push(Prisma.sql`lower(book_order.store_name) = lower(${store})`);
  }

  if (service !== undefined) {
    conditions.push(Prisma.sql`lower(shipment.delivery_service_name) = lower(${service})`);
  }

  if (currency !== undefined) {
    conditions.push(currencySql(currency));
  }

  if (from !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date >= ${from}::date`);
  }

  if (to !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date <= ${to}::date`);
  }

  if (priceMin !== undefined) {
    conditions.push(Prisma.sql`item.price >= ${priceMin}`);
  }

  if (priceMax !== undefined) {
    conditions.push(Prisma.sql`item.price <= ${priceMax}`);
  }

  if (hasTrackingNumber !== undefined) {
    conditions.push(
      presenceSql({ column: Prisma.sql`shipment.tracking_number`, present: hasTrackingNumber }),
    );
  }

  if (hasTrackingUrl !== undefined) {
    conditions.push(
      presenceSql({ column: Prisma.sql`shipment.tracking_url`, present: hasTrackingUrl }),
    );
  }

  if (search !== undefined) {
    conditions.push(searchSql(search));
  }

  return Prisma.join(conditions, " AND ");
}

export function historyOrderSql(sort: DeliveryHistorySort): Prisma.Sql {
  return Prisma.sql`${historySortSql(sort)}, item.id ASC`;
}

function historySortSql(sort: DeliveryHistorySort): Prisma.Sql {
  if (!Object.hasOwn(HISTORY_ORDER_SQL, sort)) {
    throw new Error(`Unsupported delivery history sort: ${String(sort)}`);
  }
  return HISTORY_ORDER_SQL[sort];
}

function historyTabSql(tab: DeliveryHistoryTab): Prisma.Sql {
  switch (tab) {
    case "active":
      return Prisma.sql`item.cancelled_at IS NULL AND item.received_at IS NULL`;
    case "all":
      return Prisma.sql`TRUE`;
    case "cancelled":
      return Prisma.sql`item.cancelled_at IS NOT NULL`;
    case "received":
      return Prisma.sql`item.received_at IS NOT NULL`;
    default:
      return assertNever(tab);
  }
}

function presenceSql({ column, present }: { column: Prisma.Sql; present: boolean }): Prisma.Sql {
  return present ? Prisma.sql`${column} IS NOT NULL` : Prisma.sql`${column} IS NULL`;
}

function searchSql(search: string): Prisma.Sql {
  const matches = HISTORY_SEARCH_COLUMNS.map((column) => ilikeContains({ column, search }));
  return Prisma.sql`(${Prisma.join(matches, " OR ")})`;
}
