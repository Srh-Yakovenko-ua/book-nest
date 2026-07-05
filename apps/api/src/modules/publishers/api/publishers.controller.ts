import type { Paginator, PublisherView } from "@app/shared";

import {
  CatalogLocaleSchema,
  PublisherSearchPaginationQuerySchema,
  RecentPublishersQuerySchema,
} from "@app/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { PublishersService } from "../application/publishers.service.js";
import { PublisherSearchPaginationQueryDto } from "./input-dto/publisher-search-query.input-dto.js";
import { RecentPublishersQueryDto } from "./input-dto/recent-publishers-query.input-dto.js";

@ApiTags("publishers")
@Controller("api/publishers")
export class PublishersController {
  constructor(private readonly publishersService: PublishersService) {}

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
}
