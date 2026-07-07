import type { ReadingQueueView } from "@app/shared";

import { AddToReadingQueueInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
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
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { ReadingQueueService } from "../application/reading-queue.service.js";
import { AddToReadingQueueInputDto } from "./input-dto/add-to-reading-queue.input-dto.js";
import { ReadingQueueViewDto } from "./view-dto/reading-queue.view-dto.js";

const QUEUE_ACTION_TTL_SECONDS = 60;
const QUEUE_ACTION_LIMIT = 60;

@ApiTags("reading-queue")
@Controller("api/reading-queue")
export class ReadingQueueController {
  constructor(private readonly readingQueueService: ReadingQueueService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "The current user reading queue ordered by position",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Get the current user reading queue" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  getQueue(@CurrentUser() user: AuthenticatedUser): Promise<ReadingQueueView> {
    return this.readingQueueService.getQueue(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: AddToReadingQueueInputDto })
  @ApiConflictResponse({ description: "Book is already in the reading queue" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The updated reading queue after the book was inserted",
    type: ReadingQueueViewDto,
  })
  @ApiOperation({ summary: "Add an owned book to the reading queue with placement" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({ description: "Requested position exceeds the queue length" })
  @HttpCode(HTTP_STATUS.OK)
  @Post()
  @Throttle({ default: { limit: QUEUE_ACTION_LIMIT, ttl: seconds(QUEUE_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  addToQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(AddToReadingQueueInputSchema)) body: AddToReadingQueueInputDto,
  ): Promise<ReadingQueueView> {
    return this.readingQueueService.addToQueue(user.id, body);
  }
}
