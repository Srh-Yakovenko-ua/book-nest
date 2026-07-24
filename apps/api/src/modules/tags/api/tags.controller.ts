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
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { TagsService } from "../application/tags.service.js";
import { CreateTagDto } from "./input-dto/create-tag.input-dto.js";
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";
import { UpdateTagDto } from "./input-dto/update-tag.input-dto.js";
import { TagCatalogViewDto } from "./view-dto/tag-catalog.view-dto.js";
import { TagStatsViewDto } from "./view-dto/tag-stats.view-dto.js";

const CREATE_TAG_TTL_SECONDS = 60;
const CREATE_TAG_LIMIT = 30;
@ApiTags("tags")
@Controller("api/tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

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
  @ApiOkResponse({
    description: "Per-tag usage statistics for the current user",
    type: [TagStatsViewDto],
  })
  @ApiOperation({ summary: "Get per-tag usage statistics for the current user" })
  @Get("stats")
  @JwtProtected()
  stats(@CurrentUser() user: AuthenticatedUser): Promise<TagStatsView[]> {
    return this.tagsService.stats(user.id);
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
