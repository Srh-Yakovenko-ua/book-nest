import type { SeriesCharacterSummaryView } from "@app/shared";

import { SeriesCharacterSummaryQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
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
import { CharactersService } from "../application/characters.service.js";
import { SeriesCharacterSummaryQueryDto } from "./input-dto/series-character-summary-query.input-dto.js";
import { SeriesCharacterSummaryViewDto } from "./view-dto/series-character-summary.view-dto.js";

@ApiTags("characters")
@Controller("api/series/:seriesId/character-summary")
@JwtProtected()
export class SeriesCharacterSummaryController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Series or context book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe recap of the series' cast up to the reading context",
    type: SeriesCharacterSummaryViewDto,
  })
  @ApiOperation({
    summary: "Get a spoiler-safe recap of a series' characters up to a context book",
  })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Query(new ZodQueryPipe(SeriesCharacterSummaryQuerySchema))
    query: SeriesCharacterSummaryQueryDto,
  ): Promise<SeriesCharacterSummaryView> {
    return this.charactersService.seriesCharacterSummary({ query, seriesId, userId: user.id });
  }
}
