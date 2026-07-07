import type { ReadingQueueView } from "@app/shared";

import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { ReadingQueueService } from "../application/reading-queue.service.js";
import { ReadingQueueViewDto } from "./view-dto/reading-queue.view-dto.js";

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
}
