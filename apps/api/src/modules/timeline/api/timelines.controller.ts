import type {
  PaginatedTrashedTimelines,
  TimelineDeletionResult,
  TimelineListView,
  TimelineSummaryView,
  TimelineView,
} from "@app/shared";

import {
  CreateTimelineInputSchema,
  DeleteTimelineQuerySchema,
  ReorderTimelinesInputSchema,
  SetDefaultTimelineInputSchema,
  TrashedTimelinesQuerySchema,
  UpdateTimelineInputSchema,
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
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { TimelineLifecycleService } from "../application/timeline-lifecycle.service.js";
import { TimelineService } from "../application/timeline.service.js";
import { CreateTimelineInputDto } from "./input-dto/create-timeline.input-dto.js";
import { DeleteTimelineQueryDto } from "./input-dto/delete-timeline-query.input-dto.js";
import { ReorderTimelinesInputDto } from "./input-dto/reorder-timelines.input-dto.js";
import { SetDefaultTimelineInputDto } from "./input-dto/set-default-timeline.input-dto.js";
import { TrashedTimelinesQueryDto } from "./input-dto/trashed-timelines-query.input-dto.js";
import { UpdateTimelineInputDto } from "./input-dto/update-timeline.input-dto.js";
import { PaginatedTrashedTimelinesDto } from "./view-dto/paginated-trashed-timelines.view-dto.js";
import { TimelineDeletionResultDto } from "./view-dto/timeline-deletion-result.view-dto.js";
import { TimelineListViewDto } from "./view-dto/timeline-list.view-dto.js";
import { TimelineSummaryViewDto } from "./view-dto/timeline-summary.view-dto.js";
import { TimelineViewDto } from "./view-dto/timeline.view-dto.js";

@ApiTags("timelines")
@Controller()
@JwtProtected()
export class TimelinesController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly lifecycleService: TimelineLifecycleService,
  ) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The book's timelines ordered by position, including the default line",
    type: TimelineListViewDto,
  })
  @ApiOperation({ summary: "List the timelines of a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Get("api/books/:bookId/timelines")
  listTimelines(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<TimelineListView> {
    return this.timelineService.listTimelines(user.id, bookId);
  }

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "Total event count and per-timeline event counts for the book",
    type: TimelineSummaryViewDto,
  })
  @ApiOperation({ summary: "Get timeline event counts for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Get("api/books/:bookId/timeline/summary")
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<TimelineSummaryView> {
    return this.timelineService.summary(user.id, bookId);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateTimelineInputDto })
  @ApiConflictResponse({ description: "A timeline with this name already exists for this book" })
  @ApiCreatedResponse({ description: "The created timeline", type: TimelineViewDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Create a timeline for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Post("api/books/:bookId/timelines")
  @Throttle(MUTATION_THROTTLE)
  createTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(CreateTimelineInputSchema)) body: CreateTimelineInputDto,
  ): Promise<TimelineView> {
    return this.timelineService.createTimeline(user.id, bookId, body);
  }

  @ApiBody({ type: ReorderTimelinesInputDto })
  @ApiConflictResponse({ description: "The timeline order changed, reload and retry" })
  @ApiNotFoundResponse({ description: "Book or timeline not found" })
  @ApiOkResponse({ description: "The reordered timelines", type: TimelineListViewDto })
  @ApiOperation({ summary: "Reorder a timeline within a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiUnprocessableEntityResponse({ description: "The neighbor timeline is invalid" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("api/books/:bookId/timelines/reorder")
  @Throttle(MUTATION_THROTTLE)
  reorderTimelines(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(ReorderTimelinesInputSchema)) body: ReorderTimelinesInputDto,
  ): Promise<TimelineListView> {
    return this.timelineService.reorderTimelines(user.id, bookId, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateTimelineInputDto })
  @ApiConflictResponse({ description: "A timeline with this name already exists for this book" })
  @ApiNotFoundResponse({ description: "Timeline not found" })
  @ApiOkResponse({ description: "The updated timeline", type: TimelineViewDto })
  @ApiOperation({ summary: "Update a timeline's name, description or color" })
  @ApiParam({ description: "Timeline id", name: "timelineId" })
  @Patch("api/timelines/:timelineId")
  @Throttle(MUTATION_THROTTLE)
  updateTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("timelineId", ParseUUIDPipe) timelineId: string,
    @Body(new ZodBodyPipe(UpdateTimelineInputSchema)) body: UpdateTimelineInputDto,
  ): Promise<TimelineView> {
    return this.timelineService.updateTimeline(user.id, timelineId, body);
  }

  @ApiBody({ required: false, type: SetDefaultTimelineInputDto })
  @ApiConflictResponse({ description: "The timeline changed, reload and retry" })
  @ApiNotFoundResponse({ description: "Timeline not found" })
  @ApiOkResponse({
    description: "The timelines after the default was reassigned",
    type: TimelineListViewDto,
  })
  @ApiOperation({ summary: "Mark a timeline as the default line for its book" })
  @ApiParam({ description: "Timeline id", name: "timelineId" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("api/timelines/:timelineId/set-default")
  @Throttle(MUTATION_THROTTLE)
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param("timelineId", ParseUUIDPipe) timelineId: string,
    @Body(new ZodBodyPipe(SetDefaultTimelineInputSchema)) body: SetDefaultTimelineInputDto,
  ): Promise<TimelineListView> {
    return this.timelineService.setDefault(user.id, timelineId, body);
  }

  @ApiConflictResponse({ description: "The default timeline cannot be deleted" })
  @ApiNotFoundResponse({ description: "Timeline not found" })
  @ApiOkResponse({
    description: "The timeline was moved to the trash and scheduled for purge",
    type: TimelineDeletionResultDto,
  })
  @ApiOperation({
    summary: "Move a timeline to the trash, optionally moving its events elsewhere first",
  })
  @ApiParam({ description: "Timeline id", name: "timelineId" })
  @ApiQuery({ name: "strategy", required: false })
  @ApiQuery({ name: "targetTimelineId", required: false })
  @ApiUnprocessableEntityResponse({
    description: "A delete strategy or target timeline is required",
  })
  @Delete("api/timelines/:timelineId")
  @Throttle(MUTATION_THROTTLE)
  deleteTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("timelineId", ParseUUIDPipe) timelineId: string,
    @Query(new ZodQueryPipe(DeleteTimelineQuerySchema)) query: DeleteTimelineQueryDto,
  ): Promise<TimelineDeletionResult> {
    return this.timelineService.deleteTimeline(user.id, timelineId, query);
  }

  @ApiOkResponse({
    description: "A page of the current user trashed timelines",
    type: PaginatedTrashedTimelinesDto,
  })
  @ApiOperation({ summary: "List timelines waiting in the trash before their scheduled purge" })
  @Get("api/timelines/trash")
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedTimelinesQuerySchema)) query: TrashedTimelinesQueryDto,
  ): Promise<PaginatedTrashedTimelines> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The timeline was restored" })
  @ApiNotFoundResponse({ description: "Timeline not found in the trash" })
  @ApiOperation({ summary: "Restore a timeline from the trash" })
  @ApiParam({ description: "Timeline id", name: "timelineId" })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("api/timelines/:timelineId/restore")
  @Throttle(MUTATION_THROTTLE)
  restoreTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param("timelineId", ParseUUIDPipe) timelineId: string,
  ): Promise<void> {
    return this.lifecycleService.restore({ timelineId, userId: user.id });
  }
}
