import type { Paginator, QuotesSummaryView, QuoteView } from "@app/shared";

import { QuotesQuerySchema } from "@app/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { QuotesService } from "../application/quotes.service.js";
import { QuotesQueryDto } from "./input-dto/quotes-query.input-dto.js";
import { PaginatedQuotesDto } from "./view-dto/paginated-quotes.view-dto.js";
import { QuotesSummaryViewDto } from "./view-dto/quotes-summary.view-dto.js";

const QUOTE_READ_TTL_SECONDS = 60;
const QUOTE_READ_LIMIT = 120;

@ApiBearerAuth()
@ApiTags("quotes")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/quotes")
@Throttle({ default: { limit: QUOTE_READ_LIMIT, ttl: seconds(QUOTE_READ_TTL_SECONDS) } })
@UseGuards(JwtAccessGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @ApiOkResponse({
    description: "Aggregate statistics over the current user's quotes",
    type: QuotesSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary statistics for the current user's quotes" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<QuotesSummaryView> {
    return this.quotesService.summary({ userId: user.id });
  }

  @ApiOkResponse({ description: "A page of the current user's quotes", type: PaginatedQuotesDto })
  @ApiOperation({ summary: "List all quotes across the current user's books" })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(QuotesQuerySchema)) query: QuotesQueryDto,
  ): Promise<Paginator<QuoteView>> {
    return this.quotesService.list({ query, userId: user.id });
  }
}
