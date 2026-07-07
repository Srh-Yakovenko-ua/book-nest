import type { CustomListCard, Paginator } from "@app/shared";

import { CustomListsQuerySchema, NewListInputSchema, UpdateListInputSchema } from "@app/shared";
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
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { ListsService } from "../application/lists.service.js";
import { CustomListsQueryDto } from "./input-dto/custom-lists-query.input-dto.js";
import { NewListInputDto } from "./input-dto/new-list.input-dto.js";
import { UpdateListInputDto } from "./input-dto/update-list.input-dto.js";
import { CustomListCardDto } from "./view-dto/custom-list-card.view-dto.js";
import { PaginatedCustomListsDto } from "./view-dto/paginated-custom-lists.view-dto.js";

@ApiTags("lists")
@Controller("api/lists")
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: NewListInputDto })
  @ApiConflictResponse({ description: "A list with this name already exists" })
  @ApiCreatedResponse({ description: "The created list", type: CustomListCardDto })
  @ApiOperation({ summary: "Create a book list for the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Post()
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(NewListInputSchema)) body: NewListInputDto,
  ): Promise<CustomListCard> {
    return this.listsService.create(user.id, body);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    description: "A page of the current user own book lists",
    type: PaginatedCustomListsDto,
  })
  @ApiOperation({ summary: "Search the current user personal book lists" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CustomListsQuerySchema))
    query: CustomListsQueryDto,
  ): Promise<Paginator<CustomListCard>> {
    return this.listsService.search(user.id, query);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateListInputDto })
  @ApiConflictResponse({ description: "A list with this name already exists" })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "The updated list", type: CustomListCardDto })
  @ApiOperation({ summary: "Update a book list of the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Patch(":listId")
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Body(new ZodBodyPipe(UpdateListInputSchema)) body: UpdateListInputDto,
  ): Promise<CustomListCard> {
    return this.listsService.update(user.id, listId, body);
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The list was deleted" })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOperation({ summary: "Delete a book list of the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":listId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
  ): Promise<void> {
    return this.listsService.delete(user.id, listId);
  }
}
