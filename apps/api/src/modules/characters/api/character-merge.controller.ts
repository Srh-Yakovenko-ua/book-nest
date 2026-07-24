import type { CharacterMergePreviewView, CharacterMergeResultView } from "@app/shared";

import { CharacterMergeInputSchema, CharacterMergePreviewQuerySchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterMergeService } from "../application/character-merge.service.js";
import { MergeCharacterInputDto } from "./input-dto/merge-character.input-dto.js";
import { CharacterMergePreviewQueryDto } from "./input-dto/merge-preview-query.input-dto.js";
import { CharacterMergePreviewDto } from "./view-dto/character-merge-preview.view-dto.js";
import { CharacterMergeResultDto } from "./view-dto/character-merge-result.view-dto.js";

const CHARACTER_MERGE_TTL_SECONDS = 60;
const CHARACTER_MERGE_LIMIT = 30;
@ApiTags("characters")
@Controller("api/characters")
@JwtProtected()
export class CharacterMergeController {
  constructor(private readonly characterMergeService: CharacterMergeService) {}

  @ApiBadRequestResponse({ description: "The two characters are the same" })
  @ApiNotFoundResponse({ description: "Survivor or other character not found" })
  @ApiOkResponse({
    description: "A spoiler-safe preview of what merging the other character would move and drop",
    type: CharacterMergePreviewDto,
  })
  @ApiOperation({ summary: "Preview merging another character into this one" })
  @ApiParam({ description: "Survivor character id", name: "characterId" })
  @ApiQuery({ description: "The character to merge in (loser)", name: "otherId", required: true })
  @Get(":characterId/merge-preview")
  @Throttle(MUTATION_THROTTLE)
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query(new ZodQueryPipe(CharacterMergePreviewQuerySchema)) query: CharacterMergePreviewQueryDto,
  ): Promise<CharacterMergePreviewView> {
    return this.characterMergeService.preview({
      characterId,
      otherId: query.otherId,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "The two characters are the same" })
  @ApiBody({ type: MergeCharacterInputDto })
  @ApiConflictResponse({ description: "The merge conflicted with a concurrent change" })
  @ApiNotFoundResponse({ description: "Survivor or other character not found" })
  @ApiOkResponse({
    description: "The merge result summary with the surviving character",
    type: CharacterMergeResultDto,
  })
  @ApiOperation({ summary: "Merge another character into this one and delete the other" })
  @ApiParam({ description: "Survivor character id", name: "characterId" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":characterId/merge")
  @Throttle({
    default: { limit: CHARACTER_MERGE_LIMIT, ttl: seconds(CHARACTER_MERGE_TTL_SECONDS) },
  })
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(CharacterMergeInputSchema)) body: MergeCharacterInputDto,
  ): Promise<CharacterMergeResultView> {
    return this.characterMergeService.merge({
      characterId,
      otherId: body.otherId,
      userId: user.id,
    });
  }
}
