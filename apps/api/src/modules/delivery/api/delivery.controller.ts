import type {
  BulkReceiveDeliveriesResultView,
  DeliveryHistorySummaryView,
  DeliveryInTransitSummaryView,
  DeliveryListItemView,
  DeliveryStatisticsView,
  Paginator,
} from "@app/shared";

import {
  BulkReceiveDeliveriesInputSchema,
  DeliveryHistoryQuerySchema,
  DeliveryHistorySummaryQuerySchema,
  DeliveryInTransitQuerySchema,
  DeliveryStatisticsQuerySchema,
} from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { DeliveryService } from "../application/delivery.service.js";
import { BulkReceiveDeliveriesInputDto } from "./input-dto/bulk-receive-deliveries.input-dto.js";
import { DeliveryHistoryQueryDto } from "./input-dto/delivery-history-query.input-dto.js";
import { DeliveryHistorySummaryQueryDto } from "./input-dto/delivery-history-summary-query.input-dto.js";
import { DeliveryInTransitQueryDto } from "./input-dto/delivery-in-transit-query.input-dto.js";
import { DeliveryStatisticsQueryDto } from "./input-dto/delivery-statistics-query.input-dto.js";
import { BulkReceiveDeliveriesResultViewDto } from "./view-dto/bulk-receive-deliveries-result.view-dto.js";
import { DeliveryHistorySummaryViewDto } from "./view-dto/delivery-history-summary.view-dto.js";
import { DeliveryInTransitSummaryViewDto } from "./view-dto/delivery-in-transit-summary.view-dto.js";
import { DeliveryStatisticsViewDto } from "./view-dto/delivery-statistics.view-dto.js";
import { PaginatedDeliveriesDto } from "./view-dto/paginated-deliveries.view-dto.js";

@ApiTags("delivery")
@Controller("api/delivery")
@JwtProtected()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @ApiOkResponse({
    description: "Summary metrics for the current user's in-transit deliveries",
    type: DeliveryInTransitSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary metrics for the current user's in-transit deliveries" })
  @Get("in-transit/summary")
  inTransitSummary(@CurrentUser() user: AuthenticatedUser): Promise<DeliveryInTransitSummaryView> {
    return this.deliveryService.inTransitSummary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of the current user's in-transit deliveries",
    type: PaginatedDeliveriesDto,
  })
  @ApiOperation({ summary: "List the current user's in-transit deliveries" })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "store", required: false })
  @ApiQuery({ name: "service", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("in-transit")
  inTransitList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(DeliveryInTransitQuerySchema)) query: DeliveryInTransitQueryDto,
  ): Promise<Paginator<DeliveryListItemView>> {
    return this.deliveryService.inTransitList({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Summary metrics for the current user's order history",
    type: DeliveryHistorySummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary metrics for the current user's order history" })
  @ApiQuery({ name: "includeCancelled", required: false })
  @Get("history/summary")
  historySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(DeliveryHistorySummaryQuerySchema))
    query: DeliveryHistorySummaryQueryDto,
  ): Promise<DeliveryHistorySummaryView> {
    return this.deliveryService.historySummary({
      includeCancelled: query.includeCancelled,
      userId: user.id,
    });
  }

  @ApiOkResponse({
    description: "A page of the current user's order history",
    type: PaginatedDeliveriesDto,
  })
  @ApiOperation({ summary: "List the current user's order history" })
  @ApiQuery({ name: "tab", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "store", required: false })
  @ApiQuery({ name: "service", required: false })
  @ApiQuery({ name: "currency", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "priceMin", required: false })
  @ApiQuery({ name: "priceMax", required: false })
  @ApiQuery({ name: "hasTrackingNumber", required: false })
  @ApiQuery({ name: "hasTrackingUrl", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("history")
  historyList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(DeliveryHistoryQuerySchema)) query: DeliveryHistoryQueryDto,
  ): Promise<Paginator<DeliveryListItemView>> {
    return this.deliveryService.historyList({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Expense statistics for the current user's deliveries",
    type: DeliveryStatisticsViewDto,
  })
  @ApiOperation({ summary: "Get expense statistics for the current user's deliveries" })
  @ApiQuery({ name: "currency", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "store", required: false })
  @ApiQuery({ name: "includeCancelled", required: false })
  @Get("statistics")
  statistics(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(DeliveryStatisticsQuerySchema)) query: DeliveryStatisticsQueryDto,
  ): Promise<DeliveryStatisticsView> {
    return this.deliveryService.statistics({ query, userId: user.id });
  }

  @ApiBody({ type: BulkReceiveDeliveriesInputDto })
  @ApiOkResponse({
    description: "The book ids whose active deliveries were received, plus safely skipped ids",
    type: BulkReceiveDeliveriesResultViewDto,
  })
  @ApiOperation({ summary: "Mark the active deliveries of many books as received in one batch" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("receive")
  @Throttle(MUTATION_THROTTLE)
  bulkReceive(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkReceiveDeliveriesInputSchema)) body: BulkReceiveDeliveriesInputDto,
  ): Promise<BulkReceiveDeliveriesResultView> {
    return this.deliveryService.bulkReceive({
      bookIds: body.bookIds,
      receivedAt: body.receivedAt,
      userId: user.id,
    });
  }
}
