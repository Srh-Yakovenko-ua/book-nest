import type {
  LibraryPublisherDetail,
  LibraryPublisherListItem,
  LibraryPublishersSummary,
  Paginator,
  PublisherView,
} from "@app/shared";

import {
  CatalogLocaleSchema,
  LibraryPublisherDetailQuerySchema,
  LibraryPublishersQuerySchema,
  PublisherSearchPaginationQuerySchema,
  RecentPublishersQuerySchema,
  UpdatePublisherInputSchema,
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
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { PublishersService } from "../application/publishers.service.js";
import { LibraryPublisherDetailQueryDto } from "./input-dto/library-publisher-detail-query.input-dto.js";
import { LibraryPublishersQueryDto } from "./input-dto/library-publishers-query.input-dto.js";
import { PublisherSearchPaginationQueryDto } from "./input-dto/publisher-search-query.input-dto.js";
import { RecentPublishersQueryDto } from "./input-dto/recent-publishers-query.input-dto.js";
import { UpdatePublisherDto } from "./input-dto/update-publisher.input-dto.js";
import { LibraryPublisherDetailDto } from "./view-dto/library-publisher-detail.view-dto.js";
import { LibraryPublishersPageDto } from "./view-dto/library-publishers-page.view-dto.js";
import { LibraryPublishersSummaryDto } from "./view-dto/library-publishers-summary.view-dto.js";

const MUTATE_PUBLISHER_TTL_SECONDS = 60;
const MUTATE_PUBLISHER_LIMIT = 60;

@ApiTags("publishers")
@Controller("api/publishers")
export class PublishersController {
  constructor(private readonly publishersService: PublishersService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Aggregate publisher metrics over the current user library",
    type: LibraryPublishersSummaryDto,
  })
  @ApiOperation({ summary: "Get the publishers summary for the current user library" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("library/summary")
  @UseGuards(JwtAccessGuard)
  librarySummary(@CurrentUser() user: AuthenticatedUser): Promise<LibraryPublishersSummary> {
    return this.publishersService.librarySummary({ userId: user.id });
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "A page of publishers represented in the current user library",
    type: LibraryPublishersPageDto,
  })
  @ApiOperation({ summary: "List publishers the current user has books for, with stats" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ enum: ["all", "ua", "foreign", "unknown"], name: "geography", required: false })
  @ApiQuery({ enum: ["all", "global", "custom"], name: "source", required: false })
  @ApiQuery({ name: "hasBooksToBuy", required: false })
  @ApiQuery({ name: "hasSeries", required: false })
  @ApiQuery({ name: "hasRatedBooks", required: false })
  @ApiQuery({
    enum: ["name", "booksCount", "readCount", "wantToBuyCount", "averageRating", "lastBookAddedAt"],
    name: "sort",
    required: false,
  })
  @ApiQuery({ enum: ["asc", "desc"], name: "order", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("library")
  @UseGuards(JwtAccessGuard)
  libraryList(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LibraryPublishersQuerySchema)) query: LibraryPublishersQueryDto,
  ): Promise<Paginator<LibraryPublisherListItem>> {
    return this.publishersService.libraryList({ query, userId: user.id });
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "Publishers the current user recently used in their own books" })
  @ApiOperation({ summary: "List recently used publishers for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("recent")
  @UseGuards(JwtAccessGuard)
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(RecentPublishersQuerySchema)) query: RecentPublishersQueryDto,
  ): Promise<PublisherView[]> {
    return this.publishersService.recent({
      limit: query.limit,
      locale: query.locale,
      userId: user.id,
    });
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of publishers visible to the current user" })
  @ApiOperation({ summary: "Search publishers (global seeds + own custom)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(PublisherSearchPaginationQuerySchema))
    query: PublisherSearchPaginationQueryDto,
  ): Promise<Paginator<PublisherView>> {
    return this.publishersService.search(user.id, query);
  }

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "Publisher not found or not represented in the library" })
  @ApiOkResponse({
    description: "The publisher with the current user library stats",
    type: LibraryPublisherDetailDto,
  })
  @ApiOperation({ summary: "Get a publisher with the current user library stats" })
  @ApiParam({ name: "publisherId" })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":publisherId/library-detail")
  @UseGuards(JwtAccessGuard)
  libraryDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publisherId", ParseUUIDPipe) publisherId: string,
    @Query(new ZodQueryPipe(LibraryPublisherDetailQuerySchema))
    query: LibraryPublisherDetailQueryDto,
  ): Promise<LibraryPublisherDetail> {
    return this.publishersService.libraryDetail({
      locale: query.locale,
      publisherId,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdatePublisherDto })
  @ApiConflictResponse({ description: "A publisher with this name already exists" })
  @ApiForbiddenResponse({ description: "Global publishers cannot be edited" })
  @ApiNotFoundResponse({ description: "Publisher not found" })
  @ApiOkResponse({
    description: "The updated custom publisher with the current user library stats",
    type: LibraryPublisherDetailDto,
  })
  @ApiOperation({ summary: "Edit a custom publisher owned by the current user" })
  @ApiParam({ name: "publisherId" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Patch(":publisherId")
  @Throttle({
    default: { limit: MUTATE_PUBLISHER_LIMIT, ttl: seconds(MUTATE_PUBLISHER_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  updateCustom(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publisherId", ParseUUIDPipe) publisherId: string,
    @Body(new ZodBodyPipe(UpdatePublisherInputSchema)) body: UpdatePublisherDto,
  ): Promise<LibraryPublisherDetail> {
    return this.publishersService.updateCustom({ input: body, publisherId, userId: user.id });
  }

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "The publisher still has linked books" })
  @ApiForbiddenResponse({ description: "Global publishers cannot be deleted" })
  @ApiNoContentResponse({ description: "The custom publisher was deleted" })
  @ApiNotFoundResponse({ description: "Publisher not found" })
  @ApiOperation({ summary: "Delete a custom publisher owned by the current user" })
  @ApiParam({ name: "publisherId" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":publisherId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: { limit: MUTATE_PUBLISHER_LIMIT, ttl: seconds(MUTATE_PUBLISHER_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  deleteCustom(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publisherId", ParseUUIDPipe) publisherId: string,
  ): Promise<void> {
    return this.publishersService.deleteCustom({ publisherId, userId: user.id });
  }
}
