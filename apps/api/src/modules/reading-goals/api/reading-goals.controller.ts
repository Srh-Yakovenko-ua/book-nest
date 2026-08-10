import type { Nullable, ReadingGoalDetail, ReadingGoalView } from "@app/shared";
import type { Response } from "express";

import { CreateReadingGoalInputSchema, UpdateReadingGoalInputSchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ReadingGoalDetailAssembler } from "../application/reading-goal-detail.assembler.js";
import { ReadingGoalsService } from "../application/reading-goals.service.js";
import { CreateReadingGoalInputDto } from "./input-dto/create-reading-goal.input-dto.js";
import { UpdateReadingGoalInputDto } from "./input-dto/update-reading-goal.input-dto.js";
import { ReadingGoalDetailDto } from "./view-dto/reading-goal-detail.view-dto.js";
import { ReadingGoalViewDto } from "./view-dto/reading-goal.view-dto.js";

@ApiTags("reading-goals")
@Controller("api")
@JwtProtected()
export class ReadingGoalsController {
  constructor(
    private readonly readingGoalsService: ReadingGoalsService,
    private readonly detailAssembler: ReadingGoalDetailAssembler,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateReadingGoalInputDto })
  @ApiConflictResponse({ description: "This list already has an open reading goal" })
  @ApiCreatedResponse({ description: "The created reading goal", type: ReadingGoalViewDto })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOperation({ summary: "Create a reading goal over a custom list" })
  @ApiParam({ name: "listId", required: true })
  @Post("lists/:listId/goal")
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Body(new ZodBodyPipe(CreateReadingGoalInputSchema)) body: CreateReadingGoalInputDto,
  ): Promise<ReadingGoalView> {
    return this.readingGoalsService.create({ input: body, listId, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The list has no open reading goal" })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "The open reading goal of the list", type: ReadingGoalViewDto })
  @ApiOperation({ summary: "Get the open reading goal of a custom list" })
  @ApiParam({ name: "listId", required: true })
  @Get("lists/:listId/goal")
  @Throttle(READ_THROTTLE)
  async findByList(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Nullable<ReadingGoalView>> {
    const goal = await this.detailAssembler.findActiveByList({ listId, userId: user.id });
    if (goal === null) {
      response.status(HTTP_STATUS.NO_CONTENT);
    }
    return goal;
  }

  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({
    description: "The reading goal with the books counted towards it",
    type: ReadingGoalDetailDto,
  })
  @ApiOperation({ summary: "Get a reading goal of the current user" })
  @ApiParam({ name: "goalId", required: true })
  @Get("goals/:goalId")
  @Throttle(READ_THROTTLE)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
  ): Promise<ReadingGoalDetail> {
    return this.detailAssembler.findDetail({ goalId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateReadingGoalInputDto })
  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({ description: "The updated reading goal", type: ReadingGoalViewDto })
  @ApiOperation({ summary: "Update a reading goal of the current user" })
  @ApiParam({ name: "goalId", required: true })
  @Patch("goals/:goalId")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Body(new ZodBodyPipe(UpdateReadingGoalInputSchema)) body: UpdateReadingGoalInputDto,
  ): Promise<ReadingGoalView> {
    return this.readingGoalsService.update({ goalId, input: body, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({ description: "The archived reading goal", type: ReadingGoalViewDto })
  @ApiOperation({ summary: "Archive a reading goal so its list can take a new one" })
  @ApiParam({ name: "goalId", required: true })
  @HttpCode(HTTP_STATUS.OK)
  @Post("goals/:goalId/archive")
  @Throttle(MUTATION_THROTTLE)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
  ): Promise<ReadingGoalView> {
    return this.readingGoalsService.archive({ goalId, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The reading goal was deleted" })
  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOperation({ summary: "Delete a reading goal of the current user" })
  @ApiParam({ name: "goalId", required: true })
  @Delete("goals/:goalId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
  ): Promise<void> {
    return this.readingGoalsService.delete({ goalId, userId: user.id });
  }
}
