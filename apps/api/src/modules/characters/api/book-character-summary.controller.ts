import type { BookCharacterSummaryView } from "@app/shared";

import { BookCharacterSummaryQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookCharactersService } from "../application/book-characters.service.js";
import { BookCharacterSummaryQueryDto } from "./input-dto/book-character-summary-query.input-dto.js";
import { BookCharacterSummaryViewDto } from "./view-dto/book-character-summary.view-dto.js";

@ApiTags("characters")
@Controller("api/books/:bookId/character-summary")
@JwtProtected()
export class BookCharacterSummaryController {
  constructor(private readonly bookCharactersService: BookCharactersService) {}

  @ApiNotFoundResponse({ description: "Book or context book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe recap of the book's cast at the current reading position",
    type: BookCharacterSummaryViewDto,
  })
  @ApiOperation({ summary: "Get a spoiler-safe recap of a book's characters" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @ApiQuery({ name: "contextChapter", required: false })
  @ApiQuery({ name: "contextPage", required: false })
  @ApiQuery({ name: "contextAudioSeconds", required: false })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(BookCharacterSummaryQuerySchema)) query: BookCharacterSummaryQueryDto,
  ): Promise<BookCharacterSummaryView> {
    return this.bookCharactersService.bookCharacterSummary({ bookId, query, userId: user.id });
  }
}
