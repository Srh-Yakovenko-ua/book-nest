import type { CharacterGraphView } from "@app/shared";

import { SeriesCharacterGraphQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
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
import { CharacterGraphService } from "../application/character-graph.service.js";
import { SeriesCharacterGraphQueryDto } from "./input-dto/series-character-graph-query.input-dto.js";
import { CharacterGraphViewDto } from "./view-dto/character-graph.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/series/:seriesId/character-graph")
@JwtProtected()
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
  @ApiQuery({ enum: ["group", "importance"], name: "clusterBy", required: false })
  @ApiQuery({
    description: "Reader chapter within the context book for page-level spoiler masking",
    name: "contextChapter",
    required: false,
  })
  @ApiQuery({
    description: "Reader page within the context book for page-level spoiler masking",
    name: "contextPage",
    required: false,
  })
  @ApiQuery({
    description: "Reader audiobook seconds within the context book for page-level spoiler masking",
    name: "contextAudioSeconds",
    required: false,
  })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Query(new ZodQueryPipe(SeriesCharacterGraphQuerySchema)) query: SeriesCharacterGraphQueryDto,
  ): Promise<CharacterGraphView> {
    return this.graphService.getForSeries({ query, seriesId, userId: user.id });
  }
}
