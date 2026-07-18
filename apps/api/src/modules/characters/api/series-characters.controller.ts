import type { CharacterSeriesProfileView, CharacterSummaryView, Paginator } from "@app/shared";

import { SeriesCharacterProfileQuerySchema, SeriesCharactersQuerySchema } from "@app/shared";
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
import { SeriesCharacterProfileQueryDto } from "./input-dto/series-character-profile-query.input-dto.js";
import { SeriesCharactersQueryDto } from "./input-dto/series-characters-query.input-dto.js";
import { CharacterSeriesProfileViewDto } from "./view-dto/character-series-profile.view-dto.js";
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

  @ApiNotFoundResponse({ description: "Series, context book, or character not found" })
  @ApiOkResponse({
    description:
      "A spoiler-safe series-scoped character profile with a context-masked appearance timeline",
    type: CharacterSeriesProfileViewDto,
  })
  @ApiOperation({ summary: "Get a series-scoped character profile masked to a reading context" })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "includeFuture", required: false })
  @Get(":characterId")
  profile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query(new ZodQueryPipe(SeriesCharacterProfileQuerySchema))
    query: SeriesCharacterProfileQueryDto,
  ): Promise<CharacterSeriesProfileView> {
    return this.charactersService.getSeriesCharacterProfile({
      characterId,
      query,
      seriesId,
      userId: user.id,
    });
  }
}
