import type { CharacterGraphView } from "@app/shared";

import { SeriesCharacterGraphQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
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
import { CharacterGraphService } from "../application/character-graph.service.js";
import { SeriesCharacterGraphQueryDto } from "./input-dto/series-character-graph-query.input-dto.js";
import { CharacterGraphViewDto } from "./view-dto/character-graph.view-dto.js";

@ApiBearerAuth()
@ApiTags("character-relationships")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/series/:seriesId/character-graph")
@UseGuards(JwtAccessGuard)
export class SeriesCharacterGraphController {
  constructor(private readonly graphService: CharacterGraphService) {}

  @ApiBadRequestResponse({ description: "The context book does not belong to this series" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "A spoiler-safe relationship graph as of the context book",
    type: CharacterGraphViewDto,
  })
  @ApiOperation({ summary: "Build a spoiler-safe character relationship graph for a series" })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @ApiQuery({ name: "mode", required: false })
  @ApiQuery({ name: "focusCharacterId", required: false })
  @ApiQuery({ name: "depth", required: false })
  @ApiQuery({ name: "categories", required: false })
  @ApiQuery({ name: "relationshipTypes", required: false })
  @ApiQuery({ name: "revealEdgeIds", required: false })
  @ApiQuery({ name: "contextBookId", required: false })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Query(new ZodQueryPipe(SeriesCharacterGraphQuerySchema)) query: SeriesCharacterGraphQueryDto,
  ): Promise<CharacterGraphView> {
    return this.graphService.getForSeries({ query, seriesId, userId: user.id });
  }
}
