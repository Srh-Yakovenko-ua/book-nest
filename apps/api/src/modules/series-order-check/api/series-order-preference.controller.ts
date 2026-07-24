import type { SeriesOrderPreferenceView } from "@app/shared";

import { SeriesOrderCheckPreferenceInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { SeriesOrderCheckService } from "../application/series-order-check.service.js";
import { SeriesOrderCheckPreferenceInputDto } from "./input-dto/series-order-check-preference.input-dto.js";
import { SeriesOrderPreferenceViewDto } from "./view-dto/series-order-preference.view-dto.js";

@ApiTags("series")
@Controller("api/series")
export class SeriesOrderPreferenceController {
  constructor(private readonly seriesOrderCheckService: SeriesOrderCheckService) {}

  @ApiBadRequestResponse({ description: "Invalid series id" })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The current series order check preference",
    type: SeriesOrderPreferenceViewDto,
  })
  @ApiOperation({ summary: "Read the series read-order check preference for a series" })
  @ApiParam({ description: "The series id", name: "seriesId" })
  @Get(":seriesId/order-check-preference")
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  getPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param("seriesId", ParseUUIDPipe) seriesId: string,
  ): Promise<SeriesOrderPreferenceView> {
    return this.seriesOrderCheckService.getSeriesCheckPreference({
      seriesId,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SeriesOrderCheckPreferenceInputDto })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The updated series order check preference",
    type: SeriesOrderPreferenceViewDto,
  })
  @ApiOperation({ summary: "Enable or disable the series read-order check for a series" })
  @ApiParam({ description: "The series id", name: "seriesId" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Put(":seriesId/order-check-preference")
  @Throttle(MUTATION_THROTTLE)
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
