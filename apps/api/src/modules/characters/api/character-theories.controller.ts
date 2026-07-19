import type { CharacterTheoryView, Paginator } from "@app/shared";

import {
  CharacterTheoriesQuerySchema,
  CreateCharacterTheoryInputSchema,
  UpdateCharacterTheoryInputSchema,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharacterTheoriesService } from "../application/character-theories.service.js";
import { CharacterTheoriesQueryDto } from "./input-dto/character-theories-query.input-dto.js";
import { CreateCharacterTheoryInputDto } from "./input-dto/create-character-theory.input-dto.js";
import { UpdateCharacterTheoryInputDto } from "./input-dto/update-character-theory.input-dto.js";
import { CharacterTheoryViewDto } from "./view-dto/character-theory.view-dto.js";
import { PaginatedCharacterTheoriesDto } from "./view-dto/paginated-character-theories.view-dto.js";

const CHARACTER_THEORY_ACTION_TTL_SECONDS = 60;
const CHARACTER_THEORY_ACTION_LIMIT = 60;

@ApiBearerAuth()
@ApiTags("character-theories")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/character-theories")
@UseGuards(JwtAccessGuard)
export class CharacterTheoriesController {
  constructor(private readonly characterTheoriesService: CharacterTheoriesService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterTheoryInputDto })
  @ApiCreatedResponse({ description: "The created theory", type: CharacterTheoryViewDto })
  @ApiNotFoundResponse({ description: "Target character, book or series not found" })
  @ApiOperation({ summary: "Create a theory targeting a character, book and/or series" })
  @Post()
  @Throttle({
    default: {
      limit: CHARACTER_THEORY_ACTION_LIMIT,
      ttl: seconds(CHARACTER_THEORY_ACTION_TTL_SECONDS),
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateCharacterTheoryInputSchema)) body: CreateCharacterTheoryInputDto,
  ): Promise<CharacterTheoryView> {
    return this.characterTheoriesService.create({ input: body, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Context book not found" })
  @ApiOkResponse({
    description:
      "The current user's theories, spoiler-masked to a reading context when contextBookId is set",
    type: PaginatedCharacterTheoriesDto,
  })
  @ApiOperation({ summary: "List and filter the current user's theories" })
  @ApiQuery({ name: "characterId", required: false })
  @ApiQuery({ name: "bookId", required: false })
  @ApiQuery({ name: "seriesId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterTheoriesQuerySchema)) query: CharacterTheoriesQueryDto,
  ): Promise<Paginator<CharacterTheoryView>> {
    return this.characterTheoriesService.list({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateCharacterTheoryInputDto })
  @ApiNotFoundResponse({ description: "Theory not found" })
  @ApiOkResponse({ description: "The updated theory", type: CharacterTheoryViewDto })
  @ApiOperation({ summary: "Update a theory's text, status or spoiler flag" })
  @ApiParam({ description: "Theory id", name: "theoryId" })
  @Patch(":theoryId")
  @Throttle({
    default: {
      limit: CHARACTER_THEORY_ACTION_LIMIT,
      ttl: seconds(CHARACTER_THEORY_ACTION_TTL_SECONDS),
    },
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("theoryId", ParseUUIDPipe) theoryId: string,
    @Body(new ZodBodyPipe(UpdateCharacterTheoryInputSchema)) body: UpdateCharacterTheoryInputDto,
  ): Promise<CharacterTheoryView> {
    return this.characterTheoriesService.update({ input: body, theoryId, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The theory was deleted" })
  @ApiNotFoundResponse({ description: "Theory not found" })
  @ApiOperation({ summary: "Delete a theory" })
  @ApiParam({ description: "Theory id", name: "theoryId" })
  @Delete(":theoryId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: {
      limit: CHARACTER_THEORY_ACTION_LIMIT,
      ttl: seconds(CHARACTER_THEORY_ACTION_TTL_SECONDS),
    },
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("theoryId", ParseUUIDPipe) theoryId: string,
  ): Promise<void> {
    return this.characterTheoriesService.remove({ theoryId, userId: user.id });
  }
}
