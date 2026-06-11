import type { AuthorLookupResult, AuthorView, Paginator } from "@app/shared";

import { AuthorLookupQuerySchema, TaxonomySearchPaginationQuerySchema } from "@app/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
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
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";

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
  @ApiOkResponse({ description: "A page of authors visible to the current user" })
  @ApiOperation({ summary: "Search authors (global seeds + own custom)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ enum: ["asc", "desc"], name: "sortDirection", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(TaxonomySearchPaginationQuerySchema))
    query: TaxonomySearchPaginationQueryDto,
  ): Promise<Paginator<AuthorView>> {
    return this.authorsService.search(user.id, query);
  }
}
