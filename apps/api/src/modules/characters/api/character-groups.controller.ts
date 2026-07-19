import type { CharacterGroupDetailsView, CharacterGroupSummaryView, Paginator } from "@app/shared";

import {
  CharacterGroupDetailsQuerySchema,
  CharacterGroupsListQuerySchema,
  CreateCharacterGroupSchema,
  UpdateCharacterGroupSchema,
  UpsertCharacterGroupMembershipSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharacterGroupsService } from "../application/character-groups.service.js";
import { CharacterGroupDetailsQueryDto } from "./input-dto/character-group-details-query.input-dto.js";
import { CharacterGroupsListQueryDto } from "./input-dto/character-groups-list-query.input-dto.js";
import { CreateCharacterGroupInputDto } from "./input-dto/create-character-group.input-dto.js";
import { UpdateCharacterGroupInputDto } from "./input-dto/update-character-group.input-dto.js";
import { UpsertCharacterGroupMembershipInputDto } from "./input-dto/upsert-character-group-membership.input-dto.js";
import { CharacterGroupDetailsViewDto } from "./view-dto/character-group-details.view-dto.js";
import { PaginatedCharacterGroupSummaryDto } from "./view-dto/paginated-character-group-summary.view-dto.js";

const CHARACTER_GROUP_ACTION_TTL_SECONDS = 60;
const CHARACTER_GROUP_ACTION_LIMIT = 60;

@ApiBearerAuth()
@ApiTags("character-groups")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/character-groups")
@UseGuards(JwtAccessGuard)
export class CharacterGroupsController {
  constructor(private readonly characterGroupsService: CharacterGroupsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterGroupInputDto })
  @ApiCreatedResponse({ description: "The created group", type: CharacterGroupDetailsViewDto })
  @ApiNotFoundResponse({ description: "Series, book or member character not found" })
  @ApiOperation({ summary: "Create a character group, optionally with initial members" })
  @Post()
  @Throttle({
    default: {
      limit: CHARACTER_GROUP_ACTION_LIMIT,
      ttl: seconds(CHARACTER_GROUP_ACTION_TTL_SECONDS),
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateCharacterGroupSchema)) body: CreateCharacterGroupInputDto,
  ): Promise<CharacterGroupDetailsView> {
    return this.characterGroupsService.create({ input: body, userId: user.id });
  }

  @ApiOkResponse({
    description: "The current user's character groups",
    type: PaginatedCharacterGroupSummaryDto,
  })
  @ApiOperation({ summary: "List the current user's character groups" })
  @ApiQuery({ name: "seriesId", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterGroupsListQuerySchema)) query: CharacterGroupsListQueryDto,
  ): Promise<Paginator<CharacterGroupSummaryView>> {
    return this.characterGroupsService.list({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Group or context book not found" })
  @ApiOkResponse({
    description:
      "The group with its members, spoiler-masked to a reading context when contextBookId is set",
    type: CharacterGroupDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a character group with its members" })
  @ApiParam({ description: "Character group id", name: "groupId" })
  @ApiQuery({ name: "contextBookId", required: false })
  @Get(":groupId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Query(new ZodQueryPipe(CharacterGroupDetailsQuerySchema)) query: CharacterGroupDetailsQueryDto,
  ): Promise<CharacterGroupDetailsView> {
    return this.characterGroupsService.getDetails({ groupId, query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateCharacterGroupInputDto })
  @ApiNotFoundResponse({ description: "Group or series not found" })
  @ApiOkResponse({ description: "The updated group", type: CharacterGroupDetailsViewDto })
  @ApiOperation({ summary: "Update a character group" })
  @ApiParam({ description: "Character group id", name: "groupId" })
  @Patch(":groupId")
  @Throttle({
    default: {
      limit: CHARACTER_GROUP_ACTION_LIMIT,
      ttl: seconds(CHARACTER_GROUP_ACTION_TTL_SECONDS),
    },
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Body(new ZodBodyPipe(UpdateCharacterGroupSchema)) body: UpdateCharacterGroupInputDto,
  ): Promise<CharacterGroupDetailsView> {
    return this.characterGroupsService.update({ groupId, input: body, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The group and its memberships were deleted" })
  @ApiNotFoundResponse({ description: "Group not found" })
  @ApiOperation({ summary: "Delete a character group and its memberships" })
  @ApiParam({ description: "Character group id", name: "groupId" })
  @Delete(":groupId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: {
      limit: CHARACTER_GROUP_ACTION_LIMIT,
      ttl: seconds(CHARACTER_GROUP_ACTION_TTL_SECONDS),
    },
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.characterGroupsService.remove({ groupId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpsertCharacterGroupMembershipInputDto })
  @ApiNotFoundResponse({ description: "Group, member character or book not found" })
  @ApiOkResponse({
    description: "The group with the upserted member",
    type: CharacterGroupDetailsViewDto,
  })
  @ApiOperation({ summary: "Add or update a character's membership in a group" })
  @ApiParam({ description: "Character group id", name: "groupId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @HttpCode(HTTP_STATUS.OK)
  @Put(":groupId/members/:characterId")
  @Throttle({
    default: {
      limit: CHARACTER_GROUP_ACTION_LIMIT,
      ttl: seconds(CHARACTER_GROUP_ACTION_TTL_SECONDS),
    },
  })
  upsertMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(UpsertCharacterGroupMembershipSchema))
    body: UpsertCharacterGroupMembershipInputDto,
  ): Promise<CharacterGroupDetailsView> {
    return this.characterGroupsService.upsertMember({
      characterId,
      groupId,
      input: body,
      userId: user.id,
    });
  }

  @ApiNoContentResponse({ description: "The character's memberships were removed from the group" })
  @ApiNotFoundResponse({ description: "Group or membership not found" })
  @ApiOperation({ summary: "Remove a character from a group" })
  @ApiParam({ description: "Character group id", name: "groupId" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Delete(":groupId/members/:characterId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: {
      limit: CHARACTER_GROUP_ACTION_LIMIT,
      ttl: seconds(CHARACTER_GROUP_ACTION_TTL_SECONDS),
    },
  })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<void> {
    return this.characterGroupsService.removeMember({ characterId, groupId, userId: user.id });
  }
}
