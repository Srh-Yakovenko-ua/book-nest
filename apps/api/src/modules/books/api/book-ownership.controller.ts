import type { BookView } from "@app/shared";

import { MarkBoughtInputSchema, WantToBuyInputSchema } from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
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
import { BookOwnershipService } from "../application/book-ownership.service.js";
import { MarkBoughtInputDto } from "./input-dto/mark-bought.input-dto.js";
import { WantToBuyInputDto } from "./input-dto/want-to-buy.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";

const OWNERSHIP_ACTION_TTL_SECONDS = 60;
const OWNERSHIP_ACTION_LIMIT = 60;

@ApiTags("books")
@Controller("api/books")
export class BookOwnershipController {
  constructor(private readonly bookOwnershipService: BookOwnershipService) {}

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book marked as owned", type: BookViewDto })
  @ApiOperation({ summary: "Mark a book as owned" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/ownership/mark-owned")
  @Throttle({
    default: { limit: OWNERSHIP_ACTION_LIMIT, ttl: seconds(OWNERSHIP_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  markOwned(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.bookOwnershipService.markOwned(user.id, id);
  }

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with ownership removed", type: BookViewDto })
  @ApiOperation({ summary: "Remove ownership from a book" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/ownership/remove-owned")
  @Throttle({
    default: { limit: OWNERSHIP_ACTION_LIMIT, ttl: seconds(OWNERSHIP_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  removeOwned(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.bookOwnershipService.removeOwned(user.id, id);
  }

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "Book is not in the wishlist" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book removed from the wishlist", type: BookViewDto })
  @ApiOperation({ summary: "Remove a book from the wishlist" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/ownership/remove-from-wishlist")
  @Throttle({
    default: { limit: OWNERSHIP_ACTION_LIMIT, ttl: seconds(OWNERSHIP_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  removeFromWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.bookOwnershipService.removeFromWishlist({ bookId: id, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: WantToBuyInputDto })
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book marked as want to buy", type: BookViewDto })
  @ApiOperation({ summary: "Mark a book as want to buy with optional purchase details" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/ownership/want-to-buy")
  @Throttle({
    default: { limit: OWNERSHIP_ACTION_LIMIT, ttl: seconds(OWNERSHIP_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  wantToBuy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(WantToBuyInputSchema)) body: WantToBuyInputDto,
  ): Promise<BookView> {
    return this.bookOwnershipService.wantToBuy(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: MarkBoughtInputDto })
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book marked as bought", type: BookViewDto })
  @ApiOperation({ summary: "Mark a want-to-buy book as bought with actual purchase details" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/ownership/mark-bought")
  @Throttle({
    default: { limit: OWNERSHIP_ACTION_LIMIT, ttl: seconds(OWNERSHIP_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  markBought(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(MarkBoughtInputSchema)) body: MarkBoughtInputDto,
  ): Promise<BookView> {
    return this.bookOwnershipService.markBought(user.id, id, body);
  }
}
