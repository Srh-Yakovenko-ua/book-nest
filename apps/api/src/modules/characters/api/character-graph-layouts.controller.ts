import type { CharacterGraphLayoutView } from "@app/shared";

import { CharacterGraphLayoutKeyQuerySchema, SaveCharacterGraphLayoutSchema } from "@app/shared";
import { Body, Controller, Delete, Get, HttpCode, Put, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterGraphLayoutsService } from "../application/character-graph-layouts.service.js";
import { CharacterGraphLayoutKeyQueryDto } from "./input-dto/character-graph-layout-key-query.input-dto.js";
import { SaveCharacterGraphLayoutInputDto } from "./input-dto/save-character-graph-layout.input-dto.js";
import { CharacterGraphLayoutViewDto } from "./view-dto/character-graph-layout.view-dto.js";

@ApiTags("character-graph-layouts")
@Controller("api/character-graph-layouts")
@JwtProtected()
export class CharacterGraphLayoutsController {
  constructor(private readonly characterGraphLayoutsService: CharacterGraphLayoutsService) {}

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiNotFoundResponse({ description: "No saved layout for the given key" })
  @ApiOkResponse({
    description: "The saved layout for the given key",
    type: CharacterGraphLayoutViewDto,
  })
  @ApiOperation({ summary: "Get the saved graph layout for a scope, mode and reading context" })
  @ApiQuery({ name: "scopeType", required: true })
  @ApiQuery({ name: "scopeId", required: false })
  @ApiQuery({ name: "mode", required: true })
  @ApiQuery({ name: "contextBookId", required: false })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterGraphLayoutKeyQuerySchema))
    query: CharacterGraphLayoutKeyQueryDto,
  ): Promise<CharacterGraphLayoutView> {
    return this.characterGraphLayoutsService.get({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SaveCharacterGraphLayoutInputDto })
  @ApiNotFoundResponse({ description: "Scope book/series or context book not found" })
  @ApiOkResponse({ description: "The stored layout", type: CharacterGraphLayoutViewDto })
  @ApiOperation({ summary: "Create or replace the saved graph layout for a key" })
  @HttpCode(HTTP_STATUS.OK)
  @Put()
  @Throttle(READ_THROTTLE)
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(SaveCharacterGraphLayoutSchema)) body: SaveCharacterGraphLayoutInputDto,
  ): Promise<CharacterGraphLayoutView> {
    return this.characterGraphLayoutsService.save({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Invalid query params" })
  @ApiNoContentResponse({ description: "The layout was deleted" })
  @ApiNotFoundResponse({ description: "No saved layout for the given key" })
  @ApiOperation({ summary: "Delete the saved graph layout for a key" })
  @ApiQuery({ name: "scopeType", required: true })
  @ApiQuery({ name: "scopeId", required: false })
  @ApiQuery({ name: "mode", required: true })
  @ApiQuery({ name: "contextBookId", required: false })
  @Delete()
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(READ_THROTTLE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterGraphLayoutKeyQuerySchema))
    query: CharacterGraphLayoutKeyQueryDto,
  ): Promise<void> {
    return this.characterGraphLayoutsService.remove({ query, userId: user.id });
  }
}
