import type {
  OwnSpeciesList,
  SpeciesCandidates,
  SpeciesDeletionPreview,
  SpeciesMergeResult,
  SpeciesOptionView,
  SpeciesSearchResult,
} from "@app/shared";

import {
  CatalogLocaleSchema,
  MergeSpeciesInputSchema,
  SpeciesCandidatesQuerySchema,
  SpeciesLocaleQuerySchema,
  SpeciesNameInputSchema,
  SpeciesSearchQuerySchema,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { SpeciesService } from "../application/species.service.js";
import { MergeSpeciesDto } from "./input-dto/merge-species.input-dto.js";
import { SpeciesCandidatesQueryDto } from "./input-dto/species-candidates-query.input-dto.js";
import { SpeciesLocaleQueryDto } from "./input-dto/species-locale-query.input-dto.js";
import { SpeciesNameDto } from "./input-dto/species-name.input-dto.js";
import { SpeciesSearchQueryDto } from "./input-dto/species-search-query.input-dto.js";
import { OwnSpeciesListDto } from "./view-dto/own-species-list.view-dto.js";
import { SpeciesCandidatesDto } from "./view-dto/species-candidates.view-dto.js";
import { SpeciesDeletionPreviewDto } from "./view-dto/species-deletion-preview.view-dto.js";
import { SpeciesMergeResultDto } from "./view-dto/species-merge-result.view-dto.js";
import { SpeciesOptionViewDto } from "./view-dto/species-option.view-dto.js";
import { SpeciesSearchResultDto } from "./view-dto/species-search-result.view-dto.js";

const SPECIES_ID_PARAM = "speciesId";

@ApiTags("species")
@Controller("api/species")
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description:
      "Popular system species plus own recent entries for a short query, otherwise ranked visible matches",
    type: SpeciesSearchResultDto,
  })
  @ApiOperation({ summary: "Search species visible to the current user (system + own)" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @Get()
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SpeciesSearchQuerySchema)) query: SpeciesSearchQueryDto,
  ): Promise<SpeciesSearchResult> {
    return this.speciesService.search({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description: "The visible species with exactly this name and advisory similar species",
    type: SpeciesCandidatesDto,
  })
  @ApiOperation({ summary: "Find visible species that duplicate or resemble a proposed name" })
  @ApiQuery({ name: "name", required: true })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @Get("candidates")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  candidates(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SpeciesCandidatesQuerySchema)) query: SpeciesCandidatesQueryDto,
  ): Promise<SpeciesCandidates> {
    return this.speciesService.candidates({
      locale: query.locale,
      name: query.name,
      userId: user.id,
    });
  }

  @ApiOkResponse({
    description: "The current user's own species with their usage counts",
    type: OwnSpeciesListDto,
  })
  @ApiOperation({ summary: "List the current user's own species" })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @Get("own")
  @JwtProtected()
  listOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SpeciesLocaleQuerySchema)) query: SpeciesLocaleQueryDto,
  ): Promise<OwnSpeciesList> {
    return this.speciesService.listOwn({ locale: query.locale, userId: user.id });
  }

  @ApiForbiddenResponse({ description: "System species cannot be deleted" })
  @ApiNotFoundResponse({ description: "Species not found" })
  @ApiOkResponse({
    description: "How many characters and book overrides still use the species",
    type: SpeciesDeletionPreviewDto,
  })
  @ApiOperation({ summary: "Preview whether an own species can be deleted" })
  @ApiParam({ name: SPECIES_ID_PARAM })
  @Get(`:${SPECIES_ID_PARAM}/deletion-preview`)
  @JwtProtected()
  deletionPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param(SPECIES_ID_PARAM, ParseUUIDPipe) speciesId: string,
  ): Promise<SpeciesDeletionPreview> {
    return this.speciesService.deletionPreview({ speciesId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SpeciesNameDto })
  @ApiConflictResponse({ description: "A visible species with this name already exists" })
  @ApiCreatedResponse({ description: "The created own species", type: SpeciesOptionViewDto })
  @ApiOperation({ summary: "Create an own species for the current user" })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @HttpCode(HTTP_STATUS.CREATED)
  @JwtProtected()
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(SpeciesLocaleQuerySchema)) query: SpeciesLocaleQueryDto,
    @Body(new ZodBodyPipe(SpeciesNameInputSchema)) body: SpeciesNameDto,
  ): Promise<SpeciesOptionView> {
    return this.speciesService.create({ locale: query.locale, name: body.name, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed or source and target are the same" })
  @ApiBody({ type: MergeSpeciesDto })
  @ApiConflictResponse({ description: "The merge conflicted with a concurrent change" })
  @ApiForbiddenResponse({ description: "System species cannot be merged away" })
  @ApiNotFoundResponse({ description: "Source species not found" })
  @ApiOkResponse({
    description: "The target species and how many references were moved onto it",
    type: SpeciesMergeResultDto,
  })
  @ApiOperation({
    summary: "Merge an own species into another visible species and delete the source",
  })
  @ApiParam({ name: SPECIES_ID_PARAM })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @ApiUnprocessableEntityResponse({ description: "The merge target is not available" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(`:${SPECIES_ID_PARAM}/merge`)
  @Throttle(MUTATION_THROTTLE)
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param(SPECIES_ID_PARAM, ParseUUIDPipe) speciesId: string,
    @Query(new ZodQueryPipe(SpeciesLocaleQuerySchema)) query: SpeciesLocaleQueryDto,
    @Body(new ZodBodyPipe(MergeSpeciesInputSchema)) body: MergeSpeciesDto,
  ): Promise<SpeciesMergeResult> {
    return this.speciesService.merge({
      locale: query.locale,
      sourceId: speciesId,
      targetId: body.targetId,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SpeciesNameDto })
  @ApiConflictResponse({ description: "Another visible species already has this name" })
  @ApiForbiddenResponse({ description: "System species cannot be renamed" })
  @ApiNotFoundResponse({ description: "Species not found" })
  @ApiOkResponse({ description: "The renamed own species", type: SpeciesOptionViewDto })
  @ApiOperation({ summary: "Rename an own species" })
  @ApiParam({ name: SPECIES_ID_PARAM })
  @ApiQuery({ enum: CatalogLocaleSchema.options, name: "locale", required: false })
  @JwtProtected()
  @Patch(`:${SPECIES_ID_PARAM}`)
  @Throttle(MUTATION_THROTTLE)
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param(SPECIES_ID_PARAM, ParseUUIDPipe) speciesId: string,
    @Query(new ZodQueryPipe(SpeciesLocaleQuerySchema)) query: SpeciesLocaleQueryDto,
    @Body(new ZodBodyPipe(SpeciesNameInputSchema)) body: SpeciesNameDto,
  ): Promise<SpeciesOptionView> {
    return this.speciesService.rename({
      locale: query.locale,
      name: body.name,
      speciesId,
      userId: user.id,
    });
  }

  @ApiConflictResponse({ description: "The species is still used by characters" })
  @ApiForbiddenResponse({ description: "System species cannot be deleted" })
  @ApiNoContentResponse({ description: "The own species was deleted" })
  @ApiNotFoundResponse({ description: "Species not found" })
  @ApiOperation({ summary: "Delete an unused own species" })
  @ApiParam({ name: SPECIES_ID_PARAM })
  @Delete(`:${SPECIES_ID_PARAM}`)
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  deleteOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(SPECIES_ID_PARAM, ParseUUIDPipe) speciesId: string,
  ): Promise<void> {
    return this.speciesService.deleteOwn({ speciesId, userId: user.id });
  }
}
