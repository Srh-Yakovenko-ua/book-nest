import type { BulkActionResult } from "@app/shared";

import {
  BulkBookIdsSchema,
  BulkFavoriteInputSchema,
  BulkListsInputSchema,
  BulkOwnershipStatusInputSchema,
  BulkReadingStatusInputSchema,
  BulkTagsInputSchema,
} from "@app/shared";
import { Body, Controller, HttpCode, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { BulkBooksService } from "../application/bulk-books.service.js";
import { BulkBookIdsDto } from "./input-dto/bulk-book-ids.input-dto.js";
import { BulkFavoriteInputDto } from "./input-dto/bulk-favorite.input-dto.js";
import { BulkListsInputDto } from "./input-dto/bulk-lists.input-dto.js";
import { BulkOwnershipStatusInputDto } from "./input-dto/bulk-ownership-status.input-dto.js";
import { BulkReadingStatusInputDto } from "./input-dto/bulk-reading-status.input-dto.js";
import { BulkTagsInputDto } from "./input-dto/bulk-tags.input-dto.js";
import { BulkActionResultDto } from "./view-dto/bulk-action-result.view-dto.js";

const BULK_ACTION_TTL_SECONDS = 60;
const BULK_ACTION_LIMIT = 30;

@ApiBearerAuth()
@ApiTags("books")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/books/bulk")
@Throttle({ default: { limit: BULK_ACTION_LIMIT, ttl: seconds(BULK_ACTION_TTL_SECONDS) } })
@UseGuards(JwtAccessGuard)
export class BulkBooksController {
  constructor(private readonly bulkBooksService: BulkBooksService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkFavoriteInputDto })
  @ApiOkResponse({ description: "Number of affected books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Set the favorite flag on the selected books" })
  @Patch("favorite")
  favorite(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkFavoriteInputSchema)) body: BulkFavoriteInputDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.setFavorite({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkReadingStatusInputDto })
  @ApiOkResponse({ description: "Number of affected books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Change the reading status of the selected books" })
  @Patch("reading-status")
  readingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkReadingStatusInputSchema)) body: BulkReadingStatusInputDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.setReadingStatus({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkOwnershipStatusInputDto })
  @ApiOkResponse({ description: "Number of affected books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Change the ownership status of the selected books" })
  @Patch("ownership-status")
  ownershipStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkOwnershipStatusInputSchema)) body: BulkOwnershipStatusInputDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.setOwnershipStatus({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkTagsInputDto })
  @ApiOkResponse({ description: "Number of affected books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Add tags to the selected books" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("tags")
  tags(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkTagsInputSchema)) body: BulkTagsInputDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.addTags({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkListsInputDto })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "Number of affected books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Add the selected books to custom lists" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("lists")
  lists(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkListsInputSchema)) body: BulkListsInputDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.addToLists({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkBookIdsDto })
  @ApiOkResponse({ description: "Number of newly queued books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Add the selected books to the reading queue" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("reading-queue")
  readingQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkBookIdsSchema)) body: BulkBookIdsDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.addToReadingQueue({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: BulkBookIdsDto })
  @ApiOkResponse({ description: "Number of deleted books", type: BulkActionResultDto })
  @ApiOperation({ summary: "Delete the selected books" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("delete")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(BulkBookIdsSchema)) body: BulkBookIdsDto,
  ): Promise<BulkActionResult> {
    return this.bulkBooksService.delete({ input: body, userId: user.id });
  }
}
