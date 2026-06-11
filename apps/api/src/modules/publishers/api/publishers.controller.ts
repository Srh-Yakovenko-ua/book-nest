import type { Paginator, PublisherView } from "@app/shared";

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
import { PublishersService } from "../application/publishers.service.js";
import { TaxonomySearchPaginationQueryDto } from "./input-dto/taxonomy-search-query.input-dto.js";

@ApiTags("publishers")
@Controller("api/publishers")
export class PublishersController {
  constructor(private readonly publishersService: PublishersService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of publishers visible to the current user" })
  @ApiOperation({ summary: "Search publishers (global seeds + own custom)" })
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
  ): Promise<Paginator<PublisherView>> {
    return this.publishersService.search(user.id, query);
  }
}
