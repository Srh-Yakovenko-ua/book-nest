import type {
  ApplySeriesOrderFixResponse,
  SeriesOrderFixPreviewView,
  SeriesOrderIssuesView,
} from "@app/shared";

import { SeriesOrderFixInputSchema, SeriesOrderIssuesQuerySchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { SeriesOrderCheckService } from "../application/series-order-check.service.js";
import { SeriesOrderFixInputDto } from "./input-dto/series-order-fix.input-dto.js";
import { SeriesOrderIssuesQueryDto } from "./input-dto/series-order-issues-query.input-dto.js";
import { ApplySeriesOrderFixResponseDto } from "./view-dto/apply-series-order-fix-response.view-dto.js";
import { SeriesOrderFixPreviewViewDto } from "./view-dto/series-order-fix-preview.view-dto.js";
import { SeriesOrderIssuesViewDto } from "./view-dto/series-order-issues.view-dto.js";

const FIX_ACTION_TTL_SECONDS = 60;
const FIX_ACTION_LIMIT = 60;

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

  @ApiBearerAuth()
  @ApiBody({ type: SeriesOrderFixInputDto })
  @ApiConflictResponse({ description: "The issue is no longer present for the given fingerprint" })
  @ApiOkResponse({
    description: "The projected queue before and after applying the fix strategy",
    type: SeriesOrderFixPreviewViewDto,
  })
  @ApiOperation({ summary: "Preview a series order fix strategy without mutating the queue" })
  @ApiParam({ description: "The detected issue fingerprint", name: "fingerprint" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({ description: "The strategy is not allowed for this issue" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("series-order-issues/:fingerprint/preview")
  @Throttle({ default: { limit: FIX_ACTION_LIMIT, ttl: seconds(FIX_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  previewFix(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fingerprint") fingerprint: string,
    @Body(new ZodBodyPipe(SeriesOrderFixInputSchema)) body: SeriesOrderFixInputDto,
  ): Promise<SeriesOrderFixPreviewView> {
    return this.seriesOrderCheckService.previewFix({ fingerprint, input: body, userId: user.id });
  }

  @ApiBearerAuth()
  @ApiBody({ type: SeriesOrderFixInputDto })
  @ApiConflictResponse({
    description: "The issue is stale or the reading queue changed since the preview",
  })
  @ApiOkResponse({
    description: "The reading queue after the fix strategy was applied atomically",
    type: ApplySeriesOrderFixResponseDto,
  })
  @ApiOperation({ summary: "Apply a series order fix strategy atomically to the reading queue" })
  @ApiParam({ description: "The detected issue fingerprint", name: "fingerprint" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @ApiUnprocessableEntityResponse({
    description: "The strategy is not allowed or the queue limit would be exceeded",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post("series-order-issues/:fingerprint/apply")
  @Throttle({ default: { limit: FIX_ACTION_LIMIT, ttl: seconds(FIX_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  applyFix(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fingerprint") fingerprint: string,
    @Body(new ZodBodyPipe(SeriesOrderFixInputSchema)) body: SeriesOrderFixInputDto,
  ): Promise<ApplySeriesOrderFixResponse> {
    return this.seriesOrderCheckService.applyFix({ fingerprint, input: body, userId: user.id });
  }

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "The issue is no longer present for the given fingerprint" })
  @ApiOkResponse({
    description: "The remaining series order issues after ignoring this one",
    type: SeriesOrderIssuesViewDto,
  })
  @ApiOperation({ summary: "Ignore a detected series order issue for the current user" })
  @ApiParam({ description: "The detected issue fingerprint", name: "fingerprint" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("series-order-issues/:fingerprint/ignore")
  @Throttle({ default: { limit: FIX_ACTION_LIMIT, ttl: seconds(FIX_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  ignoreIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fingerprint") fingerprint: string,
  ): Promise<SeriesOrderIssuesView> {
    return this.seriesOrderCheckService.ignoreIssue({ fingerprint, userId: user.id });
  }
}
