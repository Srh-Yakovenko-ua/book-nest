import type { CharacterSuggestionsView } from "@app/shared";

import { CharacterSuggestionsQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { CharacterSuggestionsQueryDto } from "./input-dto/character-suggestions-query.input-dto.js";
import { CharacterSuggestionsDto } from "./view-dto/character-suggestions.view-dto.js";

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/books/:bookId/character-suggestions")
@UseGuards(JwtAccessGuard)
export class BookCharacterSuggestionsController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "Existing characters not yet linked to this book, same-series first",
    type: CharacterSuggestionsDto,
  })
  @ApiOperation({ summary: "Suggest existing characters to add to a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(CharacterSuggestionsQuerySchema)) query: CharacterSuggestionsQueryDto,
  ): Promise<CharacterSuggestionsView> {
    return this.charactersService.bookCharacterSuggestions({ bookId, query, userId: user.id });
  }
}
