import type {
  BookOrderHistoryFacetsView,
  BookOrderHistoryOutcomeView,
  BookOrderHistorySummaryView,
  BookOrderItemRowView,
  InTransitFacetsView,
  InTransitImpactView,
  InTransitSummaryView,
  PaginatedOrderHistoryGroups,
  Paginator,
} from "@app/shared";

import {
  BookOrderHistoryFacetsQuerySchema,
  BookOrderHistoryQuerySchema,
  InTransitQuerySchema,
} from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { DeliveryReadService } from "../application/delivery-read.service.js";
import { BookOrderHistoryFacetsQueryDto } from "./input-dto/book-order-history-facets-query.input-dto.js";
import { BookOrderHistoryQueryDto } from "./input-dto/book-order-history-query.input-dto.js";
import { InTransitQueryDto } from "./input-dto/in-transit-query.input-dto.js";
import { BookOrderHistoryFacetsViewDto } from "./view-dto/book-order-history-facets.view-dto.js";
import { BookOrderHistoryOutcomeViewDto } from "./view-dto/book-order-history-outcome.view-dto.js";
import { BookOrderHistorySummaryViewDto } from "./view-dto/book-order-history-summary.view-dto.js";
import { InTransitFacetsViewDto } from "./view-dto/in-transit-facets.view-dto.js";
import { InTransitImpactViewDto } from "./view-dto/in-transit-impact.view-dto.js";
import { InTransitSummaryViewDto } from "./view-dto/in-transit-summary.view-dto.js";
import { PaginatedBookOrderItemRowsDto } from "./view-dto/paginated-book-order-item-rows.view-dto.js";
import { PaginatedOrderHistoryGroupsDto } from "./view-dto/paginated-order-history-groups.view-dto.js";

@ApiTags("delivery-read")
@Controller("api/delivery")
@JwtProtected()
export class DeliveryReadController {
  constructor(private readonly deliveryReadService: DeliveryReadService) {}

  @ApiOkResponse({
    description: "Summary metrics for the books the current user has on their way",
    type: InTransitSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary metrics for the books the current user has on their way" })
  @Get("books/in-transit/summary")
  @Throttle(READ_THROTTLE)
  inTransitSummary(@CurrentUser() user: AuthenticatedUser): Promise<InTransitSummaryView> {
    return this.deliveryReadService.inTransitSummary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "What receiving the books in the current user's active deliveries would change",
    type: InTransitImpactViewDto,
  })
  @ApiOperation({
    summary: "Get what receiving the books in the current user's active deliveries would change",
  })
  @Get("books/in-transit/impact")
  @Throttle(READ_THROTTLE)
  inTransitImpact(@CurrentUser() user: AuthenticatedUser): Promise<InTransitImpactView> {
    return this.deliveryReadService.inTransitImpact({ userId: user.id });
  }

  @ApiOkResponse({
    description:
      "The stores and delivery services the current user's active deliveries run through",
    type: InTransitFacetsViewDto,
  })
  @ApiOperation({
    summary: "List the stores and delivery services behind the books on their way",
  })
  @Get("books/in-transit/facets")
  @Throttle(READ_THROTTLE)
  inTransitFacets(@CurrentUser() user: AuthenticatedUser): Promise<InTransitFacetsView> {
    return this.deliveryReadService.inTransitFacets({ userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of the books the current user has on their way",
    type: PaginatedBookOrderItemRowsDto,
  })
  @ApiOperation({ summary: "List the books the current user has on their way" })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "ageBucket", required: false })
  @ApiQuery({ isArray: true, name: "store", required: false, type: String })
  @ApiQuery({ isArray: true, name: "service", required: false, type: String })
  @ApiQuery({ isArray: true, name: "currency", required: false, type: String })
  @ApiQuery({ isArray: true, name: "structure", required: false, type: String })
  @ApiQuery({ name: "orderedFrom", required: false })
  @ApiQuery({ name: "orderedTo", required: false })
  @ApiQuery({ name: "expectedFrom", required: false })
  @ApiQuery({ name: "expectedTo", required: false })
  @ApiQuery({ name: "booksMin", required: false })
  @ApiQuery({ name: "booksMax", required: false })
  @ApiQuery({ name: "priceCurrency", required: false })
  @ApiQuery({ name: "priceMin", required: false })
  @ApiQuery({ name: "priceMax", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("books/in-transit")
  @Throttle(READ_THROTTLE)
  inTransitList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(InTransitQuerySchema)) query: InTransitQueryDto,
  ): Promise<Paginator<BookOrderItemRowView>> {
    return this.deliveryReadService.inTransitList({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "All-time overview of the current user's finished delivery history",
    type: BookOrderHistorySummaryViewDto,
  })
  @ApiOperation({ summary: "Get the all-time overview of the finished delivery history" })
  @Get("books/history/summary")
  @Throttle(READ_THROTTLE)
  historySummary(@CurrentUser() user: AuthenticatedUser): Promise<BookOrderHistorySummaryView> {
    return this.deliveryReadService.historySummary(user.id);
  }

  @ApiOkResponse({
    description: "What the books the current user already received changed",
    type: BookOrderHistoryOutcomeViewDto,
  })
  @ApiOperation({
    summary: "Get what the already received books changed for reading and for series",
  })
  @Get("books/history/outcome")
  @Throttle(READ_THROTTLE)
  historyOutcome(@CurrentUser() user: AuthenticatedUser): Promise<BookOrderHistoryOutcomeView> {
    return this.deliveryReadService.historyOutcome({ userId: user.id });
  }

  @ApiOkResponse({
    description: "The stores and delivery services behind the finished orders of one history tab",
    type: BookOrderHistoryFacetsViewDto,
  })
  @ApiOperation({
    summary: "List the stores and delivery services behind one tab of the order history",
  })
  @ApiQuery({ name: "tab", required: true })
  @Get("books/history/facets")
  @Throttle(READ_THROTTLE)
  historyFacets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(BookOrderHistoryFacetsQuerySchema))
    query: BookOrderHistoryFacetsQueryDto,
  ): Promise<BookOrderHistoryFacetsView> {
    return this.deliveryReadService.historyFacets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "A page of finished orders, each carrying the parcels and books of the requested tab",
    type: PaginatedOrderHistoryGroupsDto,
  })
  @ApiOperation({
    summary: "List the finished orders of the current user, grouped into their parcels and books",
  })
  @ApiQuery({ name: "tab", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ isArray: true, name: "store", required: false, type: String })
  @ApiQuery({ isArray: true, name: "service", required: false, type: String })
  @ApiQuery({ isArray: true, name: "currency", required: false, type: String })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "receivedFrom", required: false })
  @ApiQuery({ name: "receivedTo", required: false })
  @ApiQuery({ name: "cancelledFrom", required: false })
  @ApiQuery({ name: "cancelledTo", required: false })
  @ApiQuery({ name: "booksMin", required: false })
  @ApiQuery({ name: "booksMax", required: false })
  @ApiQuery({ name: "priceCurrency", required: false })
  @ApiQuery({ name: "priceMin", required: false })
  @ApiQuery({ name: "priceMax", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("books/history")
  @Throttle(READ_THROTTLE)
  historyList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(BookOrderHistoryQuerySchema)) query: BookOrderHistoryQueryDto,
  ): Promise<PaginatedOrderHistoryGroups> {
    return this.deliveryReadService.historyList({ query, userId: user.id });
  }
}
