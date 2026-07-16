import type { Paginator, TagCatalogView, TagStatsView, TagView } from "@app/shared";

import { CreateTagSchema, TaxonomySearchPaginationQuerySchema, UpdateTagSchema } from "@app/shared";
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
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { TagsService } from "../application/tags.service.js";
import { CreateTagDto } from "./input-dto/create-tag.input-dto.js";
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";
import { UpdateTagDto } from "./input-dto/update-tag.input-dto.js";
import { TagCatalogViewDto } from "./view-dto/tag-catalog.view-dto.js";
import { TagStatsViewDto } from "./view-dto/tag-stats.view-dto.js";

const CREATE_TAG_TTL_SECONDS = 60;
const CREATE_TAG_LIMIT = 30;
const UPDATE_TAG_TTL_SECONDS = 60;
const UPDATE_TAG_LIMIT = 60;

@ApiTags("tags")
@Controller("api/tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateTagDto })
  @ApiConflictResponse({ description: "A tag with this name already exists" })
  @ApiCreatedResponse({ description: "The created tag", type: TagCatalogViewDto })
  @ApiOperation({ summary: "Create a personal tag for the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post()
  @Throttle({ default: { limit: CREATE_TAG_LIMIT, ttl: seconds(CREATE_TAG_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateTagSchema)) body: CreateTagDto,
  ): Promise<TagCatalogView> {
    return this.tagsService.create(user.id, body);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of the current user own tags" })
  @ApiOperation({ summary: "Search the current user personal tags" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TaxonomySearchPaginationQuerySchema))
    query: TaxonomySearchPaginationQueryDto,
  ): Promise<Paginator<TagView>> {
    return this.tagsService.search(user.id, query);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Per-tag usage statistics for the current user",
    type: [TagStatsViewDto],
  })
  @ApiOperation({ summary: "Get per-tag usage statistics for the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("stats")
  @UseGuards(JwtAccessGuard)
  stats(@CurrentUser() user: AuthenticatedUser): Promise<TagStatsView[]> {
    return this.tagsService.stats(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateTagDto })
  @ApiConflictResponse({ description: "A tag with this name already exists" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiOkResponse({ description: "The updated tag", type: TagCatalogViewDto })
  @ApiOperation({ summary: "Update a tag of the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Patch(":id")
  @Throttle({ default: { limit: UPDATE_TAG_LIMIT, ttl: seconds(UPDATE_TAG_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateTagSchema)) body: UpdateTagDto,
  ): Promise<TagCatalogView> {
    return this.tagsService.update(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The tag was deleted" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiOperation({ summary: "Delete a tag of the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tagsService.delete(user.id, id);
  }
}
