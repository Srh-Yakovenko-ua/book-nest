import type {
  CustomListDetail,
  ListFacetsView,
  ListOverviewView,
  ListRelatedView,
} from "@app/shared";

import { CustomListBooksQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ListDetailsService } from "../application/list-details.service.js";
import { ListFacetsService } from "../application/list-facets.service.js";
import { ListOverviewService } from "../application/list-overview.service.js";
import { CustomListBooksQueryDto } from "./input-dto/custom-list-books-query.input-dto.js";
import { CustomListDetailDto } from "./view-dto/custom-list-detail.view-dto.js";
import { ListFacetsViewDto } from "./view-dto/list-facets.view-dto.js";
import { ListOverviewViewDto } from "./view-dto/list-overview.view-dto.js";
import { ListRelatedViewDto } from "./view-dto/list-related.view-dto.js";

@ApiTags("lists")
@Controller("api/lists")
export class ListDetailsController {
  constructor(
    private readonly listDetailsService: ListDetailsService,
    private readonly listFacetsService: ListFacetsService,
    private readonly listOverviewService: ListOverviewService,
  ) {}

  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "Author and genre facets of the whole list",
    type: ListFacetsViewDto,
  })
  @ApiOperation({ summary: "Get the filter facets of a book list of the current user" })
  @ApiParam({ name: "listId", required: true })
  @Get(":listId/facets")
  @JwtProtected()
  facets(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<ListFacetsView> {
    return this.listFacetsService.facets({ listId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "Aggregate statistics of the whole list",
    type: ListOverviewViewDto,
  })
  @ApiOperation({ summary: "Get the aggregate overview of a book list of the current user" })
  @ApiParam({ name: "listId", required: true })
  @Get(":listId/overview")
  @JwtProtected()
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<ListOverviewView> {
    return this.listOverviewService.overview({ listId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "Other lists of the user that share books with this one",
    type: ListRelatedViewDto,
  })
  @ApiOperation({ summary: "Get the lists that share books with a book list of the current user" })
  @ApiParam({ name: "listId", required: true })
  @Get(":listId/related")
  @JwtProtected()
  related(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<ListRelatedView> {
    return this.listOverviewService.related({ listId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "The list with a page of its books", type: CustomListDetailDto })
  @ApiOperation({ summary: "Get a book list of the current user with a page of its books" })
  @ApiParam({ name: "listId", required: true })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "tab", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "owner", required: false })
  @ApiQuery({ name: "format", required: false })
  @ApiQuery({ name: "genre", required: false })
  @ApiQuery({ name: "author", required: false })
  @ApiQuery({ name: "bookType", required: false })
  @ApiQuery({ name: "isFavorite", required: false })
  @ApiQuery({ name: "inQueue", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get(":listId")
  @JwtProtected()
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Query(new ZodQueryPipe(CustomListBooksQuerySchema)) query: CustomListBooksQueryDto,
  ): Promise<CustomListDetail> {
    return this.listDetailsService.detail({ listId, query, userId: user.id });
  }
}
