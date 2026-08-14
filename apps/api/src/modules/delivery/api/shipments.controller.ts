import type { BookOrderView } from "@app/shared";

import {
  CancelShipmentInputSchema,
  CreateShipmentInputSchema,
  MarkShipmentInTransitInputSchema,
  MarkShipmentReadyForPickupInputSchema,
  MoveBookOrderItemsInputSchema,
  ReceiveShipmentInputSchema,
  UpdateShipmentInputSchema,
} from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ShipmentService } from "../application/shipment.service.js";
import { CancelShipmentInputDto } from "./input-dto/cancel-shipment.input-dto.js";
import { CreateShipmentInputDto } from "./input-dto/create-shipment.input-dto.js";
import { MarkShipmentInTransitInputDto } from "./input-dto/mark-shipment-in-transit.input-dto.js";
import { MarkShipmentReadyForPickupInputDto } from "./input-dto/mark-shipment-ready-for-pickup.input-dto.js";
import { MoveBookOrderItemsInputDto } from "./input-dto/move-book-order-items.input-dto.js";
import { ReceiveShipmentInputDto } from "./input-dto/receive-shipment.input-dto.js";
import { UpdateShipmentInputDto } from "./input-dto/update-shipment.input-dto.js";
import { BookOrderViewDto } from "./view-dto/book-order.view-dto.js";

@ApiTags("shipments")
@Controller("api/delivery")
@JwtProtected()
export class ShipmentsController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @ApiBadRequestResponse({
    description: "Validation failed, or an item does not belong to a book of this order",
  })
  @ApiBody({ type: CreateShipmentInputDto })
  @ApiCreatedResponse({ description: "The order with the new shipment", type: BookOrderViewDto })
  @ApiNotFoundResponse({ description: "Order not found" })
  @ApiOperation({ summary: "Create a shipment inside an existing order and load items into it" })
  @ApiParam({ description: "Order id", format: "uuid", name: "orderId", type: String })
  @Post("orders/:orderId/shipments")
  @Throttle(MUTATION_THROTTLE)
  createShipment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body(new ZodBodyPipe(CreateShipmentInputSchema)) body: CreateShipmentInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.create({ input: body, orderId, userId: user.id });
  }

  @ApiBadRequestResponse({
    description: "Validation failed, or an item is not an active item of this order",
  })
  @ApiBody({ type: MoveBookOrderItemsInputDto })
  @ApiConflictResponse({ description: "The target shipment is no longer active" })
  @ApiNotFoundResponse({ description: "Order not found" })
  @ApiOkResponse({ description: "The order with the moved items", type: BookOrderViewDto })
  @ApiOperation({ summary: "Move order items into another shipment of the order, or out of any" })
  @ApiParam({ description: "Order id", format: "uuid", name: "orderId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("orders/:orderId/items/move")
  @Throttle(MUTATION_THROTTLE)
  moveItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body(new ZodBodyPipe(MoveBookOrderItemsInputSchema)) body: MoveBookOrderItemsInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.moveItems({ input: body, orderId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateShipmentInputDto })
  @ApiConflictResponse({ description: "The shipment is no longer active" })
  @ApiNotFoundResponse({ description: "Shipment not found" })
  @ApiOkResponse({ description: "The order with the updated shipment", type: BookOrderViewDto })
  @ApiOperation({ summary: "Edit an active shipment without changing its terminal state" })
  @ApiParam({ description: "Shipment id", format: "uuid", name: "shipmentId", type: String })
  @Patch("shipments/:shipmentId")
  @Throttle(MUTATION_THROTTLE)
  updateShipment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body(new ZodBodyPipe(UpdateShipmentInputSchema)) body: UpdateShipmentInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.update({ input: body, shipmentId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ required: false, type: MarkShipmentInTransitInputDto })
  @ApiConflictResponse({ description: "The shipment is no longer active" })
  @ApiNotFoundResponse({ description: "Shipment not found" })
  @ApiOkResponse({ description: "The order with the shipment in transit", type: BookOrderViewDto })
  @ApiOperation({ summary: "Mark an active shipment as in transit" })
  @ApiParam({ description: "Shipment id", format: "uuid", name: "shipmentId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("shipments/:shipmentId/in-transit")
  @Throttle(MUTATION_THROTTLE)
  markInTransit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body(new ZodBodyPipe(MarkShipmentInTransitInputSchema.prefault({})))
    body: MarkShipmentInTransitInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.markInTransit({ input: body, shipmentId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ required: false, type: MarkShipmentReadyForPickupInputDto })
  @ApiConflictResponse({ description: "The shipment is no longer active" })
  @ApiNotFoundResponse({ description: "Shipment not found" })
  @ApiOkResponse({
    description: "The order with the shipment waiting for pickup",
    type: BookOrderViewDto,
  })
  @ApiOperation({ summary: "Mark an active shipment as ready for pickup" })
  @ApiParam({ description: "Shipment id", format: "uuid", name: "shipmentId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("shipments/:shipmentId/ready-for-pickup")
  @Throttle(MUTATION_THROTTLE)
  markReadyForPickup(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body(new ZodBodyPipe(MarkShipmentReadyForPickupInputSchema.prefault({})))
    body: MarkShipmentReadyForPickupInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.markReadyForPickup({ input: body, shipmentId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ required: false, type: ReceiveShipmentInputDto })
  @ApiConflictResponse({ description: "The shipment was already received or cancelled" })
  @ApiNotFoundResponse({ description: "Shipment not found" })
  @ApiOkResponse({
    description: "The order with the received shipment, its books now owned",
    type: BookOrderViewDto,
  })
  @ApiOperation({ summary: "Mark a shipment as received, marking its books as owned" })
  @ApiParam({ description: "Shipment id", format: "uuid", name: "shipmentId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("shipments/:shipmentId/receive")
  @Throttle(MUTATION_THROTTLE)
  markReceived(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body(new ZodBodyPipe(ReceiveShipmentInputSchema.prefault({}))) body: ReceiveShipmentInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.markReceived({ input: body, shipmentId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ required: false, type: CancelShipmentInputDto })
  @ApiConflictResponse({ description: "The shipment was already received or cancelled" })
  @ApiNotFoundResponse({ description: "Shipment not found" })
  @ApiOkResponse({
    description: "The order with the cancelled shipment and its cancelled items",
    type: BookOrderViewDto,
  })
  @ApiOperation({ summary: "Cancel a shipment together with every active item it carries" })
  @ApiParam({ description: "Shipment id", format: "uuid", name: "shipmentId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("shipments/:shipmentId/cancel")
  @Throttle(MUTATION_THROTTLE)
  cancelShipment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shipmentId", ParseUUIDPipe) shipmentId: string,
    @Body(new ZodBodyPipe(CancelShipmentInputSchema.prefault({}))) body: CancelShipmentInputDto,
  ): Promise<BookOrderView> {
    return this.shipmentService.cancel({ input: body, shipmentId, userId: user.id });
  }
}
