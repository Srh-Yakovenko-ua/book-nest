import type {
  BookOrderItemRowView,
  BookOrderStatisticsQuery,
  BookOrderStatisticsView,
  BookPreview,
  DeliveryHistoryQuery,
  InTransitQuery,
  InTransitSummaryView,
  Paginator,
} from "@app/shared";

import { normalizeSearch, OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { OrderHistorySummaryView } from "../domain/order-history-summary.js";
import type { BookOrderItemRow } from "../infrastructure/delivery-read.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import { buildInTransitSummaryView } from "../domain/delivery-summary.js";
import { deliveryDateBounds } from "../domain/delivery-ui-status.js";
import { buildOrderHistorySummaryView } from "../domain/order-history-summary.js";
import { toBookOrderItemRowView } from "../domain/order-item-row.mapper.js";
import {
  computeBookOrderStatistics,
  ORDER_STATISTICS_TOP_LIMIT,
} from "../domain/order-statistics.js";
import { DeliveryReadRepository } from "../infrastructure/delivery-read.repository.js";
import { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

@Injectable()
export class DeliveryReadService {
  constructor(
    private readonly deliveryReadRepository: DeliveryReadRepository,
    private readonly deliveryStatisticsRepository: DeliveryStatisticsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async historyList({
    query,
    userId,
  }: {
    query: DeliveryHistoryQuery;
    userId: string;
  }): Promise<Paginator<BookOrderItemRowView>> {
    const { today } = deliveryDateBounds(new Date());
    const filter = {
      currency: query.currency,
      from: query.from === undefined ? undefined : parseIsoDate(query.from),
      hasTrackingNumber: query.hasTrackingNumber,
      hasTrackingUrl: query.hasTrackingUrl,
      priceMax: query.priceMax,
      priceMin: query.priceMin,
      search: normalizeSearch(query.search),
      service: query.service,
      store: query.store,
      tab: query.tab,
      to: query.to === undefined ? undefined : parseIsoDate(query.to),
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.deliveryReadRepository.listHistory({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryReadRepository.countHistory(filter),
    ]);

    return buildPaginator({
      items: rows.map((row) => this.toRowView({ row, today })),
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
  }): Promise<OrderHistorySummaryView> {
    const data = await this.deliveryReadRepository.historySummary({ includeCancelled, userId });

    return buildOrderHistorySummaryView(data);
  }

  async inTransitList({
    query,
    userId,
  }: {
    query: InTransitQuery;
    userId: string;
  }): Promise<Paginator<BookOrderItemRowView>> {
    const bounds = deliveryDateBounds(new Date());
    const filter = {
      bounds,
      currency: query.currency,
      filter: query.filter,
      search: normalizeSearch(query.search),
      service: query.service,
      store: query.store,
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.deliveryReadRepository.listInTransit({
        ...filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.deliveryReadRepository.countInTransit(filter),
    ]);

    return buildPaginator({
      items: rows.map((row) => this.toRowView({ row, today: bounds.today })),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async inTransitSummary({ userId }: { userId: string }): Promise<InTransitSummaryView> {
    const data = await this.deliveryReadRepository.inTransitSummary({
      bounds: deliveryDateBounds(new Date()),
      userId,
    });

    return buildInTransitSummaryView(data);
  }

  async statistics({
    query,
    userId,
  }: {
    query: BookOrderStatisticsQuery;
    userId: string;
  }): Promise<BookOrderStatisticsView> {
    const records = await this.deliveryStatisticsRepository.listOrderRecords({
      currency: query.currency,
      from: query.from === undefined ? undefined : parseIsoDate(query.from),
      status: query.status,
      store: query.store,
      to: query.to === undefined ? undefined : parseIsoDate(query.to),
      userId,
    });

    return computeBookOrderStatistics({
      includeCancelled: query.includeCancelled,
      records,
      topLimit: ORDER_STATISTICS_TOP_LIMIT,
    });
  }

  private toBookPreview(book: BookOrderItemRow["book"]): BookPreview {
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

  private toRowView({ row, today }: { row: BookOrderItemRow; today: Date }): BookOrderItemRowView {
    return toBookOrderItemRowView({ book: this.toBookPreview(row.book), row, today });
  }
}
