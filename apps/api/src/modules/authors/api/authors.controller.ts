import type {
  AuthorBookSuggestionView,
  AuthorLookupResult,
  AuthorView,
  Paginator,
} from "@app/shared";

import {
  AuthorLookupQuerySchema,
  AuthorSearchPaginationQuerySchema,
  CatalogLocaleSchema,
  RecentAuthorsQuerySchema,
} from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { UserModel } from "../../../generated/prisma/models.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { AuthorsService } from "../application/authors.service.js";
import { AuthorLookupQueryDto } from "./input-dto/author-lookup-query.input-dto.js";
import { AuthorSearchPaginationQueryDto } from "./input-dto/author-search-query.input-dto.js";
import { RecentAuthorsQueryDto } from "./input-dto/recent-authors-query.input-dto.js";

const LOOKUP_TTL_SECONDS = 60;
const LOOKUP_LIMIT = 30;

@ApiTags("authors")
@Controller("api/authors")
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "Author candidates from Open Library with an in-database flag" })
  @ApiOperation({ summary: "Look up authors from Open Library" })
  @ApiQuery({ name: "q", required: true })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("lookup")
  @Throttle({ default: { limit: LOOKUP_LIMIT, ttl: seconds(LOOKUP_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  lookup(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(AuthorLookupQuerySchema)) query: AuthorLookupQueryDto,
  ): Promise<AuthorLookupResult[]> {
    return this.authorsService.lookup(user.id, query.q);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "Authors the current user recently used in their own books" })
  @ApiOperation({ summary: "List recently used authors for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("recent")
  @UseGuards(JwtAccessGuard)
  recent(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(RecentAuthorsQuerySchema)) query: RecentAuthorsQueryDto,
  ): Promise<AuthorView[]> {
    return this.authorsService.recent({
      limit: query.limit,
      locale: query.locale,
      userId: user.id,
    });
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "Books by this author proxied live from Open Library" })
  @ApiOperation({ summary: "List an author's books from Open Library" })
  @ApiParam({ name: "id" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":id/books")
  @Throttle({ default: { limit: LOOKUP_LIMIT, ttl: seconds(LOOKUP_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  listBooks(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) authorId: string,
  ): Promise<AuthorBookSuggestionView[]> {
    return this.authorsService.listBookSuggestions(user.id, authorId);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of authors visible to the current user" })
  @ApiOperation({ summary: "Search authors (global seeds + own custom)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(AuthorSearchPaginationQuerySchema))
    query: AuthorSearchPaginationQueryDto,
  ): Promise<Paginator<AuthorView>> {
    return this.authorsService.search(user.id, query);
  }
}
