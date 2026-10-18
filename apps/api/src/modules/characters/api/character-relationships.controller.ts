import type {
  CharacterRelationshipDeletionResultView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipPathView,
  CharacterRelationshipSafeDetailsView,
  PaginatedCharacterRelationshipListView,
} from "@app/shared";

import {
  CharacterRelationshipDetailsQuerySchema,
  CharacterRelationshipListQuerySchema,
  CharacterRelationshipListSortSchema,
  CharacterRelationshipPathQuerySchema,
  CreateCharacterRelationshipSchema,
  RelationshipReaderScopeSchema,
  UpdateCharacterRelationshipSchema,
  UpsertRelationshipBookStateSchema,
} from "@app/shared";
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
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterRelationshipPathService } from "../application/character-relationship-path.service.js";
import { CharacterRelationshipsListService } from "../application/character-relationships-list.service.js";
import { CharacterRelationshipsService } from "../application/character-relationships.service.js";
import { RelationshipBookStateService } from "../application/relationship-book-state.service.js";
import { RelationshipContextService } from "../application/relationship-context.service.js";
import { CharacterRelationshipDetailsQueryDto } from "./input-dto/character-relationship-details-query.input-dto.js";
import { CharacterRelationshipListQueryDto } from "./input-dto/character-relationship-list-query.input-dto.js";
import { CharacterRelationshipPathQueryDto } from "./input-dto/character-relationship-path-query.input-dto.js";
import { CreateCharacterRelationshipInputDto } from "./input-dto/create-character-relationship.input-dto.js";
import { UpdateCharacterRelationshipInputDto } from "./input-dto/update-character-relationship.input-dto.js";
import { UpsertRelationshipBookStateInputDto } from "./input-dto/upsert-relationship-book-state.input-dto.js";
import { CharacterRelationshipDeletionResultViewDto } from "./view-dto/character-relationship-deletion-result.view-dto.js";
import { CharacterRelationshipDetailsViewDto } from "./view-dto/character-relationship-details.view-dto.js";
import { CharacterRelationshipPathViewDto } from "./view-dto/character-relationship-path.view-dto.js";
import { CharacterRelationshipSafeDetailsViewDto } from "./view-dto/character-relationship-safe-details.view-dto.js";
import { PaginatedCharacterRelationshipListViewDto } from "./view-dto/paginated-character-relationship-list.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/character-relationships")
@JwtProtected()
export class CharacterRelationshipsController {
  constructor(
    private readonly relationshipsService: CharacterRelationshipsService,
    private readonly contextService: RelationshipContextService,
    private readonly bookStateService: RelationshipBookStateService,
    private readonly pathService: CharacterRelationshipPathService,
    private readonly listService: CharacterRelationshipsListService,
  ) {}

  @ApiBadRequestResponse({
    description:
      "Invalid scope combination, filter or search term, or the context book does not belong to the series",
  })
  @ApiNotFoundResponse({ description: "The scope character, book or series, or the context book" })
  @ApiOkResponse({
    description: "A page of relationships projected and spoiler-masked for the reader scope",
    type: PaginatedCharacterRelationshipListViewDto,
  })
  @ApiOperation({ summary: "List spoiler-safe relationships for a character, book or series" })
  @ApiQuery({
    description: "Reader scope",
    enum: RelationshipReaderScopeSchema.options,
    name: "scope",
    required: true,
  })
  @ApiQuery({
    description: "Id of the character, book or series scope",
    name: "scopeId",
    required: true,
  })
  @ApiQuery({
    description:
      "Selected book: switches the character scope to that book, picks the series reading context; not allowed with the book scope",
    name: "contextBookId",
    required: false,
  })
  @ApiQuery({
    description:
      "Only relationships with a visible state in this book (character scope without contextBookId)",
    name: "bookId",
    required: false,
  })
  @ApiQuery({
    description: "Search over visible names, labels and descriptions, 2 to 100 characters",
    name: "q",
    required: false,
  })
  @ApiQuery({ description: "Comma-separated or repeated", name: "categories", required: false })
  @ApiQuery({
    description: "Comma-separated or repeated",
    name: "relationshipTypes",
    required: false,
  })
  @ApiQuery({ description: "Comma-separated or repeated", name: "statuses", required: false })
  @ApiQuery({ description: "Comma-separated or repeated", name: "intensities", required: false })
  @ApiQuery({ name: "isCanonical", required: false })
  @ApiQuery({
    enum: CharacterRelationshipListSortSchema.options,
    name: "sort",
    required: false,
  })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({
    description: "Reader chapter within the selected book for page-level spoiler masking",
    name: "contextChapter",
    required: false,
  })
  @ApiQuery({
    description: "Reader page within the selected book for page-level spoiler masking",
    name: "contextPage",
    required: false,
  })
  @ApiQuery({
    description: "Reader audiobook seconds within the selected book for page-level spoiler masking",
    name: "contextAudioSeconds",
    required: false,
  })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterRelationshipListQuerySchema))
    query: CharacterRelationshipListQueryDto,
  ): Promise<PaginatedCharacterRelationshipListView> {
    return this.listService.list({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed, e.g. a missing contextBookId" })
  @ApiNotFoundResponse({ description: "A character endpoint or the context book was not found" })
  @ApiOkResponse({
    description: "The shortest spoiler-safe chain connecting two characters",
    type: CharacterRelationshipPathViewDto,
  })
  @ApiOperation({ summary: "Find the shortest spoiler-safe path between two characters" })
  @ApiQuery({ name: "fromId", required: true })
  @ApiQuery({ name: "toId", required: true })
  @ApiQuery({
    description: "Owned book that bounds the spoiler-safe reading context",
    name: "contextBookId",
    required: true,
  })
  @ApiQuery({ name: "mode", required: false })
  @ApiQuery({ name: "categories", required: false })
  @ApiQuery({ name: "relationshipTypes", required: false })
  @ApiQuery({ name: "revealEdgeIds", required: false })
  @ApiQuery({
    description: "Reader chapter within the context book for page-level spoiler masking",
    name: "contextChapter",
    required: false,
  })
  @ApiQuery({
    description: "Reader page within the context book for page-level spoiler masking",
    name: "contextPage",
    required: false,
  })
  @ApiQuery({
    description: "Reader audiobook seconds within the context book for page-level spoiler masking",
    name: "contextAudioSeconds",
    required: false,
  })
  @Get("path")
  findPath(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterRelationshipPathQuerySchema))
    query: CharacterRelationshipPathQueryDto,
  ): Promise<CharacterRelationshipPathView> {
    return this.pathService.findPath({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation, self-reference or direction mismatch" })
  @ApiBody({ type: CreateCharacterRelationshipInputDto })
  @ApiConflictResponse({ description: "Duplicate relationship or family cycle" })
  @ApiCreatedResponse({
    description: "The created relationship",
    type: CharacterRelationshipDetailsViewDto,
  })
  @ApiNotFoundResponse({ description: "A character or book was not found" })
  @ApiOperation({ summary: "Create a relationship edge, optionally with initial per-book states" })
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateCharacterRelationshipSchema))
    body: CreateCharacterRelationshipInputDto,
  ): Promise<CharacterRelationshipDetailsView> {
    return this.relationshipsService.create({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({
    description: "Invalid scope combination, or the context book does not belong to the series",
  })
  @ApiNotFoundResponse({
    description: "Relationship, scope, context book or revealed book state not found",
  })
  @ApiOkResponse({
    description: "The relationship projected and spoiler-masked for the selected reader scope",
    type: CharacterRelationshipSafeDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a spoiler-safe relationship view for a reader scope" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @ApiQuery({
    description: "Reader scope; must be sent together with scopeId",
    enum: RelationshipReaderScopeSchema.options,
    name: "scope",
    required: false,
  })
  @ApiQuery({
    description: "Id of the character, book or series scope",
    name: "scopeId",
    required: false,
  })
  @ApiQuery({
    description: "Selected book for the character or series scope; not allowed with the book scope",
    name: "contextBookId",
    required: false,
  })
  @ApiQuery({
    description: "Reveal the masked type fields of this visible relationship",
    name: "revealType",
    required: false,
  })
  @ApiQuery({
    description: "Reveal the description of one permitted book state in this response",
    name: "revealDescriptionBookStateId",
    required: false,
  })
  @ApiQuery({
    description: "Reader chapter within the selected book for page-level spoiler masking",
    name: "contextChapter",
    required: false,
  })
  @ApiQuery({
    description: "Reader page within the selected book for page-level spoiler masking",
    name: "contextPage",
    required: false,
  })
  @ApiQuery({
    description: "Reader audiobook seconds within the selected book for page-level spoiler masking",
    name: "contextAudioSeconds",
    required: false,
  })
  @Get(":relationshipId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
    @Query(new ZodQueryPipe(CharacterRelationshipDetailsQuerySchema))
    query: CharacterRelationshipDetailsQueryDto,
  ): Promise<CharacterRelationshipSafeDetailsView> {
    return this.contextService.getDetails({ query, relationshipId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Relationship not found" })
  @ApiOkResponse({
    description: "The full, unmasked relationship with every per-book state for authoring",
    type: CharacterRelationshipDetailsViewDto,
  })
  @ApiOperation({ summary: "Get the full relationship record for the owner to edit" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @Get(":relationshipId/edit")
  getForEdit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
  ): Promise<CharacterRelationshipDetailsView> {
    return this.contextService.getEditableDetails({ relationshipId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateCharacterRelationshipInputDto })
  @ApiConflictResponse({ description: "Duplicate relationship or family cycle" })
  @ApiNotFoundResponse({ description: "Relationship not found" })
  @ApiOkResponse({
    description: "The updated relationship",
    type: CharacterRelationshipDetailsViewDto,
  })
  @ApiOperation({ summary: "Update the semantic edge without wiping its per-book states" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @Patch(":relationshipId")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
    @Body(new ZodBodyPipe(UpdateCharacterRelationshipSchema))
    body: UpdateCharacterRelationshipInputDto,
  ): Promise<CharacterRelationshipDetailsView> {
    return this.relationshipsService.update({ input: body, relationshipId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Relationship not found" })
  @ApiOkResponse({
    description: "The deleted relationship id and the number of book states removed",
    type: CharacterRelationshipDeletionResultViewDto,
  })
  @ApiOperation({ summary: "Delete a relationship and its per-book states" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @Delete(":relationshipId")
  @Throttle(MUTATION_THROTTLE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
  ): Promise<CharacterRelationshipDeletionResultView> {
    return this.relationshipsService.remove({ relationshipId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpsertRelationshipBookStateInputDto })
  @ApiNotFoundResponse({ description: "Relationship or book not found" })
  @ApiOkResponse({
    description: "The relationship with the upserted per-book state",
    type: CharacterRelationshipDetailsViewDto,
  })
  @ApiOperation({ summary: "Create or replace the relationship state for one book" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @HttpCode(HTTP_STATUS.OK)
  @Put(":relationshipId/books/:bookId")
  @Throttle(MUTATION_THROTTLE)
  upsertBookState(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(UpsertRelationshipBookStateSchema))
    body: UpsertRelationshipBookStateInputDto,
  ): Promise<CharacterRelationshipDetailsView> {
    return this.bookStateService.upsertBookState({
      bookId,
      input: body,
      relationshipId,
      userId: user.id,
    });
  }

  @ApiNoContentResponse({ description: "The per-book state was removed" })
  @ApiNotFoundResponse({ description: "Relationship or book state not found" })
  @ApiOperation({ summary: "Delete the relationship state for one book" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Delete(":relationshipId/books/:bookId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  removeBookState(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<void> {
    return this.bookStateService.removeBookState({ bookId, relationshipId, userId: user.id });
  }
}
