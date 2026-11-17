import type {
  ReadingDayDetails,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarPage,
  ReadingStatisticsCompletedReadsPage,
  ReadingStatisticsCompletedReadsSubsetPage,
  ReadingStatisticsOverview,
} from "@app/shared";

import {
  isoDay,
  ReadingStatisticsCalendarPageQuerySchema,
  ReadingStatisticsCompletedReadsSubsetQuerySchema,
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
import { ReadingCalendarPageService } from "../application/reading-calendar-page.service.js";
import { ReadingDayDetailsService } from "../application/reading-day-details.service.js";
import { ReadingIntervalDetailsService } from "../application/reading-interval-details.service.js";
import { StatisticsOverviewService } from "../application/statistics-overview.service.js";
import { ReadingStatisticsCalendarPageQueryDto } from "./input-dto/reading-statistics-calendar-page.query.input-dto.js";
import { ReadingStatisticsCompletedReadsSubsetQueryDto } from "./input-dto/reading-statistics-completed-reads-subset.query.input-dto.js";
import { ReadingStatisticsIntervalQueryDto } from "./input-dto/reading-statistics-interval.query.input-dto.js";
import { ReadingStatisticsOverviewQueryDto } from "./input-dto/reading-statistics-overview.query.input-dto.js";
import { ReadingDayDetailsDto } from "./view-dto/reading-day-details.view-dto.js";
import { ReadingStatisticsActivityPageDto } from "./view-dto/reading-statistics-activity-page.view-dto.js";
import { ReadingStatisticsCalendarPageDto } from "./view-dto/reading-statistics-calendar-page.view-dto.js";
import { ReadingStatisticsCompletedReadsPageDto } from "./view-dto/reading-statistics-completed-reads-page.view-dto.js";
import { ReadingStatisticsCompletedReadsSubsetPageDto } from "./view-dto/reading-statistics-completed-reads-subset-page.view-dto.js";
import { ReadingStatisticsOverviewDto } from "./view-dto/reading-statistics-overview.view-dto.js";

@ApiTags("statistics")
@Controller("api/statistics")
export class StatisticsController {
  constructor(
    private readonly readingCalendarPageService: ReadingCalendarPageService,
    private readonly readingDayDetailsService: ReadingDayDetailsService,
    private readonly readingIntervalDetailsService: ReadingIntervalDetailsService,
    private readonly statisticsOverviewService: StatisticsOverviewService,
  ) {}

  @ApiBadRequestResponse({ description: "Invalid or future year" })
  @ApiOkResponse({
    description:
      "The reading heatmap and per-day books of one calendar year, with every year the calendar can show",
    type: ReadingStatisticsCalendarPageDto,
  })
  @ApiOperation({ summary: "Get the reading calendar of one year" })
  @ApiQuery({ name: "year", required: true })
  @Get("calendar")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getCalendarPage(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsCalendarPageQuerySchema))
    query: ReadingStatisticsCalendarPageQueryDto,
  ): Promise<ReadingStatisticsCalendarPage> {
    return this.readingCalendarPageService.getCalendarPage({ query, userId: user.id });
  }

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

  @ApiBadRequestResponse({ description: "Invalid period, filter, page size or cursor" })
  @ApiOkResponse({
    description:
      "Every finished reading cycle behind one taste ranking row, matched on its completion snapshot, newest first",
    type: ReadingStatisticsCompletedReadsSubsetPageDto,
  })
  @ApiOperation({
    summary: "List the reading cycles finished in a period that carry one historical attribute",
  })
  @ApiQuery({ name: "periodTo", required: true })
  @ApiQuery({ name: "periodFrom", required: false })
  @ApiQuery({ name: "authorId", required: false })
  @ApiQuery({ name: "genre", required: false })
  @ApiQuery({ name: "language", required: false })
  @ApiQuery({ name: "publisherId", required: false })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get("completed-reads/subset")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getCompletedReadsSubset(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(ReadingStatisticsCompletedReadsSubsetQuerySchema))
    query: ReadingStatisticsCompletedReadsSubsetQueryDto,
  ): Promise<ReadingStatisticsCompletedReadsSubsetPage> {
    return this.readingIntervalDetailsService.getCompletedReadsSubset({ query, userId: user.id });
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
