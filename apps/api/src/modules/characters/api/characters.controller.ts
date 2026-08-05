import type {
  CharacterDeletionPreview,
  CharacterDeletionResult,
  CharacterDetailsView,
  CharacterDuplicateCandidatesView,
  CharacterGlobalSummaryView,
  Paginator,
} from "@app/shared";

import {
  CharacterDetailsQuerySchema,
  CharacterDuplicateCandidatesQuerySchema,
  CharactersListQuerySchema,
  CreateCharacterSchema,
  DeleteCharacterQuerySchema,
  UpdateCharacterSchema,
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
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
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
import { CharacterLifecycleService } from "../application/character-lifecycle.service.js";
import { CharactersService } from "../application/characters.service.js";
import { CharacterDetailsQueryDto } from "./input-dto/character-details-query.input-dto.js";
import { CharactersListQueryDto } from "./input-dto/characters-list-query.input-dto.js";
import { CreateCharacterInputDto } from "./input-dto/create-character.input-dto.js";
import { DeleteCharacterQueryDto } from "./input-dto/delete-character-query.input-dto.js";
import { CharacterDuplicateCandidatesQueryDto } from "./input-dto/duplicate-candidates-query.input-dto.js";
import { UpdateCharacterInputDto } from "./input-dto/update-character.input-dto.js";
import { CharacterDeletionPreviewDto } from "./view-dto/character-deletion-preview.view-dto.js";
import { CharacterDeletionResultDto } from "./view-dto/character-deletion-result.view-dto.js";
import { CharacterDetailsViewDto } from "./view-dto/character-details.view-dto.js";
import { CharacterDuplicateCandidatesDto } from "./view-dto/character-duplicate-candidates.view-dto.js";
import { PaginatedCharacterGlobalSummaryDto } from "./view-dto/paginated-character-global-summary.view-dto.js";

@ApiTags("characters")
@Controller("api/characters")
@JwtProtected()
export class CharactersController {
  constructor(
    private readonly charactersService: CharactersService,
    private readonly lifecycleService: CharacterLifecycleService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterInputDto })
  @ApiCreatedResponse({ description: "The created character", type: CharacterDetailsViewDto })
  @ApiNotFoundResponse({ description: "Book or media not found" })
  @ApiOperation({ summary: "Create a global character, optionally with a first book appearance" })
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateCharacterSchema)) body: CreateCharacterInputDto,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.createGlobalCharacter({ input: body, userId: user.id });
  }

  @ApiOkResponse({
    description: "A spoiler-safe global summary list of the current user's characters",
    type: PaginatedCharacterGlobalSummaryDto,
  })
  @ApiOperation({ summary: "List the current user's characters as spoiler-safe global summaries" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "seriesId", required: false })
  @ApiQuery({ name: "role", required: false })
  @ApiQuery({ name: "importance", required: false })
  @ApiQuery({ name: "species", required: false })
  @ApiQuery({ name: "gender", required: false })
  @ApiQuery({ name: "attitude", required: false })
  @ApiQuery({ name: "groupId", required: false })
  @ApiQuery({ name: "tagId", required: false })
  @ApiQuery({ name: "favorite", required: false })
  @ApiQuery({ name: "hasSpoilers", required: false })
  @ApiQuery({ name: "possibleDuplicates", required: false })
  @ApiQuery({ name: "archived", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "includeSpoilerSearch", required: false })
  @ApiQuery({
    description: "Owner opt-in to include whole-profile hidden characters in the results",
    name: "includeHiddenProfiles",
    required: false,
  })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharactersListQuerySchema)) query: CharactersListQueryDto,
  ): Promise<Paginator<CharacterGlobalSummaryView>> {
    return this.charactersService.listGlobal({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Spoiler-safe owner-scoped duplicate candidates for the given name and signals",
    type: CharacterDuplicateCandidatesDto,
  })
  @ApiOperation({ summary: "Find possible duplicate characters before creating a new one" })
  @ApiQuery({ name: "name", required: false })
  @ApiQuery({ name: "aliases", required: false })
  @ApiQuery({ name: "seriesId", required: false })
  @ApiQuery({ name: "characterId", required: false })
  @Get("duplicate-candidates")
  duplicateCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterDuplicateCandidatesQuerySchema))
    query: CharacterDuplicateCandidatesQueryDto,
  ): Promise<CharacterDuplicateCandidatesView> {
    return this.charactersService.duplicateCandidates({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Character or context book not found" })
  @ApiOkResponse({
    description:
      "The character with its appearances, context-masked to a reading context when contextBookId is set",
    type: CharacterDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a global character with its book appearances" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "revealFieldIds", required: false })
  @ApiQuery({
    description: "Owner opt-in to reveal a whole-profile hidden character instead of 404",
    name: "includeHiddenProfiles",
    required: false,
  })
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
  @Get(":characterId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query(new ZodQueryPipe(CharacterDetailsQuerySchema)) query: CharacterDetailsQueryDto,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.getCharacterDetails({ characterId, query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Character not found" })
  @ApiOkResponse({
    description: "Counts of what a full delete would affect",
    type: CharacterDeletionPreviewDto,
  })
  @ApiOperation({ summary: "Preview the impact of deleting a character" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Get(":characterId/deletion-preview")
  deletionPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<CharacterDeletionPreview> {
    return this.lifecycleService.deletionPreview({ characterId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed or a book-scoped field was sent" })
  @ApiBody({ type: UpdateCharacterInputDto })
  @ApiNotFoundResponse({ description: "Character or media not found" })
  @ApiOkResponse({ description: "The updated character", type: CharacterDetailsViewDto })
  @ApiOperation({ summary: "Update the global fields of a character" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Patch(":characterId")
  @Throttle(MUTATION_THROTTLE)
  updateGlobal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(UpdateCharacterSchema)) body: UpdateCharacterInputDto,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.updateGlobal({ characterId, input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "The confirm flag is missing or not true" })
  @ApiNotFoundResponse({ description: "Character not found" })
  @ApiOkResponse({
    description: "The character was soft-deleted and scheduled for purge",
    type: CharacterDeletionResultDto,
  })
  @ApiOperation({ summary: "Soft-delete a character with an undo window" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiQuery({ description: "Must be true to confirm the delete", name: "confirm", required: true })
  @Delete(":characterId")
  @Throttle(MUTATION_THROTTLE)
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query(new ZodQueryPipe(DeleteCharacterQuerySchema)) _confirmation: DeleteCharacterQueryDto,
  ): Promise<CharacterDeletionResult> {
    return this.lifecycleService.softDelete({ characterId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Character not found or already purged" })
  @ApiOkResponse({ description: "The restored character", type: CharacterDetailsViewDto })
  @ApiOperation({ summary: "Restore a soft-deleted character within the undo window" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":characterId/restore")
  @Throttle(MUTATION_THROTTLE)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<CharacterDetailsView> {
    return this.lifecycleService.restore({ characterId, userId: user.id });
  }
}
