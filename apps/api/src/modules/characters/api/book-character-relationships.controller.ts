import type { CharacterRelationshipContextView } from "@app/shared";

import { BookCharacterRelationshipsQuerySchema } from "@app/shared";
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
import { RelationshipContextService } from "../application/relationship-context.service.js";
import { BookCharacterRelationshipsQueryDto } from "./input-dto/book-character-relationships-query.input-dto.js";
import { CharacterRelationshipContextViewDto } from "./view-dto/character-relationship-context.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/books/:bookId/character-relationships")
@JwtProtected()
export class BookCharacterRelationshipsController {
  constructor(private readonly contextService: RelationshipContextService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "Spoiler-safe relationships with their effective state in this book",
    isArray: true,
    type: CharacterRelationshipContextViewDto,
  })
  @ApiOperation({ summary: "List spoiler-safe relationships effective in a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "includeHistory", required: false })
  @ApiQuery({
    description: "Reader chapter within the book for page-level spoiler masking",
    name: "contextChapter",
    required: false,
  })
  @ApiQuery({
    description: "Reader page within the book for page-level spoiler masking",
    name: "contextPage",
    required: false,
  })
  @ApiQuery({
    description: "Reader audiobook seconds within the book for page-level spoiler masking",
    name: "contextAudioSeconds",
    required: false,
  })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(BookCharacterRelationshipsQuerySchema))
    query: BookCharacterRelationshipsQueryDto,
  ): Promise<CharacterRelationshipContextView[]> {
    return this.contextService.listForBook({ bookId, query, userId: user.id });
  }
}
