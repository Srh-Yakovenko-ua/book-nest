import type {
  CustomListCard,
  ListDeletionResult,
  ListsSummaryView,
  PaginatedTrashedLists,
  Paginator,
} from "@app/shared";

import {
  CustomListsQuerySchema,
  NewListInputSchema,
  TrashedListsQuerySchema,
  UpdateListInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ListLifecycleService } from "../application/list-lifecycle.service.js";
import { ListsService } from "../application/lists.service.js";
import { CustomListsQueryDto } from "./input-dto/custom-lists-query.input-dto.js";
import { NewListInputDto } from "./input-dto/new-list.input-dto.js";
import { TrashedListsQueryDto } from "./input-dto/trashed-lists-query.input-dto.js";
import { UpdateListInputDto } from "./input-dto/update-list.input-dto.js";
import { CustomListCardDto } from "./view-dto/custom-list-card.view-dto.js";
import { ListDeletionResultDto } from "./view-dto/list-deletion-result.view-dto.js";
import { ListsSummaryViewDto } from "./view-dto/lists-summary.view-dto.js";
import { PaginatedCustomListsDto } from "./view-dto/paginated-custom-lists.view-dto.js";
import { PaginatedTrashedListsDto } from "./view-dto/paginated-trashed-lists.view-dto.js";

@ApiTags("lists")
@Controller("api/lists")
export class ListsController {
  constructor(
    private readonly listsService: ListsService,
    private readonly lifecycleService: ListLifecycleService,
  ) {}

  @ApiOkResponse({
    description: "A page of the current user trashed lists",
    type: PaginatedTrashedListsDto,
  })
  @ApiOperation({ summary: "List book lists waiting in the trash before their scheduled purge" })
  @Get("trash")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  listTrash(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(TrashedListsQuerySchema)) query: TrashedListsQueryDto,
  ): Promise<PaginatedTrashedLists> {
    return this.lifecycleService.listTrash({ query, userId: user.id });
  }

  @ApiOkResponse({
    description: "Aggregated statistics over the current user own book lists",
    type: ListsSummaryViewDto,
  })
  @ApiOperation({ summary: "Get the current user book lists summary" })
  @Get("summary")
  @JwtProtected()
  @Throttle(READ_THROTTLE)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ListsSummaryView> {
    return this.listsService.getSummary({ userId: user.id });
  }

  @ApiConflictResponse({ description: "Too many copies of this list already exist" })
  @ApiCreatedResponse({ description: "The duplicated list", type: CustomListCardDto })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOperation({ summary: "Duplicate a book list with its books and their order" })
  @ApiParam({ name: "listId", required: true })
  @JwtProtected()
  @Post(":listId/duplicate")
  @Throttle(MUTATION_THROTTLE)
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<CustomListCard> {
    return this.listsService.duplicate({ listId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "List not found in the trash" })
  @ApiOkResponse({ description: "The restored list", type: CustomListCardDto })
  @ApiOperation({ summary: "Restore a book list from the trash" })
  @JwtProtected()
  @Post(":listId/restore")
  @Throttle(MUTATION_THROTTLE)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<CustomListCard> {
    return this.lifecycleService.restore({ listId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: NewListInputDto })
  @ApiConflictResponse({ description: "A list with this name already exists" })
  @ApiCreatedResponse({ description: "The created list", type: CustomListCardDto })
  @ApiOperation({ summary: "Create a book list for the current user" })
  @JwtProtected()
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NewListInputSchema)) body: NewListInputDto,
  ): Promise<CustomListCard> {
    return this.listsService.create({ input: body, userId: user.id });
  }
  @ApiOkResponse({
    description: "A page of the current user own book lists",
    type: PaginatedCustomListsDto,
  })
  @ApiOperation({ summary: "Search the current user personal book lists" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @Get()
  @JwtProtected()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CustomListsQuerySchema))
    query: CustomListsQueryDto,
  ): Promise<Paginator<CustomListCard>> {
    return this.listsService.search({ query, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateListInputDto })
  @ApiConflictResponse({ description: "A list with this name already exists" })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "The updated list", type: CustomListCardDto })
  @ApiOperation({ summary: "Update a book list of the current user" })
  @JwtProtected()
  @Patch(":listId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Body(new ZodBodyPipe(UpdateListInputSchema)) body: UpdateListInputDto,
  ): Promise<CustomListCard> {
    return this.listsService.update({ input: body, listId, userId: user.id });
  }
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "The list was moved to the trash and scheduled for purge",
    type: ListDeletionResultDto,
  })
  @ApiOperation({ summary: "Move a book list to the trash" })
  @Delete(":listId")
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<ListDeletionResult> {
    return this.lifecycleService.softDelete({ listId, userId: user.id });
  }
}
