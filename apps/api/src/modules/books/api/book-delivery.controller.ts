import type { BookView, DeliveryView } from "@app/shared";

import {
  CancelDeliveryInputSchema,
  CreateDeliveryInputSchema,
  ReceiveDeliveryInputSchema,
  UpdateDeliveryInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { BookDeliveryService } from "../application/book-delivery.service.js";
import { CancelDeliveryInputDto } from "./input-dto/cancel-delivery.input-dto.js";
import { CreateDeliveryInputDto } from "./input-dto/create-delivery.input-dto.js";
import { ReceiveDeliveryInputDto } from "./input-dto/receive-delivery.input-dto.js";
import { UpdateDeliveryInputDto } from "./input-dto/update-delivery.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";
import { DeliveryViewDto } from "./view-dto/delivery.view-dto.js";

const DELIVERY_ACTION_TTL_SECONDS = 60;
const DELIVERY_ACTION_LIMIT = 60;

@ApiTags("books")
@Controller("api/books")
export class BookDeliveryController {
  constructor(private readonly bookDeliveryService: BookDeliveryService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateDeliveryInputDto })
  @ApiConflictResponse({
    description: "The book already has an active delivery or cannot start one",
  })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the newly started delivery", type: BookViewDto })
  @ApiOperation({ summary: "Start a delivery for a book, marking it as in transit" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/deliveries")
  @Throttle({
    default: { limit: DELIVERY_ACTION_LIMIT, ttl: seconds(DELIVERY_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateDeliveryInputSchema)) body: CreateDeliveryInputDto,
  ): Promise<BookView> {
    return this.bookDeliveryService.create(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The delivery history of the book, newest first",
    type: [DeliveryViewDto],
  })
  @ApiOperation({ summary: "List the delivery history of a book" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":id/deliveries")
  @UseGuards(JwtAccessGuard)
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<DeliveryView[]> {
    return this.bookDeliveryService.listHistory(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateDeliveryInputDto })
  @ApiConflictResponse({ description: "The delivery is no longer active" })
  @ApiNotFoundResponse({ description: "Book or delivery not found" })
  @ApiOkResponse({ description: "The book with the updated delivery", type: BookViewDto })
  @ApiOperation({ summary: "Edit an active delivery of a book" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch(":id/deliveries/:deliveryId")
  @Throttle({
    default: { limit: DELIVERY_ACTION_LIMIT, ttl: seconds(DELIVERY_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("deliveryId", ParseUUIDPipe) deliveryId: string,
    @Body(new ZodBodyPipe(UpdateDeliveryInputSchema)) body: UpdateDeliveryInputDto,
  ): Promise<BookView> {
    return this.bookDeliveryService.update(user.id, id, deliveryId, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: ReceiveDeliveryInputDto })
  @ApiConflictResponse({ description: "The delivery is no longer active" })
  @ApiNotFoundResponse({ description: "Book or delivery not found" })
  @ApiOkResponse({
    description: "The book with the received delivery, now owned",
    type: BookViewDto,
  })
  @ApiOperation({ summary: "Mark an active delivery as received, marking the book as owned" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/deliveries/:deliveryId/receive")
  @Throttle({
    default: { limit: DELIVERY_ACTION_LIMIT, ttl: seconds(DELIVERY_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("deliveryId", ParseUUIDPipe) deliveryId: string,
    @Body(new ZodBodyPipe(ReceiveDeliveryInputSchema)) body: ReceiveDeliveryInputDto,
  ): Promise<BookView> {
    return this.bookDeliveryService.receive(user.id, id, deliveryId, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CancelDeliveryInputDto })
  @ApiConflictResponse({ description: "The delivery is no longer active" })
  @ApiNotFoundResponse({ description: "Book or delivery not found" })
  @ApiOkResponse({ description: "The book with the cancelled delivery", type: BookViewDto })
  @ApiOperation({ summary: "Cancel an active delivery of a book" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/deliveries/:deliveryId/cancel")
  @Throttle({
    default: { limit: DELIVERY_ACTION_LIMIT, ttl: seconds(DELIVERY_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("deliveryId", ParseUUIDPipe) deliveryId: string,
    @Body(new ZodBodyPipe(CancelDeliveryInputSchema)) body: CancelDeliveryInputDto,
  ): Promise<BookView> {
    return this.bookDeliveryService.cancel(user.id, id, deliveryId, body);
  }
}
