import type { Paginator, TagView } from "@app/shared";

import { TaxonomySearchPaginationQuerySchema } from "@app/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { UserModel } from "../../../generated/prisma/models.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { TagsService } from "../application/tags.service.js";
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";

@ApiTags("tags")
@Controller("api/tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

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
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(TaxonomySearchPaginationQuerySchema))
    query: TaxonomySearchPaginationQueryDto,
  ): Promise<Paginator<TagView>> {
    return this.tagsService.search(user.id, query);
  }
}
