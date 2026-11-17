import type { CharacterGraphView, FamilyTreeGraphView } from "@app/shared";

import { BookCharacterGraphQuerySchema } from "@app/shared";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterGraphService } from "../application/character-graph.service.js";
import { BookCharacterGraphQueryDto } from "./input-dto/book-character-graph-query.input-dto.js";
import { CharacterGraphViewDto } from "./view-dto/character-graph.view-dto.js";
import { FamilyTreeGraphViewDto } from "./view-dto/family-tree-graph.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/books/:bookId/character-graph")
@JwtProtected()
export class BookCharacterGraphController {
  constructor(private readonly graphService: CharacterGraphService) {}

  @ApiBadRequestResponse({
    description: "family_tree projection without a focus or combined with graph filters",
  })
  @ApiExtraModels(CharacterGraphViewDto, FamilyTreeGraphViewDto)
  @ApiNotFoundResponse({ description: "Book or focus character not found" })
  @ApiOkResponse({
    description:
      "A spoiler-safe relationship graph for the book, or its family tree when projection=family_tree",
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CharacterGraphViewDto) },
        { $ref: getSchemaPath(FamilyTreeGraphViewDto) },
      ],
    },
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
    description: "Opt-in genealogy projection built from immediate parent and child records",
    enum: ["family_tree"],
    name: "projection",
    required: false,
  })
  @ApiQuery({
    description: "Ancestor generations for projection=family_tree (1-3, default 2)",
    name: "ancestors",
    required: false,
  })
  @ApiQuery({
    description: "Descendant generations for projection=family_tree (1-3, default 2)",
    name: "descendants",
    required: false,
  })
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
  ): Promise<CharacterGraphView | FamilyTreeGraphView> {
    return this.graphService.getForBook({ bookId, query, userId: user.id });
  }
}
