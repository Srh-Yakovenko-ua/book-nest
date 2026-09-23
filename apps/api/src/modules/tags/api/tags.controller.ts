import type {
  PaginatedTagCatalog,
  Paginator,
  TagCatalogView,
  TagDeletionPreviewView,
  TagsCatalogFacetsView,
  TagsSummaryView,
  TagView,
} from "@app/shared";

import {
  CreateTagSchema,
  TAG_COLORS,
  TagQuickFilterSchema,
  TagsCatalogFacetsQuerySchema,
  TagsCatalogQuerySchema,
  TagSortSchema,
  TagTypeSchema,
  TaxonomySearchPaginationQuerySchema,
  UpdateTagSchema,
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
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { TagsCatalogService } from "../application/tags-catalog.service.js";
import { TagsService } from "../application/tags.service.js";
import { CreateTagDto } from "./input-dto/create-tag.input-dto.js";
import { TagsCatalogFacetsQueryDto } from "./input-dto/tags-catalog-facets-query.input-dto.js";
import { TagsCatalogQueryDto } from "./input-dto/tags-catalog-query.input-dto.js";
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";
import { UpdateTagDto } from "./input-dto/update-tag.input-dto.js";
import { PaginatedTagCatalogDto } from "./view-dto/paginated-tag-catalog.view-dto.js";
import { TagCatalogViewDto } from "./view-dto/tag-catalog.view-dto.js";
import { TagDeletionPreviewViewDto } from "./view-dto/tag-deletion-preview.view-dto.js";
import { TagsCatalogFacetsViewDto } from "./view-dto/tags-catalog-facets.view-dto.js";
import { TagsSummaryViewDto } from "./view-dto/tags-summary.view-dto.js";

const CREATE_TAG_TTL_SECONDS = 60;
const CREATE_TAG_LIMIT = 30;
@ApiTags("tags")
@Controller("api/tags")
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly tagsCatalogService: TagsCatalogService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateTagDto })
  @ApiConflictResponse({ description: "A tag with this name already exists" })
  @ApiCreatedResponse({ description: "The created tag", type: TagCatalogViewDto })
  @ApiOperation({ summary: "Create a personal tag for the current user" })
  @HttpCode(HTTP_STATUS.CREATED)
  @JwtProtected()
  @Post()
  @Throttle({ default: { limit: CREATE_TAG_LIMIT, ttl: seconds(CREATE_TAG_TTL_SECONDS) } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateTagSchema)) body: CreateTagDto,
  ): Promise<TagCatalogView> {
    return this.tagsService.create(user.id, body);
  }
  @ApiOkResponse({ description: "A page of the current user own tags" })
  @ApiOperation({ summary: "Search the current user personal tags" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @JwtProtected()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TaxonomySearchPaginationQuerySchema))
    query: TaxonomySearchPaginationQueryDto,
  ): Promise<Paginator<TagView>> {
    return this.tagsService.search(user.id, query);
  }
  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description: "A page of the current user's tags with Book and Character usage counts",
    type: PaginatedTagCatalogDto,
  })
  @ApiOperation({
    summary:
      "List the current user's tags for management with search, a quick filter, type and color filters, sort and pagination",
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ enum: TagQuickFilterSchema.options, name: "filter", required: false })
  @ApiQuery({ enum: TagTypeSchema.options, isArray: true, name: "type", required: false })
  @ApiQuery({ enum: TAG_COLORS, isArray: true, name: "color", required: false })
  @ApiQuery({ enum: TagSortSchema.options, name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get("catalog")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  catalog(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TagsCatalogQuerySchema)) query: TagsCatalogQueryDto,
  ): Promise<PaginatedTagCatalog> {
    return this.tagsCatalogService.list({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description: "Quick-filter counts of the Tags catalog",
    type: TagsCatalogFacetsViewDto,
  })
  @ApiOperation({
    summary:
      "Get the Tags catalog quick-filter counts; they honour search, type and color but ignore the quick filter, sort and pagination",
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ enum: TagTypeSchema.options, isArray: true, name: "type", required: false })
  @ApiQuery({ enum: TAG_COLORS, isArray: true, name: "color", required: false })
  @Get("catalog/facets")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  catalogFacets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TagsCatalogFacetsQuerySchema)) query: TagsCatalogFacetsQueryDto,
  ): Promise<TagsCatalogFacetsView> {
    return this.tagsCatalogService.facets({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Snapshot summary of the current user's tags",
    type: TagsSummaryViewDto,
  })
  @ApiOperation({
    summary: "Get the Tags summary, independent of search, filters, sort and pagination",
  })
  @Get("summary")
  @JwtProtected()
  @Throttle(HEAVY_READ_THROTTLE)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<TagsSummaryView> {
    return this.tagsCatalogService.summary({ userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiOkResponse({
    description: "How many Book and Character links deleting the tag would remove",
    type: TagDeletionPreviewViewDto,
  })
  @ApiOperation({ summary: "Preview the links removed by deleting a tag of the current user" })
  @Get(":id/deletion-preview")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  deletionPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TagDeletionPreviewView> {
    return this.tagsService.deletionPreview({ tagId: id, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateTagDto })
  @ApiConflictResponse({ description: "A tag with this name already exists" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiOkResponse({ description: "The updated tag", type: TagCatalogViewDto })
  @ApiOperation({ summary: "Update a tag of the current user" })
  @JwtProtected()
  @Patch(":id")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateTagSchema)) body: UpdateTagDto,
  ): Promise<TagCatalogView> {
    return this.tagsService.update(user.id, id, body);
  }
  @ApiNoContentResponse({ description: "The tag was deleted" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiOperation({ summary: "Delete a tag of the current user" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tagsService.delete(user.id, id);
  }
}
