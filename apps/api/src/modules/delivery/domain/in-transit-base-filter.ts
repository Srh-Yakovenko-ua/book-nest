import type { InTransitQuickCountsQuery } from "@app/shared";

import { normalizeSearch } from "@app/shared";

import type { InTransitBaseFilterInput } from "../infrastructure/in-transit-sql.js";
import type { DeliveryDateBounds } from "./delivery-ui-status.js";

export function buildInTransitBaseFilter({
  bounds,
  query,
  userId,
}: {
  bounds: DeliveryDateBounds;
  query: InTransitQuickCountsQuery;
  userId: string;
}): InTransitBaseFilterInput {
  return {
    ageBucket: query.ageBucket,
    booksMax: query.booksMax,
    booksMin: query.booksMin,
    bounds,
    currency: query.currency,
    expectedFrom: query.expectedFrom,
    expectedTo: query.expectedTo,
    orderedFrom: query.orderedFrom,
    orderedTo: query.orderedTo,
    orderId: query.orderId,
    orderState: query.orderState,
    priceCurrency: query.priceCurrency,
    priceMax: query.priceMax,
    priceMin: query.priceMin,
    search: normalizeSearch(query.search),
    service: query.service,
    store: query.store,
    structure: query.structure,
    userId,
  };
}
