import type { BookCharacterSummaryView } from "@app/shared";

import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { BookCharacterSummaryViewDto } from "./view-dto/book-character-summary.view-dto.js";

@ApiTags("characters")
@Controller("api/books/:bookId/character-summary")
@JwtProtected()
export class BookCharacterSummaryController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe recap of the book's cast",
    type: BookCharacterSummaryViewDto,
  })
  @ApiOperation({ summary: "Get a spoiler-safe recap of a book's characters" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<BookCharacterSummaryView> {
    return this.charactersService.bookCharacterSummary({ bookId, userId: user.id });
  }
}
