import type { CharacterRelationshipContextView } from "@app/shared";

import { BookCharacterRelationshipsQuerySchema } from "@app/shared";
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
import { CharacterRelationshipsService } from "../application/character-relationships.service.js";
import { BookCharacterRelationshipsQueryDto } from "./input-dto/book-character-relationships-query.input-dto.js";
import { CharacterRelationshipContextViewDto } from "./view-dto/character-relationship-context.view-dto.js";

@ApiBearerAuth()
@ApiTags("character-relationships")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/books/:bookId/character-relationships")
@UseGuards(JwtAccessGuard)
export class BookCharacterRelationshipsController {
  constructor(private readonly relationshipsService: CharacterRelationshipsService) {}

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
    return this.relationshipsService.listForBook({ bookId, query, userId: user.id });
  }
}
