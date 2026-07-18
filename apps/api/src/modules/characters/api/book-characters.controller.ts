import type {
  CharacterDetailsView,
  CharacterSummaryView,
  CreateCharacterInBook,
  Paginator,
} from "@app/shared";

import {
  BookCharactersQuerySchema,
  CreateCharacterInBookSchema,
  UpdateBookCharacterSchema,
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
  ApiConflictResponse,
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
import { CharactersService } from "../application/characters.service.js";
import { BookCharactersQueryDto } from "./input-dto/book-characters-query.input-dto.js";
import { CreateCharacterInBookInputDto } from "./input-dto/create-character-in-book.input-dto.js";
import { UpdateBookCharacterInputDto } from "./input-dto/update-book-character.input-dto.js";
import { CharacterDetailsViewDto } from "./view-dto/character-details.view-dto.js";
import { PaginatedCharactersDto } from "./view-dto/paginated-characters.view-dto.js";

const CHARACTER_ACTION_TTL_SECONDS = 60;
const CHARACTER_ACTION_LIMIT = 60;

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/books/:bookId/characters")
@UseGuards(JwtAccessGuard)
export class BookCharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe roster of the book's characters",
    type: PaginatedCharactersDto,
  })
  @ApiOperation({ summary: "List the current user's characters for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(BookCharactersQuerySchema)) query: BookCharactersQueryDto,
  ): Promise<Paginator<CharacterSummaryView>> {
    return this.charactersService.listBookRoster(user.id, bookId, query);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterInBookInputDto })
  @ApiConflictResponse({ description: "Character is already linked to this book" })
  @ApiCreatedResponse({
    description: "The linked character with its book appearance",
    type: CharacterDetailsViewDto,
  })
  @ApiNotFoundResponse({ description: "Book, character or media not found" })
  @ApiOperation({ summary: "Add a new or existing character to a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Post()
  @Throttle({
    default: { limit: CHARACTER_ACTION_LIMIT, ttl: seconds(CHARACTER_ACTION_TTL_SECONDS) },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(CreateCharacterInBookSchema)) body: CreateCharacterInBook,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.createInBook(user.id, bookId, body);
  }

  @ApiNotFoundResponse({ description: "Book or character not found" })
  @ApiOkResponse({
    description: "The character combined with its book appearance",
    type: CharacterDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a character with its appearance in a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Get(":characterId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.getBookCharacterDetails(user.id, bookId, characterId);
  }

  @ApiBadRequestResponse({ description: "Validation failed or a global field was sent" })
  @ApiBody({ type: UpdateBookCharacterInputDto })
  @ApiNotFoundResponse({ description: "Book, character, media or tag not found" })
  @ApiOkResponse({
    description: "The character combined with its updated book appearance",
    type: CharacterDetailsViewDto,
  })
  @ApiOperation({
    summary: "Update a character's book profile, roles, book-scoped aliases and tags",
  })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Patch(":characterId")
  @Throttle({
    default: { limit: CHARACTER_ACTION_LIMIT, ttl: seconds(CHARACTER_ACTION_TTL_SECONDS) },
  })
  updateInBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(UpdateBookCharacterSchema)) body: UpdateBookCharacterInputDto,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.updateBook({ bookId, characterId, input: body, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The character was unlinked from the book" })
  @ApiNotFoundResponse({ description: "Book or character not found" })
  @ApiOperation({ summary: "Unlink a character from a book, keeping the global profile" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Delete(":characterId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: { limit: CHARACTER_ACTION_LIMIT, ttl: seconds(CHARACTER_ACTION_TTL_SECONDS) },
  })
  unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<void> {
    return this.charactersService.unlink({ bookId, characterId, userId: user.id });
  }
}
