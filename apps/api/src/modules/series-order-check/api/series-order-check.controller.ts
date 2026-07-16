import type { SeriesOrderIssuesView } from "@app/shared";

import { SeriesOrderIssuesQuerySchema } from "@app/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { SeriesOrderCheckService } from "../application/series-order-check.service.js";
import { SeriesOrderIssuesQueryDto } from "./input-dto/series-order-issues-query.input-dto.js";
import { SeriesOrderIssuesViewDto } from "./view-dto/series-order-issues.view-dto.js";

@ApiTags("reading-queue")
@Controller("api/reading-queue")
export class SeriesOrderCheckController {
  constructor(private readonly seriesOrderCheckService: SeriesOrderCheckService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Series order issues detected in the current user reading queue",
    type: SeriesOrderIssuesViewDto,
  })
  @ApiOperation({ summary: "Detect series read-order issues for the current user reading queue" })
  @ApiQuery({ name: "limit", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("series-order-issues")
  @UseGuards(JwtAccessGuard)
  listIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SeriesOrderIssuesQuerySchema)) query: SeriesOrderIssuesQueryDto,
  ): Promise<SeriesOrderIssuesView> {
    return this.seriesOrderCheckService.listIssues({ limit: query.limit, userId: user.id });
  }
}
