import type { ActiveMoneyAgeResponse, BookOrderStatisticsView, BookOrderView } from "@app/shared";

import {
  ActiveMoneyAgeQuerySchema,
  BookOrderStatisticsQuerySchema,
  CreateBookOrderInputSchema,
  UpdateBookOrderInputSchema,
} from "@app/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookOrderService } from "../application/book-order.service.js";
import { DeliveryStatisticsService } from "../application/delivery-statistics.service.js";
import { ActiveMoneyAgeQueryDto } from "./input-dto/active-money-age-query.input-dto.js";
import { BookOrderStatisticsQueryDto } from "./input-dto/book-order-statistics-query.input-dto.js";
import { CreateBookOrderInputDto } from "./input-dto/create-book-order.input-dto.js";
import { UpdateBookOrderInputDto } from "./input-dto/update-book-order.input-dto.js";
import { ActiveMoneyAgeViewDto } from "./view-dto/active-money-age.view-dto.js";
import { BookOrderStatisticsViewDto } from "./view-dto/book-order-statistics.view-dto.js";
import { BookOrderViewDto } from "./view-dto/book-order.view-dto.js";

@ApiTags("book-orders")
@Controller("api/delivery/orders")
@JwtProtected()
export class BookOrdersController {
  constructor(
    private readonly bookOrderService: BookOrderService,
    private readonly deliveryStatisticsService: DeliveryStatisticsService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateBookOrderInputDto })
  @ApiConflictResponse({ description: "One of the books is already on its way or already owned" })
  @ApiCreatedResponse({
    description: "The created order with its items and shipments",
    type: BookOrderViewDto,
  })
  @ApiNotFoundResponse({ description: "One of the ordered books was not found" })
  @ApiOperation({ summary: "Create a book order with its items and shipments" })
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateBookOrderInputSchema)) body: CreateBookOrderInputDto,
  ): Promise<BookOrderView> {
    return this.bookOrderService.create({ input: body, userId: user.id });
  }

  @ApiOkResponse({
    description: "Age of money committed to the current user's still-active book orders",
    type: ActiveMoneyAgeViewDto,
  })
  @ApiOperation({
    summary: "Get a current snapshot of how long money has sat in active book orders",
  })
  @ApiQuery({ name: "currency", required: false })
  @ApiQuery({ name: "store", required: false })
  @Get("statistics/active-age")
  @Throttle(HEAVY_READ_THROTTLE)
  activeMoneyAge(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ActiveMoneyAgeQuerySchema)) query: ActiveMoneyAgeQueryDto,
  ): Promise<ActiveMoneyAgeResponse> {
    return this.deliveryStatisticsService.activeMoneyAge({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Expense statistics for the current user's book orders",
    type: BookOrderStatisticsViewDto,
  })
  @ApiOperation({ summary: "Get expense statistics for the current user's book orders" })
  @ApiQuery({ name: "currency", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "store", required: false })
  @ApiQuery({ name: "includeCancelled", required: false })
  @ApiQuery({ name: "compare", required: false })
  @Get("statistics")
  @Throttle(HEAVY_READ_THROTTLE)
  statistics(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(BookOrderStatisticsQuerySchema)) query: BookOrderStatisticsQueryDto,
  ): Promise<BookOrderStatisticsView> {
    return this.deliveryStatisticsService.statistics({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Order not found" })
  @ApiOkResponse({
    description: "The order with its items and shipments",
    type: BookOrderViewDto,
  })
  @ApiOperation({ summary: "Get one book order with its items and shipments" })
  @ApiParam({ description: "Order id", format: "uuid", name: "orderId", type: String })
  @Get(":orderId")
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ): Promise<BookOrderView> {
    return this.bookOrderService.findById({ orderId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateBookOrderInputDto })
  @ApiNotFoundResponse({ description: "Order not found" })
  @ApiOkResponse({ description: "The updated order", type: BookOrderViewDto })
  @ApiOperation({ summary: "Edit the order-level fields of a book order" })
  @ApiParam({ description: "Order id", format: "uuid", name: "orderId", type: String })
  @Patch(":orderId")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body(new ZodBodyPipe(UpdateBookOrderInputSchema)) body: UpdateBookOrderInputDto,
  ): Promise<BookOrderView> {
    return this.bookOrderService.update({ input: body, orderId, userId: user.id });
  }
}
