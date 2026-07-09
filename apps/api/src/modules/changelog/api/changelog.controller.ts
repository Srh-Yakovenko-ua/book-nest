import type { ChangelogListResponse } from "@app/shared";

import { ChangelogListQuerySchema } from "@app/shared";
import { Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import {
  CurrentUser,
  JwtAccessGuard,
  OptionalCurrentUser,
  OptionalJwtAccessGuard,
} from "../../auth/index.js";
import { ChangelogService } from "../application/changelog.service.js";
import { ChangelogListQueryDto } from "./input-dto/changelog-list-query.input-dto.js";
import { ChangelogListResponseDto } from "./view-dto/changelog-list-response.view-dto.js";

@ApiTags("changelog")
@Controller("api/changelog")
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Published changelog entries with the unread count for the caller",
    type: ChangelogListResponseDto,
  })
  @ApiOperation({
    summary: "List published changelog entries (public, personalized unread count when authed)",
  })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "locale", required: false })
  @Get()
  @UseGuards(OptionalJwtAccessGuard)
  list(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query(new ZodQueryPipe(ChangelogListQuerySchema)) query: ChangelogListQueryDto,
  ): Promise<ChangelogListResponse> {
    return this.changelogService.list({
      limit: query.limit,
      locale: query.locale,
      userId: user?.id ?? null,
    });
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The caller's changelog read marker was updated" })
  @ApiOperation({ summary: "Mark the changelog as seen for the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Post("seen")
  @UseGuards(JwtAccessGuard)
  markSeen(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.changelogService.markSeen({ userId: user.id });
  }
}
