import type {
  BookOrderHistoryQuery,
  BookOrderHistorySummaryView,
  BookOrderItemRowView,
  BookOrderStatisticsQuery,
  BookOrderStatisticsView,
  BookPreview,
  InTransitFacetEntry,
  InTransitFacetsView,
  InTransitImpactView,
  InTransitQuery,
  InTransitSummaryView,
  NextShipmentBookView,
  NextShipmentView,
  Paginator,
} from "@app/shared";

import {
  NEXT_SHIPMENT_LIMITS,
  normalizeSearch,
  OwnershipStatusSchema,
  ReadingStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  BookOrderItemRow,
  NextShipmentBookRow,
  NextShipmentData,
} from "../infrastructure/delivery-read.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { MediaService } from "../../media/index.js";
import { buildInTransitSummaryView } from "../domain/delivery-summary.js";
import { deliveryDateBounds } from "../domain/delivery-ui-status.js";
import { buildInTransitImpact } from "../domain/in-transit-impact.js";
import { toNextShipmentView } from "../domain/next-shipment.mapper.js";
import { buildOrderHistorySummaryView } from "../domain/order-history-summary.js";
import { toBookOrderItemRowView } from "../domain/order-item-row.mapper.js";
import {
  computeBookOrderStatistics,
  ORDER_STATISTICS_TOP_LIMIT,
} from "../domain/order-statistics.js";
import { DeliveryImpactRepository } from "../infrastructure/delivery-impact.repository.js";
import { DeliveryReadRepository } from "../infrastructure/delivery-read.repository.js";
import { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

@Injectable()
export class DeliveryReadService {
  constructor(
    private readonly deliveryImpactRepository: DeliveryImpactRepository,
    private readonly deliveryReadRepository: DeliveryReadRepository,
    private readonly deliveryStatisticsRepository: DeliveryStatisticsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async historyList({
    query,
    userId,
  }: {
    query: BookOrderHistoryQuery;
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

  async historySummary(userId: string): Promise<BookOrderHistorySummaryView> {
    return buildOrderHistorySummaryView(await this.deliveryReadRepository.historySummary(userId));
  }

  async inTransitFacets({ userId }: { userId: string }): Promise<InTransitFacetsView> {
    const rows = await this.deliveryReadRepository.inTransitFacets(userId);

    return {
      services: sortFacetEntries(rows.services),
      stores: sortFacetEntries(rows.stores),
    };
  }

  async inTransitImpact({ userId }: { userId: string }): Promise<InTransitImpactView> {
    const { today } = deliveryDateBounds(new Date());

    const [seriesRows, queueRows, goalRows] = await Promise.all([
      this.deliveryImpactRepository.listSeriesRows(userId),
      this.deliveryImpactRepository.listQueueRows(userId),
      this.deliveryImpactRepository.listGoalRows({ today, userId }),
    ]);

    return { items: buildInTransitImpact({ goalRows, queueRows, seriesRows }) };
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
      booksMax: query.booksMax,
      booksMin: query.booksMin,
      bounds,
      currency: query.currency,
      expectedFrom: query.expectedFrom,
      expectedTo: query.expectedTo,
      filter: query.filter,
      orderedFrom: query.orderedFrom,
      orderedTo: query.orderedTo,
      priceCurrency: query.priceCurrency,
      priceMax: query.priceMax,
      priceMin: query.priceMin,
      pricePresence: query.pricePresence,
      search: normalizeSearch(query.search),
      service: query.service,
      store: query.store,
      structure: query.structure,
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
    const bounds = deliveryDateBounds(new Date());

    const [data, nextShipment] = await Promise.all([
      this.deliveryReadRepository.inTransitSummary({ bounds, userId }),
      this.deliveryReadRepository.nextShipment({
        bookPreviewsMax: NEXT_SHIPMENT_LIMITS.bookPreviewsMax,
        today: bounds.today,
        userId,
      }),
    ]);

    return buildInTransitSummaryView({
      ...data,
      nextShipment: nextShipment === null ? null : this.toNextShipmentView(nextShipment),
      today: bounds.today,
    });
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
          : {
              id: book.series.id,
              name: book.series.name,
              partNumber: book.partNumber,
              totalBooks: book.series.totalBooks,
            },
      tags: book.tags.map((bookTag) => bookTag.tag.name),
      title: book.title,
    };
  }

  private toNextShipmentBookView(item: NextShipmentBookRow): NextShipmentBookView {
    return {
      authorName: item.book.firstAuthorName,
      cover: this.mediaService.buildViewOrNull(item.book.coverMedia),
      id: item.book.id,
      title: item.book.title,
    };
  }

  private toNextShipmentView(data: NextShipmentData): NextShipmentView {
    return toNextShipmentView({
      bookPreviews: data.bookPreviews.map((item) => this.toNextShipmentBookView(item)),
      booksCount: data.booksCount,
      sameDayCount: data.sameDayCount,
      shipment: data.shipment,
    });
  }

  private toRowView({ row, today }: { row: BookOrderItemRow; today: Date }): BookOrderItemRowView {
    return toBookOrderItemRowView({ book: this.toBookPreview(row.book), row, today });
  }
}

function sortFacetEntries(entries: InTransitFacetEntry[]): InTransitFacetEntry[] {
  return [...entries].sort(
    (left, right) => right.count - left.count || UKRAINIAN_COLLATION.compare(left.name, right.name),
  );
}
