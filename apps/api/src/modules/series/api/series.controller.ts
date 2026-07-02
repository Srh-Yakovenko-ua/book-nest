import type { Paginator, SeriesView } from "@app/shared";

import { SeriesSearchQuerySchema } from "@app/shared";
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
import { SeriesService } from "../application/series.service.js";
import { SeriesSearchQueryDto } from "./input-dto/series-search-query.input-dto.js";
import { PaginatedSeriesDto } from "./view-dto/paginated-series.view-dto.js";

@ApiTags("series")
@Controller("api/series")
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of the current user series", type: PaginatedSeriesDto })
  @ApiOperation({ summary: "Search the current user series" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "authorIds", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(SeriesSearchQuerySchema))
    query: SeriesSearchQueryDto,
  ): Promise<Paginator<SeriesView>> {
    return this.seriesService.search(user.id, query);
  }
}
