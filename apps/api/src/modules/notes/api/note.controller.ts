import type { EntityNotesView, NoteView } from "@app/shared";

import { CreateNoteInputSchema, UpdateNoteInputSchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { NotesService } from "../application/notes.service.js";
import { CreateNoteInputDto } from "./input-dto/create-note.input-dto.js";
import { UpdateNoteInputDto } from "./input-dto/update-note.input-dto.js";
import { EntityNotesViewDto } from "./view-dto/entity-notes.view-dto.js";
import { NoteViewDto } from "./view-dto/note.view-dto.js";

const NOTE_ACTION_TTL_SECONDS = 60;
const NOTE_ACTION_LIMIT = 60;

@ApiBearerAuth()
@ApiTags("notes")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller()
@UseGuards(JwtAccessGuard)
export class NoteController {
  constructor(private readonly notesService: NotesService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The book's notes ordered pinned, then page, then newest",
    type: EntityNotesViewDto,
  })
  @ApiOperation({ summary: "List the current user's notes for a book" })
  @ApiParam({ description: "Book id", name: "id" })
  @Get("api/books/:id/notes")
  listBookNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EntityNotesView> {
    return this.notesService.listBookNotes(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateNoteInputDto })
  @ApiCreatedResponse({ description: "The created note", type: NoteViewDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Create a note for a book" })
  @ApiParam({ description: "Book id", name: "id" })
  @Post("api/books/:id/notes")
  @Throttle({ default: { limit: NOTE_ACTION_LIMIT, ttl: seconds(NOTE_ACTION_TTL_SECONDS) } })
  createBookNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateNoteInputSchema)) body: CreateNoteInputDto,
  ): Promise<NoteView> {
    return this.notesService.createBookNote(user.id, id, body);
  }

  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOkResponse({
    description: "The series' notes ordered pinned, then recently updated, then newest",
    type: EntityNotesViewDto,
  })
  @ApiOperation({ summary: "List the current user's notes for a series" })
  @ApiParam({ description: "Series id", name: "id" })
  @Get("api/series/:id/notes")
  listSeriesNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EntityNotesView> {
    return this.notesService.listSeriesNotes(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateNoteInputDto })
  @ApiCreatedResponse({ description: "The created note", type: NoteViewDto })
  @ApiNotFoundResponse({ description: "Series not found" })
  @ApiOperation({ summary: "Create a note for a series" })
  @ApiParam({ description: "Series id", name: "id" })
  @Post("api/series/:id/notes")
  @Throttle({ default: { limit: NOTE_ACTION_LIMIT, ttl: seconds(NOTE_ACTION_TTL_SECONDS) } })
  createSeriesNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateNoteInputSchema)) body: CreateNoteInputDto,
  ): Promise<NoteView> {
    return this.notesService.createSeriesNote(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateNoteInputDto })
  @ApiNotFoundResponse({ description: "Note not found" })
  @ApiOkResponse({ description: "The updated note", type: NoteViewDto })
  @ApiOperation({
    summary: "Update fields of a note, including spoiler, favorite and pinned state",
  })
  @ApiParam({ description: "Note id", name: "noteId" })
  @Patch("api/notes/:noteId")
  @Throttle({ default: { limit: NOTE_ACTION_LIMIT, ttl: seconds(NOTE_ACTION_TTL_SECONDS) } })
  editNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body(new ZodBodyPipe(UpdateNoteInputSchema)) body: UpdateNoteInputDto,
  ): Promise<NoteView> {
    return this.notesService.editNote(user.id, noteId, body);
  }

  @ApiNoContentResponse({ description: "The note was deleted" })
  @ApiNotFoundResponse({ description: "Note not found" })
  @ApiOperation({ summary: "Delete a note" })
  @ApiParam({ description: "Note id", name: "noteId" })
  @Delete("api/notes/:noteId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({ default: { limit: NOTE_ACTION_LIMIT, ttl: seconds(NOTE_ACTION_TTL_SECONDS) } })
  deleteNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("noteId", ParseUUIDPipe) noteId: string,
  ): Promise<void> {
    return this.notesService.delete(user.id, noteId);
  }
}
