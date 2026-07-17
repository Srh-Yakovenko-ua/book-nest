import type { CharacterSummaryView, Paginator } from "@app/shared";

import { SeriesCharactersQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { SeriesCharactersQueryDto } from "./input-dto/series-characters-query.input-dto.js";
import { PaginatedCharactersDto } from "./view-dto/paginated-characters.view-dto.js";

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/series/:seriesId/characters")
@UseGuards(JwtAccessGuard)
export class SeriesCharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Series or context book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe aggregate of distinct characters across the series' books",
    type: PaginatedCharactersDto,
  })
  @ApiOperation({ summary: "List distinct characters across a series' books" })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "includeFuture", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Query(new ZodQueryPipe(SeriesCharactersQuerySchema)) query: SeriesCharactersQueryDto,
  ): Promise<Paginator<CharacterSummaryView>> {
    return this.charactersService.listSeriesCharacters({ query, seriesId, userId: user.id });
  }
}
