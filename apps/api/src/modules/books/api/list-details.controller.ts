import type { CustomListDetail } from "@app/shared";

import { CustomListBooksQuerySchema } from "@app/shared";
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
import { ListDetailsService } from "../application/list-details.service.js";
import { CustomListBooksQueryDto } from "./input-dto/custom-list-books-query.input-dto.js";
import { CustomListDetailDto } from "./view-dto/custom-list-detail.view-dto.js";

@ApiTags("lists")
@Controller("api/lists")
export class ListDetailsController {
  constructor(private readonly listDetailsService: ListDetailsService) {}

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({ description: "The list with a page of its books", type: CustomListDetailDto })
  @ApiOperation({ summary: "Get a book list of the current user with a page of its books" })
  @ApiParam({ name: "listId", required: true })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "pageNumber", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":listId")
  @UseGuards(JwtAccessGuard)
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Query(new ZodQueryPipe(CustomListBooksQuerySchema)) query: CustomListBooksQueryDto,
  ): Promise<CustomListDetail> {
    return this.listDetailsService.detail({ listId, query, userId: user.id });
  }
}
