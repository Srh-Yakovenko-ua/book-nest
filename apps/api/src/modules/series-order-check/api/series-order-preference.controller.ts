import type { SeriesOrderPreferenceView } from "@app/shared";

import { SeriesOrderCheckPreferenceInputSchema } from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { SeriesOrderCheckService } from "../application/series-order-check.service.js";
import { SeriesOrderCheckPreferenceInputDto } from "./input-dto/series-order-check-preference.input-dto.js";
import { SeriesOrderPreferenceViewDto } from "./view-dto/series-order-preference.view-dto.js";

const PREFERENCE_ACTION_TTL_SECONDS = 60;
const PREFERENCE_ACTION_LIMIT = 60;

@ApiTags("series")
@Controller("api/series")
export class SeriesOrderPreferenceController {
  constructor(private readonly seriesOrderCheckService: SeriesOrderCheckService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: SeriesOrderCheckPreferenceInputDto })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The updated series order check preference",
    type: SeriesOrderPreferenceViewDto,
  })
  @ApiOperation({ summary: "Enable or disable the series read-order check for a series" })
  @ApiParam({ description: "The series id", name: "seriesId" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Put(":seriesId/order-check-preference")
  @Throttle({
    default: { limit: PREFERENCE_ACTION_LIMIT, ttl: seconds(PREFERENCE_ACTION_TTL_SECONDS) },
  })
  @UseGuards(JwtAccessGuard)
  setPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
    @Body(new ZodBodyPipe(SeriesOrderCheckPreferenceInputSchema))
    body: SeriesOrderCheckPreferenceInputDto,
  ): Promise<SeriesOrderPreferenceView> {
    return this.seriesOrderCheckService.setSeriesCheckPreference({
      enabled: body.enabled,
      seriesId,
      userId: user.id,
    });
  }
}
