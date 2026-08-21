import type { BookOrderView, BulkReceiveOrderItemsResultView } from "@app/shared";

import { BulkReceiveOrderItemsInputSchema, CancelBookOrderItemInputSchema } from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
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
import { BookOrderItemService } from "../application/book-order-item.service.js";
import { BulkReceiveOrderItemsInputDto } from "./input-dto/bulk-receive-order-items.input-dto.js";
import { CancelBookOrderItemInputDto } from "./input-dto/cancel-book-order-item.input-dto.js";
import { BookOrderViewDto } from "./view-dto/book-order.view-dto.js";
import { BulkReceiveOrderItemsResultViewDto } from "./view-dto/bulk-receive-order-items-result.view-dto.js";

@ApiTags("order-items")
@Controller("api/delivery")
@JwtProtected()
export class BookOrderItemsController {
  constructor(private readonly bookOrderItemService: BookOrderItemService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ required: false, type: CancelBookOrderItemInputDto })
  @ApiConflictResponse({ description: "The book was already cancelled or already arrived" })
  @ApiNotFoundResponse({ description: "Order item not found" })
  @ApiOkResponse({
    description: "The order with the cancelled item, its other items untouched",
    type: BookOrderViewDto,
  })
  @ApiOperation({ summary: "Cancel one book of an order without touching its shipment" })
  @ApiParam({ description: "Order item id", format: "uuid", name: "itemId", type: String })
  @HttpCode(HTTP_STATUS.OK)
  @Post("items/:itemId/cancel")
  @Throttle(MUTATION_THROTTLE)
  cancelItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body(new ZodBodyPipe(CancelBookOrderItemInputSchema.prefault({})))
    body: CancelBookOrderItemInputDto,
  ): Promise<BookOrderView> {
    return this.bookOrderItemService.cancel({ input: body, itemId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkReceiveOrderItemsInputDto })
  @ApiOkResponse({
    description: "The book ids whose active order items were received, plus safely skipped ids",
    type: BulkReceiveOrderItemsResultViewDto,
  })
  @ApiOperation({ summary: "Mark the active order items of many books as received in one batch" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("books/receive")
  @Throttle(MUTATION_THROTTLE)
  bulkReceive(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkReceiveOrderItemsInputSchema)) body: BulkReceiveOrderItemsInputDto,
  ): Promise<BulkReceiveOrderItemsResultView> {
    return this.bookOrderItemService.bulkReceive({ input: body, userId: user.id });
  }
}
