import type { BookOrderHistorySort, BookOrderHistoryTab, Currency } from "@app/shared";

import { DEFAULT_CURRENCY } from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";
import { ilikeContains } from "../../../core/database/like-pattern.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { ORDER_EFFECTIVE_TOTAL_SQL } from "./in-transit-sql.js";

export const HISTORY_ITEM_SOURCE = Prisma.sql`
  FROM book_order_items item
  JOIN book_orders book_order ON book_order.id = item.order_id
  JOIN books book ON book.id = item.book_id
  LEFT JOIN shipments shipment ON shipment.id = item.shipment_id
`;

export const HISTORY_CONTENT_SOURCE = Prisma.sql`
  FROM book_order_items item
  JOIN books book ON book.id = item.book_id
  LEFT JOIN shipments shipment ON shipment.id = item.shipment_id
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
  tab: BookOrderHistoryTab;
  to: Date | undefined;
  userId: string;
};

const HISTORY_ORDER_SQL: Record<BookOrderHistorySort, Prisma.Sql> = {
  newest_orders: Prisma.sql`book_order.order_date DESC NULLS LAST`,
  oldest_orders: Prisma.sql`book_order.order_date ASC NULLS LAST`,
  price_asc: Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} ASC NULLS LAST`,
  price_desc: Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} DESC NULLS LAST`,
  recently_updated: Prisma.sql`GREATEST(
    book_order.updated_at,
    COALESCE(
      (SELECT max(touched.updated_at) FROM book_order_items touched WHERE touched.order_id = book_order.id),
      book_order.updated_at
    ),
    COALESCE(
      (SELECT max(dispatched.updated_at) FROM shipments dispatched WHERE dispatched.order_id = book_order.id),
      book_order.updated_at
    )
  ) DESC`,
  store: Prisma.sql`book_order.store_name ASC`,
};

const ORDER_SEARCH_COLUMNS: Prisma.Sql[] = [
  Prisma.sql`book_order.store_name`,
  Prisma.sql`book_order.order_number`,
  Prisma.sql`book_order.note`,
];

const CONTENT_SEARCH_COLUMNS: Prisma.Sql[] = [
  Prisma.sql`book.title`,
  Prisma.sql`book.original_title`,
  Prisma.sql`book.first_author_name`,
  Prisma.sql`shipment.tracking_number`,
  Prisma.sql`shipment.delivery_service_name`,
  Prisma.sql`shipment.note`,
  Prisma.sql`shipment.cancel_reason`,
  Prisma.sql`item.cancel_reason`,
];

export function buildHistoryContentConditions({
  hasTrackingNumber,
  hasTrackingUrl,
  service,
  tab,
}: HistoryFilterInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [LIVE_HISTORY_ITEM_SQL, historyTabSql(tab)];

  if (service !== undefined) {
    conditions.push(Prisma.sql`lower(shipment.delivery_service_name) = lower(${service})`);
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

  return Prisma.join(conditions, " AND ");
}

export function buildHistoryOrderConditions(filter: HistoryFilterInput): Prisma.Sql {
  const { currency, from, priceMax, priceMin, search, store, to, userId } = filter;
  const content = buildHistoryContentConditions(filter);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`book_order.user_id = ${userId}::uuid`,
    correlatedContentSql(content),
  ];

  if (store !== undefined) {
    conditions.push(Prisma.sql`lower(book_order.store_name) = lower(${store})`);
  }

  if (currency !== undefined) {
    conditions.push(orderCurrencySql(currency));
  }

  if (from !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date >= ${from}::date`);
  }

  if (to !== undefined) {
    conditions.push(Prisma.sql`book_order.order_date <= ${to}::date`);
  }

  if (priceMin !== undefined) {
    conditions.push(Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} >= ${priceMin}`);
  }

  if (priceMax !== undefined) {
    conditions.push(Prisma.sql`${ORDER_EFFECTIVE_TOTAL_SQL} <= ${priceMax}`);
  }

  if (search !== undefined) {
    conditions.push(historySearchSql({ content, search }));
  }

  return Prisma.join(conditions, " AND ");
}

export function historyContentOrderSql(orderIds: string[]): Prisma.Sql {
  return Prisma.sql`
    array_position(${orderIds}::uuid[], item.order_id),
    (shipment.id IS NULL),
    shipment.created_at,
    shipment.id,
    book.title,
    item.id
  `;
}

export function historyOrderSql(sort: BookOrderHistorySort): Prisma.Sql {
  if (!Object.hasOwn(HISTORY_ORDER_SQL, sort)) {
    throw new Error(`Unsupported delivery history sort: ${String(sort)}`);
  }
  return Prisma.sql`${HISTORY_ORDER_SQL[sort]}, book_order.id ASC`;
}

function correlatedContentSql(content: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1
    ${HISTORY_CONTENT_SOURCE}
    WHERE item.order_id = book_order.id AND ${content}
  )`;
}

function historySearchSql({
  content,
  search,
}: {
  content: Prisma.Sql;
  search: string;
}): Prisma.Sql {
  const onOrder = ORDER_SEARCH_COLUMNS.map((column) => ilikeContains({ column, search }));
  const inContent = CONTENT_SEARCH_COLUMNS.map((column) => ilikeContains({ column, search }));

  return Prisma.sql`(
    ${Prisma.join(onOrder, " OR ")}
    OR EXISTS (
      SELECT 1
      ${HISTORY_CONTENT_SOURCE}
      WHERE item.order_id = book_order.id
        AND ${content}
        AND (${Prisma.join(inContent, " OR ")})
    )
  )`;
}

function historyTabSql(tab: BookOrderHistoryTab): Prisma.Sql {
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

function orderCurrencySql(currency: Currency): Prisma.Sql {
  if (currency !== DEFAULT_CURRENCY) {
    return Prisma.sql`book_order.currency = ${currency}`;
  }
  return Prisma.sql`(
    book_order.currency = ${currency}
    OR (
      book_order.currency IS NULL
      AND EXISTS (
        SELECT 1
        FROM book_order_items priced_item
        JOIN books priced_book ON priced_book.id = priced_item.book_id
        WHERE priced_item.order_id = book_order.id
          AND priced_book.deleted_at IS NULL
          AND priced_item.price IS NOT NULL
      )
    )
  )`;
}

function presenceSql({ column, present }: { column: Prisma.Sql; present: boolean }): Prisma.Sql {
  return present ? Prisma.sql`${column} IS NOT NULL` : Prisma.sql`${column} IS NULL`;
}
