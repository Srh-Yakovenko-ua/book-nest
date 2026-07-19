import type { SeriesReadingContextDefaultView } from "@app/shared";

import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { SeriesReadingContextDefaultViewDto } from "./view-dto/series-reading-context-default.view-dto.js";

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/series/:seriesId/reading-context")
@UseGuards(JwtAccessGuard)
export class SeriesReadingContextController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The default reading context for the series and how it was resolved",
    type: SeriesReadingContextDefaultViewDto,
  })
  @ApiOperation({ summary: "Resolve the default reading context for a series" })
  @ApiParam({ description: "Series id", name: "seriesId" })
  @Get("default")
  getDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
  ): Promise<SeriesReadingContextDefaultView> {
    return this.charactersService.getDefaultSeriesReadingContext({ seriesId, userId: user.id });
  }
}
