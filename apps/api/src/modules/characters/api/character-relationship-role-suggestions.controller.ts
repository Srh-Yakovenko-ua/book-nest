import type { PaginatedCharacterRelationshipRoleSuggestionsView } from "@app/shared";

import { CharacterRelationshipRoleSuggestionsQuerySchema } from "@app/shared";
import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { RelationshipRoleSuggestionsService } from "../application/relationship-role-suggestions.service.js";
import { CharacterRelationshipRoleSuggestionsQueryDto } from "./input-dto/character-relationship-role-suggestions-query.input-dto.js";
import { PaginatedCharacterRelationshipRoleSuggestionsViewDto } from "./view-dto/paginated-character-relationship-role-suggestions.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/character-relationship-role-suggestions")
@JwtProtected()
export class CharacterRelationshipRoleSuggestionsController {
  constructor(private readonly roleSuggestionsService: RelationshipRoleSuggestionsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description:
      "The current user's own relationship role labels, most recently used first, ties broken by id",
    type: PaginatedCharacterRelationshipRoleSuggestionsViewDto,
  })
  @ApiOperation({
    summary: "List or search the relationship role labels the current user has already saved",
  })
  @ApiQuery({
    description: "Case- and whitespace-insensitive search over the whole dictionary; blank browses",
    name: "q",
    required: false,
  })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @Throttle(READ_THROTTLE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterRelationshipRoleSuggestionsQuerySchema))
    query: CharacterRelationshipRoleSuggestionsQueryDto,
  ): Promise<PaginatedCharacterRelationshipRoleSuggestionsView> {
    return this.roleSuggestionsService.list({ query, userId: user.id });
  }
}
