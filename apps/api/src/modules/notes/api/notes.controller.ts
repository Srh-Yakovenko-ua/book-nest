import type { NotesSummaryView, NoteView, Paginator } from "@app/shared";

import { NotesQuerySchema } from "@app/shared";
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
import { NotesService } from "../application/notes.service.js";
import { NotesQueryDto } from "./input-dto/notes-query.input-dto.js";
import { NotesSummaryViewDto } from "./view-dto/notes-summary.view-dto.js";
import { PaginatedNotesDto } from "./view-dto/paginated-notes.view-dto.js";

@ApiBearerAuth()
@ApiTags("notes")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/notes")
@UseGuards(JwtAccessGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @ApiOkResponse({
    description: "Counts of the current user's notes for the archive sidebar",
    type: NotesSummaryViewDto,
  })
  @ApiOperation({ summary: "Get summary counts for the current user's notes" })
  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<NotesSummaryView> {
    return this.notesService.summary(user.id);
  }

  @ApiOkResponse({ description: "A page of the current user's notes", type: PaginatedNotesDto })
  @ApiOperation({ summary: "List and search the current user's notes archive" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "filter", required: false })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "seriesId", required: false })
  @ApiQuery({ name: "hasPage", required: false })
  @ApiQuery({ name: "hasChapter", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(NotesQuerySchema)) query: NotesQueryDto,
  ): Promise<Paginator<NoteView>> {
    return this.notesService.listGlobal(user.id, query);
  }
}
