import type {
  Nullable,
  ReadingGoalActivityResponse,
  ReadingGoalBooksResponse,
  ReadingGoalDetail,
  ReadingGoalListResponse,
  ReadingGoalsOverview,
  ReadingGoalView,
} from "@app/shared";
import type { Response } from "express";

import {
  CreateReadingGoalInputSchema,
  ReadingGoalActivityQuerySchema,
  ReadingGoalBooksQuerySchema,
  ReadingGoalsQuerySchema,
  UpdateReadingGoalInputSchema,
} from "@app/shared";
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
  Query,
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
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ReadingGoalActivityService } from "../application/reading-goal-activity.service.js";
import { ReadingGoalBooksService } from "../application/reading-goal-books.service.js";
import { ReadingGoalCatalogService } from "../application/reading-goal-catalog.service.js";
import { ReadingGoalDetailAssembler } from "../application/reading-goal-detail.assembler.js";
import { ReadingGoalOverviewService } from "../application/reading-goal-overview.service.js";
import { ReadingGoalsService } from "../application/reading-goals.service.js";
import { CreateReadingGoalInputDto } from "./input-dto/create-reading-goal.input-dto.js";
import { ReadingGoalActivityQueryDto } from "./input-dto/reading-goal-activity.query.input-dto.js";
import { ReadingGoalBooksQueryDto } from "./input-dto/reading-goal-books.query.input-dto.js";
import { ReadingGoalsQueryDto } from "./input-dto/reading-goals.query.input-dto.js";
import { UpdateReadingGoalInputDto } from "./input-dto/update-reading-goal.input-dto.js";
import { ReadingGoalActivityResponseDto } from "./view-dto/reading-goal-activity.view-dto.js";
import { ReadingGoalBooksResponseDto } from "./view-dto/reading-goal-books.view-dto.js";
import { ReadingGoalDetailDto } from "./view-dto/reading-goal-detail.view-dto.js";
import { ReadingGoalListResponseDto } from "./view-dto/reading-goal-list.view-dto.js";
import { ReadingGoalViewDto } from "./view-dto/reading-goal.view-dto.js";
import { ReadingGoalsOverviewDto } from "./view-dto/reading-goals-overview.view-dto.js";

@ApiTags("reading-goals")
@Controller("api")
@JwtProtected()
export class ReadingGoalsController {
  constructor(
    private readonly readingGoalsService: ReadingGoalsService,
    private readonly detailAssembler: ReadingGoalDetailAssembler,
    private readonly catalogService: ReadingGoalCatalogService,
    private readonly overviewService: ReadingGoalOverviewService,
    private readonly goalBooksService: ReadingGoalBooksService,
    private readonly goalActivityService: ReadingGoalActivityService,
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

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiOkResponse({
    description: "A page of the reading goals of the current user with their metrics",
    type: ReadingGoalListResponseDto,
  })
  @ApiOperation({ summary: "List the reading goals of the current user" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "listId", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "status", required: false })
  @Get("goals")
  @Throttle(READ_THROTTLE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingGoalsQuerySchema)) query: ReadingGoalsQueryDto,
  ): Promise<ReadingGoalListResponse> {
    return this.catalogService.list({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Aggregated reading-goal statistics of the current user",
    type: ReadingGoalsOverviewDto,
  })
  @ApiOperation({ summary: "Get the reading-goal overview of the current user" })
  @Get("goals/overview")
  @Throttle(READ_THROTTLE)
  overview(@CurrentUser() user: AuthenticatedUser): Promise<ReadingGoalsOverview> {
    return this.overviewService.overview({ userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({
    description: "The reading goal with its snapshot books, checkpoints and activity preview",
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

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({
    description: "A page of the books the goal counts over its snapshot",
    type: ReadingGoalBooksResponseDto,
  })
  @ApiOperation({ summary: "List the books of a reading goal snapshot" })
  @ApiParam({ name: "goalId", required: true })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "scope", required: false })
  @Get("goals/:goalId/books")
  @Throttle(READ_THROTTLE)
  listBooks(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Query(new ZodQueryPipe(ReadingGoalBooksQuerySchema)) query: ReadingGoalBooksQueryDto,
  ): Promise<ReadingGoalBooksResponse> {
    return this.goalBooksService.list({ goalId, query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiNotFoundResponse({ description: "Reading goal not found" })
  @ApiOkResponse({
    description: "A page of the reading goal activity, newest first",
    type: ReadingGoalActivityResponseDto,
  })
  @ApiOperation({ summary: "List the activity of a reading goal" })
  @ApiParam({ name: "goalId", required: true })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "type", required: false })
  @Get("goals/:goalId/activity")
  @Throttle(READ_THROTTLE)
  listActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @Query(new ZodQueryPipe(ReadingGoalActivityQuerySchema)) query: ReadingGoalActivityQueryDto,
  ): Promise<ReadingGoalActivityResponse> {
    return this.goalActivityService.list({ goalId, query, userId: user.id });
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
