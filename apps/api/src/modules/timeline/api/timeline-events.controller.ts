import type {
  CreatedEventRelationView,
  Paginator,
  TimelineEventDetailView,
  TimelineEventView,
  TimelineOverviewView,
} from "@app/shared";

import {
  CreateEventRelationInputSchema,
  CreateTimelineEventInputSchema,
  MoveTimelineEventInputSchema,
  ReorderTimelineEventInputSchema,
  TimelineEventsQuerySchema,
  UpdateTimelineEventInputSchema,
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
import { TimelineEventOrderingService } from "../application/timeline-event-ordering.service.js";
import { TimelineEventService } from "../application/timeline-event.service.js";
import { TimelineRelationService } from "../application/timeline-relation.service.js";
import { CreateEventRelationInputDto } from "./input-dto/create-event-relation.input-dto.js";
import { CreateTimelineEventInputDto } from "./input-dto/create-timeline-event.input-dto.js";
import { MoveTimelineEventInputDto } from "./input-dto/move-timeline-event.input-dto.js";
import { ReorderTimelineEventInputDto } from "./input-dto/reorder-timeline-event.input-dto.js";
import { TimelineEventsQueryDto } from "./input-dto/timeline-events-query.input-dto.js";
import { UpdateTimelineEventInputDto } from "./input-dto/update-timeline-event.input-dto.js";
import { CreatedEventRelationViewDto } from "./view-dto/created-event-relation.view-dto.js";
import { PaginatedTimelineEventsDto } from "./view-dto/paginated-timeline-events.view-dto.js";
import { TimelineEventDetailViewDto } from "./view-dto/timeline-event-detail.view-dto.js";
import { TimelineEventViewDto } from "./view-dto/timeline-event.view-dto.js";
import { TimelineOverviewViewDto } from "./view-dto/timeline-overview.view-dto.js";

@ApiTags("timeline-events")
@Controller()
@JwtProtected()
export class TimelineEventsController {
  constructor(
    private readonly timelineEventService: TimelineEventService,
    private readonly timelineEventOrderingService: TimelineEventOrderingService,
    private readonly timelineRelationService: TimelineRelationService,
  ) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "A page of the book's timeline events",
    type: PaginatedTimelineEventsDto,
  })
  @ApiOperation({ summary: "List, filter and sort a book's timeline events" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "timelineId", required: false })
  @ApiQuery({ name: "eventType", required: false })
  @ApiQuery({ name: "importance", required: false })
  @ApiQuery({ name: "important", required: false })
  @ApiQuery({ name: "keyOnly", required: false })
  @ApiQuery({ name: "unresolved", required: false })
  @ApiQuery({ name: "recap", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("api/books/:bookId/timeline-events")
  listEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(TimelineEventsQuerySchema)) query: TimelineEventsQueryDto,
  ): Promise<Paginator<TimelineEventView>> {
    return this.timelineEventService.listEvents(user.id, bookId, query);
  }

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "Aggregated timeline distributions for a book",
    type: TimelineOverviewViewDto,
  })
  @ApiOperation({ summary: "Get aggregated timeline statistics for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Get("api/books/:bookId/timeline/overview")
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<TimelineOverviewView> {
    return this.timelineEventService.overview(user.id, bookId);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateTimelineEventInputDto })
  @ApiCreatedResponse({ description: "The created timeline event", type: TimelineEventViewDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Create a timeline event for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiUnprocessableEntityResponse({ description: "Invalid page, timeline or resolving event" })
  @Post("api/books/:bookId/timeline-events")
  @Throttle(MUTATION_THROTTLE)
  createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(CreateTimelineEventInputSchema)) body: CreateTimelineEventInputDto,
  ): Promise<TimelineEventView> {
    return this.timelineEventService.createEvent(user.id, bookId, body);
  }

  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOkResponse({
    description: "The full timeline event with its relations in both directions",
    type: TimelineEventDetailViewDto,
  })
  @ApiOperation({ summary: "Get a timeline event with its relations" })
  @ApiParam({ description: "Event id", name: "eventId" })
  @Get("api/timeline-events/:eventId")
  getEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<TimelineEventDetailView> {
    return this.timelineEventService.getEvent(user.id, eventId);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateTimelineEventInputDto })
  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOkResponse({ description: "The updated timeline event", type: TimelineEventViewDto })
  @ApiOperation({ summary: "Update a timeline event" })
  @ApiParam({ description: "Event id", name: "eventId" })
  @ApiUnprocessableEntityResponse({ description: "Invalid page or resolving event" })
  @Patch("api/timeline-events/:eventId")
  @Throttle(MUTATION_THROTTLE)
  updateEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body(new ZodBodyPipe(UpdateTimelineEventInputSchema)) body: UpdateTimelineEventInputDto,
  ): Promise<TimelineEventView> {
    return this.timelineEventService.updateEvent(user.id, eventId, body);
  }

  @ApiNoContentResponse({ description: "The event was deleted" })
  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOperation({ summary: "Delete a timeline event" })
  @ApiParam({ description: "Event id", name: "eventId" })
  @Delete("api/timeline-events/:eventId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  deleteEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    return this.timelineEventService.deleteEvent(user.id, eventId);
  }

  @ApiBody({ type: ReorderTimelineEventInputDto })
  @ApiConflictResponse({ description: "The event order changed, reload and retry" })
  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOkResponse({ description: "The reordered event", type: TimelineEventViewDto })
  @ApiOperation({ summary: "Reorder a timeline event within the book or its timeline" })
  @ApiParam({ description: "Event id", name: "eventId" })
  @ApiUnprocessableEntityResponse({ description: "The neighbor event is invalid" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("api/timeline-events/:eventId/reorder")
  @Throttle(MUTATION_THROTTLE)
  reorderEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body(new ZodBodyPipe(ReorderTimelineEventInputSchema)) body: ReorderTimelineEventInputDto,
  ): Promise<TimelineEventView> {
    return this.timelineEventOrderingService.reorderEvent(user.id, eventId, body);
  }

  @ApiBody({ type: MoveTimelineEventInputDto })
  @ApiConflictResponse({ description: "The event changed, reload and retry" })
  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOkResponse({ description: "The moved event", type: TimelineEventViewDto })
  @ApiOperation({ summary: "Move a timeline event to another timeline of the same book" })
  @ApiParam({ description: "Event id", name: "eventId" })
  @ApiUnprocessableEntityResponse({ description: "The target timeline or neighbor is invalid" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("api/timeline-events/:eventId/move")
  @Throttle(MUTATION_THROTTLE)
  moveEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body(new ZodBodyPipe(MoveTimelineEventInputSchema)) body: MoveTimelineEventInputDto,
  ): Promise<TimelineEventView> {
    return this.timelineEventOrderingService.moveEvent(user.id, eventId, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateEventRelationInputDto })
  @ApiConflictResponse({ description: "This relation already exists" })
  @ApiCreatedResponse({ description: "The created relation", type: CreatedEventRelationViewDto })
  @ApiNotFoundResponse({ description: "Event not found" })
  @ApiOperation({ summary: "Create a relation from an event to another event of the same book" })
  @ApiParam({ description: "Source event id", name: "eventId" })
  @ApiUnprocessableEntityResponse({ description: "Self relation or cross-book target" })
  @Post("api/timeline-events/:eventId/relations")
  @Throttle(MUTATION_THROTTLE)
  createRelation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body(new ZodBodyPipe(CreateEventRelationInputSchema)) body: CreateEventRelationInputDto,
  ): Promise<CreatedEventRelationView> {
    return this.timelineRelationService.createRelation(user.id, eventId, body);
  }

  @ApiNoContentResponse({ description: "The relation was deleted" })
  @ApiNotFoundResponse({ description: "Relation not found" })
  @ApiOperation({ summary: "Delete an event relation" })
  @ApiParam({ description: "Relation id", name: "relationId" })
  @Delete("api/timeline-event-relations/:relationId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  deleteRelation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationId", ParseUUIDPipe) relationId: string,
  ): Promise<void> {
    return this.timelineRelationService.deleteRelation(user.id, relationId);
  }
}
