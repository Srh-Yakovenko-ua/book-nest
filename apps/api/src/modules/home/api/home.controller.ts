import type {
  HomeActiveBooksPage,
  HomeAttentionView,
  HomeNextReadView,
  HomeReadingView,
} from "@app/shared";

import { HomeActiveBooksQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { HomeActiveBooksService } from "../application/home-active-books.service.js";
import { HomeAttentionService } from "../application/home-attention.service.js";
import { HomeNextReadService } from "../application/home-next-read.service.js";
import { HomeReadingService } from "../application/home-reading.service.js";
import { HomeActiveBooksQueryDto } from "./input-dto/home-active-books.query.input-dto.js";
import { HomeActiveBooksPageDto } from "./view-dto/home-active-books-page.view-dto.js";
import { HomeAttentionViewDto } from "./view-dto/home-attention.view-dto.js";
import { HomeNextReadViewDto } from "./view-dto/home-next-read.view-dto.js";
import { HomeReadingViewDto } from "./view-dto/home-reading.view-dto.js";

@ApiTags("home")
@Controller("api/home")
export class HomeController {
  constructor(
    private readonly homeActiveBooksService: HomeActiveBooksService,
    private readonly homeAttentionService: HomeAttentionService,
    private readonly homeNextReadService: HomeNextReadService,
    private readonly homeReadingService: HomeReadingService,
  ) {}

  @ApiOkResponse({
    description:
      "Currently reading books, the current calendar week and the primary goal, each section available or unavailable on its own",
    type: HomeReadingViewDto,
  })
  @ApiOperation({ summary: "Get the reading row of the home dashboard" })
  @Get("reading")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getReading(@CurrentUser() user: AuthenticatedUser): Promise<HomeReadingView> {
    return this.homeReadingService.getReading(user.id);
  }

  @ApiOkResponse({
    description:
      "The next page of books in reading or rereading. A malformed cursor returns the first page",
    type: HomeActiveBooksPageDto,
  })
  @ApiOperation({ summary: "List the next page of currently reading books" })
  @ApiQuery({ name: "cursor", required: false })
  @Get("reading/books")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getActiveBooks(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(HomeActiveBooksQuerySchema)) query: HomeActiveBooksQueryDto,
  ): Promise<HomeActiveBooksPage> {
    return this.homeActiveBooksService.loadPage({ cursor: query.cursor, userId: user.id });
  }

  @ApiOkResponse({
    description:
      "Up to ten next-read candidates from the queue, favorite series and the library, with the sources that failed",
    type: HomeNextReadViewDto,
  })
  @ApiOperation({ summary: "Get next-read recommendations for the home dashboard" })
  @Get("next-read")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getNextRead(@CurrentUser() user: AuthenticatedUser): Promise<HomeNextReadView> {
    return this.homeNextReadService.getNextRead(user.id);
  }

  @ApiOkResponse({
    description: "Grouped actionable signals with the sources that failed",
    type: HomeAttentionViewDto,
  })
  @ApiOperation({ summary: "Get the attention signals of the home dashboard" })
  @Get("attention")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  getAttention(@CurrentUser() user: AuthenticatedUser): Promise<HomeAttentionView> {
    return this.homeAttentionService.getAttention(user.id);
  }
}
