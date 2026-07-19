import type { BookCharacterSummaryView } from "@app/shared";

import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { BookCharacterSummaryViewDto } from "./view-dto/book-character-summary.view-dto.js";

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/books/:bookId/character-summary")
@UseGuards(JwtAccessGuard)
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
