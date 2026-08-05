import type {
  FavoriteSeriesContinuationsView,
  PaginatedTrashedSeries,
  Paginator,
  SeriesDeletionResult,
  SeriesDetailsView,
  SeriesOverviewView,
  SeriesView,
} from "@app/shared";

import {
  FavoriteSeriesContinuationsQuerySchema,
  NewSeriesInputSchema,
  SeriesSearchQuerySchema,
  TrashedSeriesQuerySchema,
  UpdateSeriesInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { SeriesLifecycleService } from "../application/series-lifecycle.service.js";
import { SeriesService } from "../application/series.service.js";
import { FavoriteSeriesContinuationsQueryDto } from "./input-dto/favorite-series-continuations-query.input-dto.js";
import { NewSeriesInputDto } from "./input-dto/new-series.input-dto.js";
import { SeriesSearchQueryDto } from "./input-dto/series-search-query.input-dto.js";
import { TrashedSeriesQueryDto } from "./input-dto/trashed-series-query.input-dto.js";
import { UpdateSeriesInputDto } from "./input-dto/update-series.input-dto.js";
import { FavoriteSeriesContinuationsViewDto } from "./view-dto/favorite-series-continuations.view-dto.js";
import { PaginatedSeriesDto } from "./view-dto/paginated-series.view-dto.js";
import { PaginatedTrashedSeriesDto } from "./view-dto/paginated-trashed-series.view-dto.js";
import { SeriesDeletionResultDto } from "./view-dto/series-deletion-result.view-dto.js";
import { SeriesDetailsViewDto } from "./view-dto/series-details.view-dto.js";
import { SeriesOverviewViewDto } from "./view-dto/series-overview.view-dto.js";
import { SeriesViewDto } from "./view-dto/series.view-dto.js";

const CREATE_SERIES_TTL_SECONDS = 60;
const CREATE_SERIES_LIMIT = 30;
@ApiTags("series")
@Controller("api/series")
export class SeriesController {
  constructor(
    private readonly seriesService: SeriesService,
    private readonly lifecycleService: SeriesLifecycleService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: NewSeriesInputDto })
  @ApiConflictResponse({ description: "A series with this name already exists" })
  @ApiCreatedResponse({ description: "The created series", type: SeriesViewDto })
  @ApiOperation({ summary: "Create a series in the current user library" })
  @JwtProtected()
  @Post()
  @Throttle({ default: { limit: CREATE_SERIES_LIMIT, ttl: seconds(CREATE_SERIES_TTL_SECONDS) } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NewSeriesInputSchema)) body: NewSeriesInputDto,
  ): Promise<SeriesView> {
    return this.seriesService.create(user.id, body);
  }
  @ApiOkResponse({ description: "A page of the current user series", type: PaginatedSeriesDto })
  @ApiOperation({ summary: "Search the current user series" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "authorIds", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @JwtProtected()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesSearchQuerySchema))
    query: SeriesSearchQueryDto,
  ): Promise<Paginator<SeriesView>> {
    return this.seriesService.search(user.id, query);
  }
  @ApiOkResponse({
    description: "Series overview for the current user",
    type: SeriesOverviewViewDto,
  })
  @ApiOperation({ summary: "Get the current user series overview" })
  @Get("overview")
  @JwtProtected()
  overview(@CurrentUser() user: AuthenticatedUser): Promise<SeriesOverviewView> {
    return this.seriesService.overview(user.id);
  }
  @ApiOkResponse({
    description: "Continue-your-favorite-series items for the current user",
    type: FavoriteSeriesContinuationsViewDto,
  })
  @ApiOperation({ summary: "Get the next book to read in the current user favorite series" })
  @ApiQuery({ name: "limit", required: false })
  @Get("favorite-continuations")
  @JwtProtected()
  favoriteContinuations(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(FavoriteSeriesContinuationsQuerySchema))
    query: FavoriteSeriesContinuationsQueryDto,
  ): Promise<FavoriteSeriesContinuationsView> {
    return this.seriesService.favoriteContinuations(user.id, query);
  }
  @ApiOkResponse({
    description: "A page of the current user trashed series",
    type: PaginatedTrashedSeriesDto,
  })
  @ApiOperation({ summary: "List series waiting in the trash before their scheduled purge" })
  @Get("trash")
  @JwtProtected()
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedSeriesQuerySchema)) query: TrashedSeriesQueryDto,
  ): Promise<PaginatedTrashedSeries> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({ description: "The requested series with its books", type: SeriesDetailsViewDto })
  @ApiOperation({ summary: "Get a series by id" })
  @Get(":id")
  @JwtProtected()
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SeriesDetailsView> {
    return this.seriesService.getById(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateSeriesInputDto })
  @ApiConflictResponse({ description: "A series with this name already exists" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({ description: "The updated series", type: SeriesViewDto })
  @ApiOperation({ summary: "Update a series in the current user library" })
  @ApiUnprocessableEntityResponse({ description: "The series update violates a domain rule" })
  @JwtProtected()
  @Patch(":id")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateSeriesInputSchema)) body: UpdateSeriesInputDto,
  ): Promise<SeriesView> {
    return this.seriesService.update(user.id, id, body);
  }
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The series was moved to the trash and scheduled for purge",
    type: SeriesDeletionResultDto,
  })
  @ApiOperation({ summary: "Move a series to the trash" })
  @Delete(":id")
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SeriesDeletionResult> {
    return this.lifecycleService.softDelete({ seriesId: id, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Series not found in the trash" })
  @ApiOkResponse({ description: "The restored series", type: SeriesDetailsViewDto })
  @ApiOperation({ summary: "Restore a series from the trash" })
  @JwtProtected()
  @Post(":id/restore")
  @Throttle(MUTATION_THROTTLE)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SeriesDetailsView> {
    return this.lifecycleService.restore({ seriesId: id, userId: user.id });
  }
}
