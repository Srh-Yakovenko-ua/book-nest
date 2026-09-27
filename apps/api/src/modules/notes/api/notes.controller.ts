import type {
  BookNotesFacetsView,
  BookNotesOverviewView,
  BookNotesSummaryView,
  NoteView,
  PaginatedTrashedNotes,
  Paginator,
  SeriesNotesFacetsView,
  SeriesNotesOverviewView,
  SeriesNotesSummaryView,
} from "@app/shared";

import {
  BookNotesFacetsQuerySchema,
  BookNotesQuerySchema,
  NotePostFinishReviewInputSchema,
  NoteRediscoveryImpressionInputSchema,
  SeriesNotesFacetsQuerySchema,
  SeriesNotesOverviewQuerySchema,
  SeriesNotesQuerySchema,
  TrashedNotesQuerySchema,
} from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { NoteLifecycleService } from "../application/note-lifecycle.service.js";
import { NotePostFinishService } from "../application/note-post-finish.service.js";
import { NoteRediscoveryService } from "../application/note-rediscovery.service.js";
import { NotesFacetsService } from "../application/notes-facets.service.js";
import { NotesOverviewService } from "../application/notes-overview.service.js";
import { NotesSummaryService } from "../application/notes-summary.service.js";
import { NotesService } from "../application/notes.service.js";
import { BookNotesFacetsQueryDto } from "./input-dto/book-notes-facets-query.input-dto.js";
import { BookNotesQueryDto } from "./input-dto/book-notes-query.input-dto.js";
import { NotePostFinishReviewInputDto } from "./input-dto/note-post-finish-review.input-dto.js";
import { NoteRediscoveryImpressionInputDto } from "./input-dto/note-rediscovery-impression.input-dto.js";
import { SeriesNotesFacetsQueryDto } from "./input-dto/series-notes-facets-query.input-dto.js";
import { SeriesNotesOverviewQueryDto } from "./input-dto/series-notes-overview-query.input-dto.js";
import { SeriesNotesQueryDto } from "./input-dto/series-notes-query.input-dto.js";
import { TrashedNotesQueryDto } from "./input-dto/trashed-notes-query.input-dto.js";
import { BookNotesFacetsViewDto } from "./view-dto/book-notes-facets.view-dto.js";
import { BookNotesOverviewViewDto } from "./view-dto/book-notes-overview.view-dto.js";
import { BookNotesSummaryViewDto } from "./view-dto/book-notes-summary.view-dto.js";
import { PaginatedNotesDto } from "./view-dto/paginated-notes.view-dto.js";
import { PaginatedTrashedNotesDto } from "./view-dto/paginated-trashed-notes.view-dto.js";
import { SeriesNotesFacetsViewDto } from "./view-dto/series-notes-facets.view-dto.js";
import { SeriesNotesOverviewViewDto } from "./view-dto/series-notes-overview.view-dto.js";
import { SeriesNotesSummaryViewDto } from "./view-dto/series-notes-summary.view-dto.js";

@ApiTags("notes")
@Controller("api/notes")
@JwtProtected()
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly lifecycleService: NoteLifecycleService,
    private readonly facetsService: NotesFacetsService,
    private readonly summaryService: NotesSummaryService,
    private readonly overviewService: NotesOverviewService,
    private readonly rediscoveryService: NoteRediscoveryService,
    private readonly postFinishService: NotePostFinishService,
  ) {}

  @ApiOkResponse({
    description: "A page of the current user trashed notes",
    type: PaginatedTrashedNotesDto,
  })
  @ApiOperation({ summary: "List notes waiting in the trash before their scheduled purge" })
  @Get("trash")
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedNotesQuerySchema)) query: TrashedNotesQueryDto,
  ): Promise<PaginatedTrashedNotes> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "Quick-filter counts and book, author and category facets of the book notes archive",
    type: BookNotesFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the contextual facets of the current user's book notes; every dimension ignores its own selection and the quick filter",
  })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "customCategory", required: false })
  @ApiQuery({ name: "hasPage", required: false })
  @ApiQuery({ name: "hasChapter", required: false })
  @Get("books/facets")
  @Throttle(HEAVY_READ_THROTTLE)
  bookFacets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(BookNotesFacetsQuerySchema)) query: BookNotesFacetsQueryDto,
  ): Promise<BookNotesFacetsView> {
    return this.facetsService.bookFacets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Stable four-card summary of the book notes archive",
    type: BookNotesSummaryViewDto,
  })
  @ApiOperation({
    summary:
      "Get the stable summary of the current user's book notes, independent of search, filters, sort and pagination",
  })
  @Get("books/summary")
  @Throttle(READ_THROTTLE)
  bookSummary(@CurrentUser() user: AuthenticatedUser): Promise<BookNotesSummaryView> {
    return this.summaryService.bookSummary({ userId: user.id });
  }

  @ApiOkResponse({
    description:
      "The rediscovered book note of the day and the recap of the latest unreviewed finished book, each nullable",
    type: BookNotesOverviewViewDto,
  })
  @ApiOperation({
    summary:
      "Get the contextual overview of the book notes page; read-only, it never records an impression or a review",
  })
  @Get("books/overview")
  @Throttle(HEAVY_READ_THROTTLE)
  bookOverview(@CurrentUser() user: AuthenticatedUser): Promise<BookNotesOverviewView> {
    return this.overviewService.bookOverview({ userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: NotePostFinishReviewInputDto })
  @ApiNoContentResponse({ description: "The finished reading cycle counts as reviewed for notes" })
  @ApiNotFoundResponse({ description: "Reading cycle was not found" })
  @ApiOperation({
    summary:
      "Mark the notes of one finished reading cycle as reviewed, so the book notes recap stops offering it",
  })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("books/post-finish/review")
  @Throttle(MUTATION_THROTTLE)
  reviewPostFinish(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NotePostFinishReviewInputSchema)) body: NotePostFinishReviewInputDto,
  ): Promise<void> {
    return this.postFinishService.recordReview({ input: body, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "The notes to recall before the series continuation and the rediscovered note of the day, each nullable",
    type: SeriesNotesOverviewViewDto,
  })
  @ApiOperation({
    summary:
      "Get the contextual overview of the series notes page for the series the backend resolves; read-only",
  })
  @ApiQuery({ name: "series", required: false })
  @Get("series/overview")
  @Throttle(HEAVY_READ_THROTTLE)
  seriesOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesNotesOverviewQuerySchema)) query: SeriesNotesOverviewQueryDto,
  ): Promise<SeriesNotesOverviewView> {
    return this.overviewService.seriesOverview({
      selectedSeriesIds: query.series ?? [],
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: NoteRediscoveryImpressionInputDto })
  @ApiNoContentResponse({ description: "The impression was recorded for the current local day" })
  @ApiNotFoundResponse({ description: "Note is not available for rediscovery" })
  @ApiOperation({
    summary:
      "Record that a rediscovered note was shown today, on whichever notes page its impression key came from",
  })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("rediscovery/impression")
  @Throttle(MUTATION_THROTTLE)
  recordRediscoveryImpression(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NoteRediscoveryImpressionInputSchema))
    body: NoteRediscoveryImpressionInputDto,
  ): Promise<void> {
    return this.rediscoveryService.recordImpression({ input: body, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "Quick-filter counts and series, author, genre and category facets of the series notes archive",
    type: SeriesNotesFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the contextual facets of the current user's series notes; every dimension ignores its own selection and the quick filter",
  })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "series", required: false })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "genre", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "customCategory", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "reading", required: false })
  @Get("series/facets")
  @Throttle(HEAVY_READ_THROTTLE)
  seriesFacets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesNotesFacetsQuerySchema)) query: SeriesNotesFacetsQueryDto,
  ): Promise<SeriesNotesFacetsView> {
    return this.facetsService.seriesFacets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Stable four-card summary of the series notes archive",
    type: SeriesNotesSummaryViewDto,
  })
  @ApiOperation({
    summary:
      "Get the stable summary of the current user's series notes, independent of search, filters, sort and pagination",
  })
  @Get("series/summary")
  @Throttle(READ_THROTTLE)
  seriesSummary(@CurrentUser() user: AuthenticatedUser): Promise<SeriesNotesSummaryView> {
    return this.summaryService.seriesSummary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of the current user's book notes",
    type: PaginatedNotesDto,
  })
  @ApiOperation({ summary: "List and search the current user's book notes archive" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "customCategory", required: false })
  @ApiQuery({ name: "hasPage", required: false })
  @ApiQuery({ name: "hasChapter", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("books")
  @Throttle(READ_THROTTLE)
  listBookArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(BookNotesQuerySchema)) query: BookNotesQueryDto,
  ): Promise<Paginator<NoteView>> {
    return this.notesService.listBookArchive({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of the current user's series notes",
    type: PaginatedNotesDto,
  })
  @ApiOperation({ summary: "List and search the current user's series notes archive" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "series", required: false })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "genre", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "customCategory", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "reading", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("series")
  @Throttle(READ_THROTTLE)
  listSeriesArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesNotesQuerySchema)) query: SeriesNotesQueryDto,
  ): Promise<Paginator<NoteView>> {
    return this.notesService.listSeriesArchive({ query, userId: user.id });
  }
}
