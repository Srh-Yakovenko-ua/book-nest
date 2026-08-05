import type { PaginatedTrash, TrashSummaryView } from "@app/shared";

import { TrashQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { TrashService } from "../application/trash.service.js";
import { TrashQueryDto } from "./input-dto/trash-query.input-dto.js";
import { PaginatedTrashDto } from "./view-dto/paginated-trash.view-dto.js";
import { TrashSummaryViewDto } from "./view-dto/trash-summary.view-dto.js";

@ApiTags("trash")
@Controller("api/trash")
@JwtProtected()
@Throttle(READ_THROTTLE)
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @ApiOkResponse({
    description: "How much is waiting in the trash, per entity type",
    type: TrashSummaryViewDto,
  })
  @ApiOperation({ summary: "Get the current user trash summary" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<TrashSummaryView> {
    return this.trashService.summary({ userId: user.id });
  }

  @ApiOkResponse({
    description: "A page of everything the current user has in the trash, newest first",
    type: PaginatedTrashDto,
  })
  @ApiOperation({ summary: "List everything waiting in the trash across entity types" })
  @ApiQuery({ name: "entityType", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashQuerySchema)) query: TrashQueryDto,
  ): Promise<PaginatedTrash> {
    return this.trashService.list({ query, userId: user.id });
  }
}
