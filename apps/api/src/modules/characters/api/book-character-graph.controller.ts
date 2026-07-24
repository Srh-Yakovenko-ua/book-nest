import type { CharacterGraphView } from "@app/shared";

import { BookCharacterGraphQuerySchema } from "@app/shared";
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
import { CharacterGraphService } from "../application/character-graph.service.js";
import { BookCharacterGraphQueryDto } from "./input-dto/book-character-graph-query.input-dto.js";
import { CharacterGraphViewDto } from "./view-dto/character-graph.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/books/:bookId/character-graph")
@JwtProtected()
export class BookCharacterGraphController {
  constructor(private readonly graphService: CharacterGraphService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "A spoiler-safe relationship graph for the book",
    type: CharacterGraphViewDto,
  })
  @ApiOperation({ summary: "Build a spoiler-safe character relationship graph for a book" })
  @ApiParam({ description: "Book id", name: "bookId" })
  @ApiQuery({ name: "mode", required: false })
  @ApiQuery({ name: "focusCharacterId", required: false })
  @ApiQuery({ name: "depth", required: false })
  @ApiQuery({ name: "categories", required: false })
  @ApiQuery({ name: "relationshipTypes", required: false })
  @ApiQuery({ name: "revealEdgeIds", required: false })
  @ApiQuery({ enum: ["group", "importance"], name: "clusterBy", required: false })
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
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Query(new ZodQueryPipe(BookCharacterGraphQuerySchema)) query: BookCharacterGraphQueryDto,
  ): Promise<CharacterGraphView> {
    return this.graphService.getForBook({ bookId, query, userId: user.id });
  }
}
