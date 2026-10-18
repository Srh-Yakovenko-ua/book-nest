import type {
  ReadingDayDetails,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCompletedReadsPage,
  ReadingStatisticsOverview,
} from "@app/shared";

import {
  isoDay,
  ReadingStatisticsIntervalQuerySchema,
  ReadingStatisticsOverviewQuerySchema,
} from "@app/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodParamPipe } from "../../../core/pipes/zod-param.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { HEAVY_READ_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ReadingDayDetailsService } from "../application/reading-day-details.service.js";
import { ReadingIntervalDetailsService } from "../application/reading-interval-details.service.js";
import { StatisticsOverviewService } from "../application/statistics-overview.service.js";
import { ReadingStatisticsIntervalQueryDto } from "./input-dto/reading-statistics-interval.query.input-dto.js";
import { ReadingStatisticsOverviewQueryDto } from "./input-dto/reading-statistics-overview.query.input-dto.js";
import { ReadingDayDetailsDto } from "./view-dto/reading-day-details.view-dto.js";
import { ReadingStatisticsActivityPageDto } from "./view-dto/reading-statistics-activity-page.view-dto.js";
import { ReadingStatisticsCompletedReadsPageDto } from "./view-dto/reading-statistics-completed-reads-page.view-dto.js";
import { ReadingStatisticsOverviewDto } from "./view-dto/reading-statistics-overview.view-dto.js";

@ApiTags("statistics")
@Controller("api/statistics")
export class StatisticsController {
  constructor(
    private readonly readingDayDetailsService: ReadingDayDetailsService,
    private readonly readingIntervalDetailsService: ReadingIntervalDetailsService,
    private readonly statisticsOverviewService: StatisticsOverviewService,
  ) {}

  @ApiBadRequestResponse({ description: "Invalid range, page size or cursor" })
  @ApiOkResponse({
    description: "Every finished reading cycle inside one chart bucket, newest first",
    type: ReadingStatisticsCompletedReadsPageDto,
  })
  @ApiOperation({ summary: "List the reading cycles finished inside a date range" })
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get("completed-reads")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getCompletedReads(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsIntervalQuerySchema))
    query: ReadingStatisticsIntervalQueryDto,
  ): Promise<ReadingStatisticsCompletedReadsPage> {
    return this.readingIntervalDetailsService.getCompletedReads({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid period or comparison combination" })
  @ApiOkResponse({
    description: "Every reading statistics section for the selected period",
    type: ReadingStatisticsOverviewDto,
  })
  @ApiOperation({ summary: "Get the reading statistics overview for a period" })
  @ApiQuery({ name: "period", required: false })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "compare", required: false })
  @Get("overview")
  @JwtProtected()
  @Throttle(HEAVY_READ_THROTTLE)
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsOverviewQuerySchema))
    query: ReadingStatisticsOverviewQueryDto,
  ): Promise<ReadingStatisticsOverview> {
    return this.statisticsOverviewService.getOverview({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid range, page size or cursor" })
  @ApiOkResponse({
    description: "The recorded page progress inside one chart bucket, per day and book",
    type: ReadingStatisticsActivityPageDto,
  })
  @ApiOperation({ summary: "List the pages read per day and book inside a date range" })
  @ApiQuery({ name: "from", required: true })
  @ApiQuery({ name: "to", required: true })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get("reading-activity")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getReadingActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsIntervalQuerySchema))
    query: ReadingStatisticsIntervalQueryDto,
  ): Promise<ReadingStatisticsActivityPage> {
    return this.readingIntervalDetailsService.getReadingActivity({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid date" })
  @ApiOkResponse({
    description: "Every book read on one calendar day",
    type: ReadingDayDetailsDto,
  })
  @ApiOperation({ summary: "Get the full reading details of one day" })
  @Get("reading-days/:date")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getReadingDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param("date", new ZodParamPipe(isoDay())) date: string,
  ): Promise<ReadingDayDetails> {
    return this.readingDayDetailsService.getDayDetails({ date, userId: user.id });
  }
}
