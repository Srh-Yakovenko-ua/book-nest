import type {
  ActiveMoneyAgeQuery,
  ActiveMoneyAgeResponse,
  BookOrderStatisticsQuery,
  BookOrderStatisticsView,
  Nullable,
  StatisticsComparisonPeriod,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { OrderStatisticsRecord } from "../domain/statistics-scope.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildActiveMoneyAge } from "../domain/active-age.js";
import {
  computeBookOrderStatistics,
  ORDER_STATISTICS_TOP_LIMIT,
} from "../domain/order-statistics.js";
import { resolveStatisticsPeriods } from "../domain/statistics-period.js";
import { classifyOrder } from "../domain/statistics-scope.js";
import { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

@Injectable()
export class DeliveryStatisticsService {
  constructor(private readonly deliveryStatisticsRepository: DeliveryStatisticsRepository) {}

  async activeMoneyAge({
    query,
    userId,
  }: {
    query: ActiveMoneyAgeQuery;
    userId: string;
  }): Promise<ActiveMoneyAgeResponse> {
    const now = new Date();
    const records = await this.deliveryStatisticsRepository.listActiveOrderRecords({
      currency: query.currency,
      status: undefined,
      store: query.store,
      userId,
    });

    return buildActiveMoneyAge({
      now,
      orders: records.map((record) => classifyOrder({ includeCancelled: false, record })),
    });
  }

  async statistics({
    query,
    userId,
  }: {
    query: BookOrderStatisticsQuery;
    userId: string;
  }): Promise<BookOrderStatisticsView> {
    const { comparisonPeriod, currentPeriod, requestedPeriod } = resolveStatisticsPeriods({
      compare: query.compare,
      from: query.from,
      now: new Date(),
      to: query.to,
    });

    const [page, activeRecords, previousRecords] = await Promise.all([
      this.deliveryStatisticsRepository.listOrderRecords({
        currency: query.currency,
        from: toPeriodBound(requestedPeriod.from),
        status: query.status,
        store: query.store,
        to: toPeriodBound(requestedPeriod.to),
        userId,
      }),
      this.deliveryStatisticsRepository.listActiveOrderRecords({
        currency: query.currency,
        status: query.status,
        store: query.store,
        userId,
      }),
      this.loadComparisonRecords({ comparisonPeriod, query, userId }),
    ]);

    const { isTruncated, loadedOrdersCount, maxOrders, records } = page;

    return {
      ...computeBookOrderStatistics({
        activeRecords,
        includeCancelled: query.includeCancelled,
        previousRecords,
        records,
        scope: {
          isPeriodFiltered: isPeriodFiltered(query),
          isTruncated,
          period: currentPeriod,
        },
        topLimit: ORDER_STATISTICS_TOP_LIMIT,
      }),
      meta: { comparisonPeriod, currentPeriod, isTruncated, loadedOrdersCount, maxOrders },
    };
  }

  private async loadComparisonRecords({
    comparisonPeriod,
    query,
    userId,
  }: {
    comparisonPeriod: Nullable<StatisticsComparisonPeriod>;
    query: BookOrderStatisticsQuery;
    userId: string;
  }): Promise<Nullable<OrderStatisticsRecord[]>> {
    if (comparisonPeriod === null) {
      return null;
    }

    const { records } = await this.deliveryStatisticsRepository.listOrderRecords({
      currency: query.currency,
      from: toPeriodBound(comparisonPeriod.from),
      status: query.status,
      store: query.store,
      to: toPeriodBound(comparisonPeriod.to),
      userId,
    });

    return records;
  }
}

function isPeriodFiltered(query: BookOrderStatisticsQuery): boolean {
  return (
    query.from !== undefined ||
    query.to !== undefined ||
    query.currency !== undefined ||
    query.status !== undefined ||
    query.store !== undefined
  );
}

function toPeriodBound(isoDay: string | undefined): Date | undefined {
  return isoDay === undefined ? undefined : parseIsoDate(isoDay);
}
