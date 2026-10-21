import type { PaginatedCharacterRelationshipCustomTypesView } from "@app/shared";

import { CharacterRelationshipCustomTypesQuerySchema } from "@app/shared";
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
import { RelationshipCustomTypesService } from "../application/relationship-custom-types.service.js";
import { CharacterRelationshipCustomTypesQueryDto } from "./input-dto/character-relationship-custom-types-query.input-dto.js";
import { PaginatedCharacterRelationshipCustomTypesViewDto } from "./view-dto/paginated-character-relationship-custom-types.view-dto.js";

@ApiTags("character-relationships")
@Controller("api/character-relationship-custom-types")
@JwtProtected()
export class CharacterRelationshipCustomTypesController {
  constructor(private readonly customTypesService: RelationshipCustomTypesService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiOkResponse({
    description:
      "The current user's own relationship type names, most recently used first, ties broken by id",
    type: PaginatedCharacterRelationshipCustomTypesViewDto,
  })
  @ApiOperation({
    summary: "List or search the custom relationship types the current user has already used",
  })
  @ApiQuery({
    description: "Case- and whitespace-insensitive search over the whole dictionary; blank browses",
    name: "q",
    required: false,
  })
  @ApiQuery({
    description: "Only types with this directionality",
    name: "directionality",
    required: false,
  })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @Throttle(READ_THROTTLE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterRelationshipCustomTypesQuerySchema))
    query: CharacterRelationshipCustomTypesQueryDto,
  ): Promise<PaginatedCharacterRelationshipCustomTypesView> {
    return this.customTypesService.list({ query, userId: user.id });
  }
}
