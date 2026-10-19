import type { CharacterFactView, Paginator } from "@app/shared";

import {
  CharacterFactsQuerySchema,
  CreateCharacterFactInputSchema,
  UpdateCharacterFactInputSchema,
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
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterFactsService } from "../application/character-facts.service.js";
import { CharacterFactsQueryDto } from "./input-dto/character-facts-query.input-dto.js";
import { CreateCharacterFactInputDto } from "./input-dto/create-character-fact.input-dto.js";
import { UpdateCharacterFactInputDto } from "./input-dto/update-character-fact.input-dto.js";
import { CharacterFactViewDto } from "./view-dto/character-fact.view-dto.js";
import { PaginatedCharacterFactsDto } from "./view-dto/paginated-character-facts.view-dto.js";

@ApiTags("characters")
@Controller("api/books/:bookId/characters/:characterId/facts")
@JwtProtected()
export class CharacterFactsController {
  constructor(private readonly characterFactsService: CharacterFactsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiNotFoundResponse({ description: "Book, character or their appearance not found" })
  @ApiOkResponse({
    description: "The character's facts in this book, newest first",
    type: PaginatedCharacterFactsDto,
  })
  @ApiOperation({ summary: "List and search a character's facts within one book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Query(new ZodQueryPipe(CharacterFactsQuerySchema)) query: CharacterFactsQueryDto,
  ): Promise<Paginator<CharacterFactView>> {
    return this.characterFactsService.list({ bookId, characterId, query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterFactInputDto })
  @ApiCreatedResponse({ description: "The created fact", type: CharacterFactViewDto })
  @ApiNotFoundResponse({ description: "Book, character or their appearance not found" })
  @ApiOperation({ summary: "Add a fact to a character within one book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiUnprocessableEntityResponse({ description: "The page exceeds the book page count" })
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(CreateCharacterFactInputSchema)) body: CreateCharacterFactInputDto,
  ): Promise<CharacterFactView> {
    return this.characterFactsService.create({ bookId, characterId, input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateCharacterFactInputDto })
  @ApiNotFoundResponse({ description: "Book, character, appearance or fact not found" })
  @ApiOkResponse({ description: "The updated fact", type: CharacterFactViewDto })
  @ApiOperation({ summary: "Update a character fact" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiParam({ description: "Fact id", name: "factId" })
  @ApiUnprocessableEntityResponse({ description: "The page exceeds the book page count" })
  @Patch(":factId")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Param("factId", ParseUUIDPipe) factId: string,
    @Body(new ZodBodyPipe(UpdateCharacterFactInputSchema)) body: UpdateCharacterFactInputDto,
  ): Promise<CharacterFactView> {
    return this.characterFactsService.update({
      bookId,
      characterId,
      factId,
      input: body,
      userId: user.id,
    });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiNoContentResponse({ description: "The fact was deleted" })
  @ApiNotFoundResponse({ description: "Book, character, appearance or fact not found" })
  @ApiOperation({ summary: "Delete a character fact" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiParam({ description: "Fact id", name: "factId" })
  @Delete(":factId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Param("factId", ParseUUIDPipe) factId: string,
  ): Promise<void> {
    return this.characterFactsService.remove({ bookId, characterId, factId, userId: user.id });
  }
}
