import type {
  GenreFacetsView,
  GenresOverviewView,
  GenreSummaryView,
  GenreView,
  PaginatedGenreStats,
} from "@app/shared";

import { GenreFacetsQuerySchema, GenresQuerySchema, RecentGenresQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { GenreStatsService } from "../application/genre-stats.service.js";
import { GenreSummaryService } from "../application/genre-summary.service.js";
import { GenresOverviewService } from "../application/genres-overview.service.js";
import { GenresService } from "../application/genres.service.js";
import { GenreFacetsQueryDto } from "./input-dto/genre-facets-query.input-dto.js";
import { GenresQueryDto } from "./input-dto/genres-query.input-dto.js";
import { RecentGenresQueryDto } from "./input-dto/recent-genres-query.input-dto.js";
import { GenreFacetsViewDto } from "./view-dto/genre-facets.view-dto.js";
import { GenreSummaryViewDto } from "./view-dto/genre-summary.view-dto.js";
import { GenresOverviewViewDto } from "./view-dto/genres-overview.view-dto.js";
import { PaginatedGenreStatsDto } from "./view-dto/paginated-genre-stats.view-dto.js";

@ApiTags("genres")
@Controller("api/genres")
@JwtProtected()
export class GenresController {
  constructor(
    private readonly genresService: GenresService,
    private readonly genreStatsService: GenreStatsService,
    private readonly genreSummaryService: GenreSummaryService,
    private readonly genresOverviewService: GenresOverviewService,
  ) {}

  @ApiOkResponse({ description: "The predefined system genre catalog" })
  @ApiOperation({ summary: "List the predefined system genre catalog" })
  @Get()
  @Throttle(READ_THROTTLE)
  list(): Promise<GenreView[]> {
    return this.genresService.list();
  }

  @ApiOkResponse({ description: "System genres the current user recently used in their own books" })
  @ApiOperation({ summary: "List recently used system genres for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @Get("recent")
  @Throttle(READ_THROTTLE)
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(RecentGenresQuerySchema)) query: RecentGenresQueryDto,
  ): Promise<GenreView[]> {
    return this.genresService.recent({ limit: query.limit, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description: "A page of per-genre statistics over the current user library",
    type: PaginatedGenreStatsDto,
  })
  @ApiOperation({
    summary:
      "List the current user's genres with search, advanced filters, a quick filter, sort and pagination",
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "group", required: false })
  @ApiQuery({ name: "booksMin", required: false })
  @ApiQuery({ name: "booksMax", required: false })
  @ApiQuery({ name: "ratingMin", required: false })
  @ApiQuery({ name: "ratingMax", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("stats")
  @Throttle(READ_THROTTLE)
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(GenresQuerySchema)) query: GenresQueryDto,
  ): Promise<PaginatedGenreStats> {
    return this.genreStatsService.list({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description: "Quick-filter counts and the stable group options of the Genres page",
    type: GenreFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the Genres page facets; quick counts honour search and advanced filters but ignore the quick filter, sort and pagination",
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "group", required: false })
  @ApiQuery({ name: "booksMin", required: false })
  @ApiQuery({ name: "booksMax", required: false })
  @ApiQuery({ name: "ratingMin", required: false })
  @ApiQuery({ name: "ratingMax", required: false })
  @Get("facets")
  @Throttle(READ_THROTTLE)
  facets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(GenreFacetsQuerySchema)) query: GenreFacetsQueryDto,
  ): Promise<GenreFacetsView> {
    return this.genreStatsService.facets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Stable six-card summary of the current user's genres",
    type: GenreSummaryViewDto,
  })
  @ApiOperation({
    summary: "Get the Genres summary, independent of search, filters, sort and pagination",
  })
  @Get("summary")
  @Throttle(HEAVY_READ_THROTTLE)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<GenreSummaryView> {
    return this.genreSummaryService.summary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "Dormant, new-for-you and unrated-finished genre insights, at most two each",
    type: GenresOverviewViewDto,
  })
  @ApiOperation({
    summary:
      "Get the contextual Genres overview, independent of search, filters, sort and pagination",
  })
  @Get("overview")
  @Throttle(HEAVY_READ_THROTTLE)
  overview(@CurrentUser() user: AuthenticatedUser): Promise<GenresOverviewView> {
    return this.genresOverviewService.overview({ userId: user.id });
  }
}
