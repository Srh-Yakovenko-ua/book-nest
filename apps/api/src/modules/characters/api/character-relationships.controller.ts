import type {
  CharacterRelationshipDeletionResultView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipPathView,
} from "@app/shared";

import {
  CharacterRelationshipDetailsQuerySchema,
  CharacterRelationshipPathQuerySchema,
  CreateCharacterRelationshipSchema,
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
import { CharacterRelationshipsService } from "../application/character-relationships.service.js";
import { CharacterRelationshipDetailsQueryDto } from "./input-dto/character-relationship-details-query.input-dto.js";
import { CharacterRelationshipPathQueryDto } from "./input-dto/character-relationship-path-query.input-dto.js";
import { CreateCharacterRelationshipInputDto } from "./input-dto/create-character-relationship.input-dto.js";
import { UpdateCharacterRelationshipInputDto } from "./input-dto/update-character-relationship.input-dto.js";
import { UpsertRelationshipBookStateInputDto } from "./input-dto/upsert-relationship-book-state.input-dto.js";
import { CharacterRelationshipDeletionResultViewDto } from "./view-dto/character-relationship-deletion-result.view-dto.js";
import { CharacterRelationshipDetailsViewDto } from "./view-dto/character-relationship-details.view-dto.js";
import { CharacterRelationshipPathViewDto } from "./view-dto/character-relationship-path.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/character-relationships")
@JwtProtected()
export class CharacterRelationshipsController {
  constructor(
    private readonly relationshipsService: CharacterRelationshipsService,
    private readonly pathService: CharacterRelationshipPathService,
  ) {}

  @ApiNotFoundResponse({ description: "A character endpoint was not found" })
  @ApiOkResponse({
    description: "The shortest spoiler-safe chain connecting two characters",
    type: CharacterRelationshipPathViewDto,
  })
  @ApiOperation({ summary: "Find the shortest spoiler-safe path between two characters" })
  @ApiQuery({ name: "fromId", required: true })
  @ApiQuery({ name: "toId", required: true })
  @ApiQuery({ name: "contextBookId", required: false })
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

  @ApiNotFoundResponse({ description: "Relationship or context book not found" })
  @ApiOkResponse({
    description: "The relationship, spoiler-masked to a reading context when contextBookId is set",
    type: CharacterRelationshipDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a relationship with its spoiler-safe per-book state history" })
  @ApiParam({ description: "Relationship id", name: "relationshipId" })
  @ApiQuery({ name: "contextBookId", required: false })
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
  @Get(":relationshipId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", ParseUUIDPipe) relationshipId: string,
    @Query(new ZodQueryPipe(CharacterRelationshipDetailsQuerySchema))
    query: CharacterRelationshipDetailsQueryDto,
  ): Promise<CharacterRelationshipDetailsView> {
    return this.relationshipsService.getDetails({ query, relationshipId, userId: user.id });
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
    return this.relationshipsService.upsertBookState({
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
    return this.relationshipsService.removeBookState({ bookId, relationshipId, userId: user.id });
  }
}
