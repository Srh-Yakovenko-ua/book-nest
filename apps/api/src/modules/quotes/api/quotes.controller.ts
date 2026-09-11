import type {
  PaginatedTrashedQuotes,
  Paginator,
  QuotesFacetsView,
  QuotesOverviewView,
  QuotesSummaryView,
  QuoteView,
} from "@app/shared";

import {
  QuotePostFinishReviewInputSchema,
  QuoteRediscoveryImpressionInputSchema,
  QuotesFacetsQuerySchema,
  QuotesQuerySchema,
  TrashedQuotesQuerySchema,
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
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { QuoteLifecycleService } from "../application/quote-lifecycle.service.js";
import { QuotePostFinishService } from "../application/quote-post-finish.service.js";
import { QuoteRediscoveryService } from "../application/quote-rediscovery.service.js";
import { QuotesOverviewService } from "../application/quotes-overview.service.js";
import { QuotesService } from "../application/quotes.service.js";
import { QuotePostFinishReviewInputDto } from "./input-dto/quote-post-finish-review.input-dto.js";
import { QuoteRediscoveryImpressionInputDto } from "./input-dto/quote-rediscovery-impression.input-dto.js";
import { QuotesFacetsQueryDto } from "./input-dto/quotes-facets-query.input-dto.js";
import { QuotesQueryDto } from "./input-dto/quotes-query.input-dto.js";
import { TrashedQuotesQueryDto } from "./input-dto/trashed-quotes-query.input-dto.js";
import { PaginatedQuotesDto } from "./view-dto/paginated-quotes.view-dto.js";
import { PaginatedTrashedQuotesDto } from "./view-dto/paginated-trashed-quotes.view-dto.js";
import { QuotesFacetsViewDto } from "./view-dto/quotes-facets.view-dto.js";
import { QuotesOverviewViewDto } from "./view-dto/quotes-overview.view-dto.js";
import { QuotesSummaryViewDto } from "./view-dto/quotes-summary.view-dto.js";

@ApiTags("quotes")
@Controller("api/quotes")
@JwtProtected()
@Throttle(READ_THROTTLE)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly lifecycleService: QuoteLifecycleService,
    private readonly overviewService: QuotesOverviewService,
    private readonly postFinishService: QuotePostFinishService,
    private readonly rediscoveryService: QuoteRediscoveryService,
  ) {}

  @ApiOkResponse({
    description: "A page of the current user trashed quotes",
    type: PaginatedTrashedQuotesDto,
  })
  @ApiOperation({ summary: "List quotes waiting in the trash before their scheduled purge" })
  @Get("trash")
  @Throttle(READ_THROTTLE)
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedQuotesQuerySchema)) query: TrashedQuotesQueryDto,
  ): Promise<PaginatedTrashedQuotes> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Aggregate statistics over the current user's quotes",
    type: QuotesSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary statistics for the current user's quotes" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<QuotesSummaryView> {
    return this.quotesService.summary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "How many quotes each quick filter would keep in the current search scope",
    type: QuotesFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the book, author and quick-filter facets of the current user's quotes over the filtered dataset",
  })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "createdFrom", required: false })
  @ApiQuery({ name: "createdTo", required: false })
  @ApiQuery({ name: "q", required: false })
  @Get("facets")
  facets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(QuotesFacetsQuerySchema)) query: QuotesFacetsQueryDto,
  ): Promise<QuotesFacetsView> {
    return this.quotesService.facets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "The contextual sidebar payload of the quotes page",
    type: QuotesOverviewViewDto,
  })
  @ApiOperation({
    summary:
      "Get the quote the reader is invited to remember today and the recap of their latest unreviewed finished book, both read-only",
  })
  @Get("overview")
  overview(@CurrentUser() user: AuthenticatedUser): Promise<QuotesOverviewView> {
    return this.overviewService.overview({ userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: QuoteRediscoveryImpressionInputDto })
  @ApiNoContentResponse({ description: "The impression was recorded for the current local day" })
  @ApiNotFoundResponse({ description: "Quote is not available for rediscovery" })
  @ApiOperation({
    summary: "Record that the rediscovered quote was shown to the reader today",
  })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("rediscovery/impression")
  @Throttle(MUTATION_THROTTLE)
  recordRediscoveryImpression(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(QuoteRediscoveryImpressionInputSchema))
    body: QuoteRediscoveryImpressionInputDto,
  ): Promise<void> {
    return this.rediscoveryService.recordImpression({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: QuotePostFinishReviewInputDto })
  @ApiNoContentResponse({ description: "The finished reading cycle counts as reviewed" })
  @ApiNotFoundResponse({ description: "Reading cycle was not found" })
  @ApiOperation({
    summary:
      "Mark the quotes of one finished reading cycle as reviewed, so its recap stops being offered",
  })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("post-finish/review")
  @Throttle(MUTATION_THROTTLE)
  reviewPostFinish(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(QuotePostFinishReviewInputSchema))
    body: QuotePostFinishReviewInputDto,
  ): Promise<void> {
    return this.postFinishService.recordReview({ input: body, userId: user.id });
  }

  @ApiOkResponse({ description: "A page of the current user's quotes", type: PaginatedQuotesDto })
  @ApiOperation({ summary: "List all quotes across the current user's books" })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "book", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "createdFrom", required: false })
  @ApiQuery({ name: "createdTo", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(QuotesQuerySchema)) query: QuotesQueryDto,
  ): Promise<Paginator<QuoteView>> {
    return this.quotesService.list({ query, userId: user.id });
  }
}
