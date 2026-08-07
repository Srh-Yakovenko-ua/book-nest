import type {
  BulkReceiveDeliveriesResultView,
  Currency,
  DeliveryBookPreview,
  DeliveryHistoryQuery,
  DeliveryHistorySummaryView,
  DeliveryInTransitQuery,
  DeliveryInTransitSummaryView,
  DeliveryListItemView,
  DeliveryStatisticsQuery,
  DeliveryStatisticsView,
  Nullable,
  Paginator,
} from "@app/shared";

import {
  CurrencySchema,
  isActiveDeliveryStatus,
  normalizeName,
  normalizeSearch,
  OwnershipStatusSchema,
  ReadingStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { computeDeliveryStatistics, STATISTICS_TOP_LIMIT } from "../domain/delivery-statistics.js";
import { computeReceiveDelivery } from "../domain/delivery-transition.js";
import { deliveryDateBounds, getDeliveryUiStatus } from "../domain/delivery-ui-status.js";
import { toDeliveryView } from "../domain/delivery.mapper.js";
import {
  DeliveryRepository,
  type DeliveryWithBook,
  type InTransitCurrencyTotal,
} from "../infrastructure/delivery.repository.js";

const DEFAULT_CURRENCY: Currency = "UAH";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly mediaService: MediaService,
  ) {}

  async bulkReceive({
    bookIds,
    receivedAt,
    userId,
  }: {
    bookIds: string[];
    receivedAt?: string;
    userId: string;
  }): Promise<BulkReceiveDeliveriesResultView> {
    const now = new Date();
    const transition = computeReceiveDelivery({ now, receivedAt });
    const uniqueBookIds = [...new Set(bookIds)];

    const outcomes = await this.deliveryRepository.bulkReceive({
      bookIds: uniqueBookIds,
      transition,
      userId,
    });

    const receivedBookIds: string[] = [];
    const skipped: BulkReceiveDeliveriesResultView["skipped"] = [];
    for (const outcome of outcomes) {
      if (outcome.status === "received") {
        receivedBookIds.push(outcome.bookId);
        continue;
      }
      skipped.push({ bookId: outcome.bookId, reason: outcome.reason });
    }

    return { receivedBookIds, skipped };
  }

  async historyList({
    query,
    userId,
  }: {
    query: DeliveryHistoryQuery;
    userId: string;
  }): Promise<Paginator<DeliveryListItemView>> {
    const { today } = deliveryDateBounds(new Date());
    const search = normalizeSearch(query.search);
    const filter = {
      currency: query.currency,
      from: query.from === undefined ? undefined : parseIsoDate(query.from),
      hasTrackingNumber: query.hasTrackingNumber,
      hasTrackingUrl: query.hasTrackingUrl,
      priceMax: query.priceMax,
      priceMin: query.priceMin,
      search,
      service: query.service,
      store: query.store,
      tab: query.tab,
      to: query.to === undefined ? undefined : parseIsoDate(query.to),
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.deliveryRepository.listHistory({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryRepository.countHistory(filter),
    ]);

    return buildPaginator({
      items: items.map((delivery) => this.toHistoryListItemView({ delivery, today })),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async historySummary({
    includeCancelled,
    userId,
  }: {
    includeCancelled: boolean;
    userId: string;
  }): Promise<DeliveryHistorySummaryView> {
    const data = await this.deliveryRepository.historySummary({ includeCancelled, userId });

    return {
      activeCount: data.activeCount,
      cancelledCount: data.cancelledCount,
      receivedCount: data.receivedCount,
      totalByCurrency: toCurrencyTotals(data.currencyTotals),
      totalOrders: data.totalOrders,
    };
  }

  async inTransitList({
    query,
    userId,
  }: {
    query: DeliveryInTransitQuery;
    userId: string;
  }): Promise<Paginator<DeliveryListItemView>> {
    const { soonEnd, today, weekEnd, weekStart } = deliveryDateBounds(new Date());
    const search = normalizeSearch(query.search);
    const filter = {
      filter: query.filter,
      search,
      service: query.service,
      soonEnd,
      store: query.store,
      today,
      userId,
      weekEnd,
      weekStart,
    };

    const [items, totalCount] = await Promise.all([
      this.deliveryRepository.listActive({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryRepository.countActive(filter),
    ]);

    return buildPaginator({
      items: items.map((delivery) => this.toListItemView({ delivery, today })),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async inTransitSummary({ userId }: { userId: string }): Promise<DeliveryInTransitSummaryView> {
    const { today, weekEnd, weekStart } = deliveryDateBounds(new Date());
    const data = await this.deliveryRepository.summaryData({ today, userId, weekEnd, weekStart });

    return {
      activeCount: data.activeCount,
      delayedCount: data.delayedCount,
      expectedThisWeek: data.expectedThisWeek,
      totalByCurrency: toCurrencyTotals(data.currencyTotals),
      uniqueStores: countUniqueStores(data.storeNames),
    };
  }

  async statistics({
    query,
    userId,
  }: {
    query: DeliveryStatisticsQuery;
    userId: string;
  }): Promise<DeliveryStatisticsView> {
    const records = await this.deliveryRepository.listStatisticsRecords({
      currency: query.currency,
      from: query.from === undefined ? undefined : parseIsoDate(query.from),
      status: query.status,
      store: query.store,
      to: query.to === undefined ? undefined : parseIsoDate(query.to),
      userId,
    });

    return computeDeliveryStatistics({
      includeCancelled: query.includeCancelled,
      records,
      topLimit: STATISTICS_TOP_LIMIT,
    });
  }

  private toBookPreview(book: DeliveryWithBook["book"]): DeliveryBookPreview {
    return {
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      firstAuthorName: book.firstAuthorName,
      genres: book.genres,
      id: book.id,
      originalTitle: book.originalTitle,
      ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
      publisher:
        book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
      readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      series:
        book.series === null
          ? null
          : { id: book.series.id, name: book.series.name, partNumber: book.partNumber },
      tags: book.tags.map((bookTag) => bookTag.tag.name),
      title: book.title,
    };
  }

  private toHistoryListItemView({
    delivery,
    today,
  }: {
    delivery: DeliveryWithBook;
    today: Date;
  }): DeliveryListItemView {
    const deliveryView = toDeliveryView(delivery);
    return {
      book: this.toBookPreview(delivery.book),
      delivery: deliveryView,
      id: delivery.id,
      uiStatus: isActiveDeliveryStatus(deliveryView.status)
        ? getDeliveryUiStatus({ expectedDeliveryDate: delivery.expectedDeliveryDate, today })
        : null,
    };
  }

  private toListItemView({
    delivery,
    today,
  }: {
    delivery: DeliveryWithBook;
    today: Date;
  }): DeliveryListItemView {
    return {
      book: this.toBookPreview(delivery.book),
      delivery: toDeliveryView(delivery),
      id: delivery.id,
      uiStatus: getDeliveryUiStatus({
        expectedDeliveryDate: delivery.expectedDeliveryDate,
        today,
      }),
    };
  }
}

function countUniqueStores(storeNames: Nullable<string>[]): number {
  const normalized = new Set<string>();
  for (const storeName of storeNames) {
    if (storeName === null) {
      continue;
    }
    const key = normalizeName(storeName);
    if (key.length === 0) {
      continue;
    }
    normalized.add(key);
  }
  return normalized.size;
}

function toCurrencyTotals(
  totals: InTransitCurrencyTotal[],
): DeliveryInTransitSummaryView["totalByCurrency"] {
  const merged = new Map<Currency, number>();
  for (const entry of totals) {
    const currency =
      entry.currency === null ? DEFAULT_CURRENCY : CurrencySchema.parse(entry.currency);
    merged.set(currency, (merged.get(currency) ?? 0) + entry.total);
  }

  const result: DeliveryInTransitSummaryView["totalByCurrency"] = [];
  for (const currency of CurrencySchema.options) {
    const total = merged.get(currency);
    if (total === undefined) {
      continue;
    }
    result.push({ currency, total });
  }
  return result;
}
