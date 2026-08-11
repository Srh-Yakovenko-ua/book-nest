import type {
  ReadingQueueQuery,
  ReadingQueueSummaryView,
  ReadingQueueView,
  ReadingQueueVolumeSummaryView,
} from "@app/shared";

import {
  AddToReadingQueueInputSchema,
  ReadingQueueQuerySchema,
  ReorderReadingQueueInputSchema,
  StartReadingFromQueueInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ReadingQueueService } from "../application/reading-queue.service.js";
import { AddToReadingQueueInputDto } from "./input-dto/add-to-reading-queue.input-dto.js";
import { ReadingQueueQueryDto } from "./input-dto/reading-queue-query.input-dto.js";
import { ReorderReadingQueueInputDto } from "./input-dto/reorder-reading-queue.input-dto.js";
import { StartReadingFromQueueInputDto } from "./input-dto/start-reading-from-queue.input-dto.js";
import { ReadingQueueSummaryViewDto } from "./view-dto/reading-queue-summary.view-dto.js";
import { ReadingQueueVolumeSummaryViewDto } from "./view-dto/reading-queue-volume-summary.view-dto.js";
import { ReadingQueueViewDto } from "./view-dto/reading-queue.view-dto.js";

@ApiTags("reading-queue")
@Controller("api/reading-queue")
export class ReadingQueueController {
  constructor(private readonly readingQueueService: ReadingQueueService) {}
  @ApiOkResponse({
    description: "The current user reading queue ordered by position",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Get the current user reading queue" })
  @Get()
  @JwtProtected()
  getQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingQueueQuerySchema)) query: ReadingQueueQueryDto,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.getQueue(user.id, query as ReadingQueueQuery);
  }
  @ApiOkResponse({
    description: "Aggregated statistics for the current user reading queue",
    type: ReadingQueueSummaryViewDto,
  })
  @ApiOperation({ summary: "Get aggregated reading queue statistics" })
  @Get("summary")
  @JwtProtected()
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ReadingQueueSummaryView> {
    return this.readingQueueService.summary(user.id);
  }
  @ApiOkResponse({
    description: "Remaining reading volume, coverage, and pace estimate for the reading queue",
    type: ReadingQueueVolumeSummaryViewDto,
  })
  @ApiOperation({ summary: "Get the remaining reading volume of the reading queue" })
  @Get("volume-summary")
  @JwtProtected()
  volumeSummary(@CurrentUser() user: AuthenticatedUser): Promise<ReadingQueueVolumeSummaryView> {
    return this.readingQueueService.volumeSummary(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: AddToReadingQueueInputDto })
  @ApiConflictResponse({ description: "Book is already in the reading queue" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The updated reading queue after the book was inserted",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Add an owned book to the reading queue with placement" })
  @ApiUnprocessableEntityResponse({ description: "Requested position exceeds the queue length" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post()
  @Throttle(MUTATION_THROTTLE)
  addToQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(AddToReadingQueueInputSchema)) body: AddToReadingQueueInputDto,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.addToQueue(user.id, body);
  }
  @ApiBody({ type: ReorderReadingQueueInputDto })
  @ApiOkResponse({
    description: "The reading queue after positions were re-sequenced",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Reorder the current user reading queue" })
  @ApiUnprocessableEntityResponse({
    description: "The order is not an exact permutation of the queued books",
  })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Put("reorder")
  @Throttle(MUTATION_THROTTLE)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(ReorderReadingQueueInputSchema)) body: ReorderReadingQueueInputDto,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.reorder(user.id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: StartReadingFromQueueInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The reading queue after the book was marked as reading",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({
    summary: "Start reading a book and optionally remove it from the reading queue",
  })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":bookId/start-reading")
  @Throttle(MUTATION_THROTTLE)
  startReading(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(StartReadingFromQueueInputSchema)) body: StartReadingFromQueueInputDto,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.startReading(user.id, bookId, body.removeFromQueue);
  }
  @ApiNotFoundResponse({ description: "Book not found or not in the reading queue" })
  @ApiOkResponse({
    description: "The updated reading queue after the book was removed",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Remove a book from the reading queue and re-sequence positions" })
  @Delete(":bookId")
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  removeFromQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.removeFromQueue(user.id, bookId);
  }
}
