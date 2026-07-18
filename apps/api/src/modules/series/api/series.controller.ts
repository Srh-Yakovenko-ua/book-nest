import type {
  FavoriteSeriesContinuationsView,
  Paginator,
  SeriesDetailsView,
  SeriesOverviewView,
  SeriesView,
} from "@app/shared";

import {
  FavoriteSeriesContinuationsQuerySchema,
  NewSeriesInputSchema,
  SeriesSearchQuerySchema,
  UpdateSeriesInputSchema,
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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { SeriesService } from "../application/series.service.js";
import { FavoriteSeriesContinuationsQueryDto } from "./input-dto/favorite-series-continuations-query.input-dto.js";
import { NewSeriesInputDto } from "./input-dto/new-series.input-dto.js";
import { SeriesSearchQueryDto } from "./input-dto/series-search-query.input-dto.js";
import { UpdateSeriesInputDto } from "./input-dto/update-series.input-dto.js";
import { FavoriteSeriesContinuationsViewDto } from "./view-dto/favorite-series-continuations.view-dto.js";
import { PaginatedSeriesDto } from "./view-dto/paginated-series.view-dto.js";
import { SeriesDetailsViewDto } from "./view-dto/series-details.view-dto.js";
import { SeriesOverviewViewDto } from "./view-dto/series-overview.view-dto.js";
import { SeriesViewDto } from "./view-dto/series.view-dto.js";

const CREATE_SERIES_TTL_SECONDS = 60;
const CREATE_SERIES_LIMIT = 30;
const UPDATE_SERIES_TTL_SECONDS = 60;
const UPDATE_SERIES_LIMIT = 60;

@ApiTags("series")
@Controller("api/series")
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: NewSeriesInputDto })
  @ApiConflictResponse({ description: "A series with this name already exists" })
  @ApiCreatedResponse({ description: "The created series", type: SeriesViewDto })
  @ApiOperation({ summary: "Create a series in the current user library" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Post()
  @Throttle({ default: { limit: CREATE_SERIES_LIMIT, ttl: seconds(CREATE_SERIES_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NewSeriesInputSchema)) body: NewSeriesInputDto,
  ): Promise<SeriesView> {
    return this.seriesService.create(user.id, body);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of the current user series", type: PaginatedSeriesDto })
  @ApiOperation({ summary: "Search the current user series" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "authorIds", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesSearchQuerySchema))
    query: SeriesSearchQueryDto,
  ): Promise<Paginator<SeriesView>> {
    return this.seriesService.search(user.id, query);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Series overview for the current user",
    type: SeriesOverviewViewDto,
  })
  @ApiOperation({ summary: "Get the current user series overview" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("overview")
  @UseGuards(JwtAccessGuard)
  overview(@CurrentUser() user: AuthenticatedUser): Promise<SeriesOverviewView> {
    return this.seriesService.overview(user.id);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Continue-your-favorite-series items for the current user",
    type: FavoriteSeriesContinuationsViewDto,
  })
  @ApiOperation({ summary: "Get the next book to read in the current user favorite series" })
  @ApiQuery({ name: "limit", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("favorite-continuations")
  @UseGuards(JwtAccessGuard)
  favoriteContinuations(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(FavoriteSeriesContinuationsQuerySchema))
    query: FavoriteSeriesContinuationsQueryDto,
  ): Promise<FavoriteSeriesContinuationsView> {
    return this.seriesService.favoriteContinuations(user.id, query);
  }

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({ description: "The requested series with its books", type: SeriesDetailsViewDto })
  @ApiOperation({ summary: "Get a series by id" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":id")
  @UseGuards(JwtAccessGuard)
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SeriesDetailsView> {
    return this.seriesService.getById(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateSeriesInputDto })
  @ApiConflictResponse({ description: "A series with this name already exists" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({ description: "The updated series", type: SeriesViewDto })
  @ApiOperation({ summary: "Update a series in the current user library" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({ description: "The series update violates a domain rule" })
  @Patch(":id")
  @Throttle({ default: { limit: UPDATE_SERIES_LIMIT, ttl: seconds(UPDATE_SERIES_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateSeriesInputSchema)) body: UpdateSeriesInputDto,
  ): Promise<SeriesView> {
    return this.seriesService.update(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The series was deleted" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOperation({ summary: "Delete a series by id" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({ default: { limit: UPDATE_SERIES_LIMIT, ttl: seconds(UPDATE_SERIES_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.seriesService.delete(user.id, id);
  }
}
