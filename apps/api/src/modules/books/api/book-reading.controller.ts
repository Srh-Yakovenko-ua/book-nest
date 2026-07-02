import type { BookView } from "@app/shared";

import { ChangeReadingStatusInputSchema, UpdateReadingProgressInputSchema } from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { UserModel } from "../../../generated/prisma/models.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { BookReadingService } from "../application/book-reading.service.js";
import { ChangeReadingStatusInputDto } from "./input-dto/change-reading-status.input-dto.js";
import { UpdateReadingProgressInputDto } from "./input-dto/update-reading-progress.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";

const READING_ACTION_TTL_SECONDS = 60;
const READING_ACTION_LIMIT = 60;

@ApiTags("books")
@Controller("api/books")
export class BookReadingController {
  constructor(private readonly bookReadingService: BookReadingService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: ChangeReadingStatusInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the applied reading status", type: BookViewDto })
  @ApiOperation({
    summary: "Change the reading status of a book with server-enforced side effects",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({ description: "Current page exceeds the page count" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/reading-status")
  @Throttle({ default: { limit: READING_ACTION_LIMIT, ttl: seconds(READING_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  changeReadingStatus(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(ChangeReadingStatusInputSchema)) body: ChangeReadingStatusInputDto,
  ): Promise<BookView> {
    return this.bookReadingService.changeReadingStatus(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateReadingProgressInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the updated reading progress", type: BookViewDto })
  @ApiOperation({ summary: "Update the reading progress of a book with auto status transitions" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({
    description: "Current page exceeds the page count or is lower than the saved progress",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/reading-progress")
  @Throttle({ default: { limit: READING_ACTION_LIMIT, ttl: seconds(READING_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  updateReadingProgress(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateReadingProgressInputSchema)) body: UpdateReadingProgressInputDto,
  ): Promise<BookView> {
    return this.bookReadingService.updateReadingProgress(user.id, id, body);
  }
}
