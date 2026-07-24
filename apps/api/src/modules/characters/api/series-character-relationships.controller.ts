import type { CharacterRelationshipContextView } from "@app/shared";

import { SeriesCharacterRelationshipsQuerySchema } from "@app/shared";
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
import { CharacterRelationshipsService } from "../application/character-relationships.service.js";
import { SeriesCharacterRelationshipsQueryDto } from "./input-dto/series-character-relationships-query.input-dto.js";
import { CharacterRelationshipContextViewDto } from "./view-dto/character-relationship-context.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/series/:seriesId/character-relationships")
@JwtProtected()
export class SeriesCharacterRelationshipsController {
  constructor(private readonly relationshipsService: CharacterRelationshipsService) {}

  @ApiBadRequestResponse({ description: "The context book does not belong to this series" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "Spoiler-safe relationships with their effective state as of the context book",
    isArray: true,
    type: CharacterRelationshipContextViewDto,
  })
  @ApiOperation({ summary: "List spoiler-safe relationships effective as of a context book" })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "includeHistory", required: false })
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
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Query(new ZodQueryPipe(SeriesCharacterRelationshipsQuerySchema))
    query: SeriesCharacterRelationshipsQueryDto,
  ): Promise<CharacterRelationshipContextView[]> {
    return this.relationshipsService.listForSeries({ query, seriesId, userId: user.id });
  }
}
