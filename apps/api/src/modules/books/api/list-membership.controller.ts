import type { AddBooksToListResult, RemoveBooksFromListResult } from "@app/shared";

import {
  AddBooksToListInputSchema,
  MoveListBookInputSchema,
  RemoveBooksFromListInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ListMembershipService } from "../application/list-membership.service.js";
import { AddBooksToListInputDto } from "./input-dto/add-books-to-list.input-dto.js";
import { MoveListBookInputDto } from "./input-dto/move-list-book.input-dto.js";
import { RemoveBooksFromListInputDto } from "./input-dto/remove-books-from-list.input-dto.js";
import { AddBooksToListResultDto } from "./view-dto/add-books-to-list-result.view-dto.js";
import { RemoveBooksFromListResultDto } from "./view-dto/remove-books-from-list-result.view-dto.js";

@ApiTags("lists")
@Controller("api/lists")
@JwtProtected()
export class ListMembershipController {
  constructor(private readonly listMembershipService: ListMembershipService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: AddBooksToListInputDto })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "How many memberships were created and the new total count",
    type: AddBooksToListResultDto,
  })
  @ApiOperation({ summary: "Add owned books to a custom list" })
  @ApiParam({ name: "listId", required: true })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":listId/books")
  addBooks(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Body(new ZodBodyPipe(AddBooksToListInputSchema)) body: AddBooksToListInputDto,
  ): Promise<AddBooksToListResult> {
    return this.listMembershipService.addBooks({ input: body, listId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: RemoveBooksFromListInputDto })
  @ApiNotFoundResponse({ description: "List not found" })
  @ApiOkResponse({
    description: "How many memberships were removed and the new total count",
    type: RemoveBooksFromListResultDto,
  })
  @ApiOperation({ summary: "Remove several books from a custom list and re-sequence positions" })
  @ApiParam({ name: "listId", required: true })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":listId/books/remove")
  removeBooks(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Body(new ZodBodyPipe(RemoveBooksFromListInputSchema)) body: RemoveBooksFromListInputDto,
  ): Promise<RemoveBooksFromListResult> {
    return this.listMembershipService.removeBooks({ input: body, listId, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The book was removed from the list" })
  @ApiNotFoundResponse({ description: "List not found or the book is not in the list" })
  @ApiOperation({ summary: "Remove a book from a custom list and re-sequence positions" })
  @ApiParam({ name: "listId", required: true })
  @ApiParam({ name: "bookId", required: true })
  @Delete(":listId/books/:bookId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  removeBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<void> {
    return this.listMembershipService.removeBook({ bookId, listId, userId: user.id });
  }

  @ApiBadRequestResponse({
    description: "Validation failed or the book is already at the top or bottom",
  })
  @ApiBody({ type: MoveListBookInputDto })
  @ApiNoContentResponse({ description: "The book was moved" })
  @ApiNotFoundResponse({ description: "List not found or the book is not in the list" })
  @ApiOperation({ summary: "Move a book up or down within a custom list" })
  @ApiParam({ name: "listId", required: true })
  @ApiParam({ name: "bookId", required: true })
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Patch(":listId/books/:bookId/position")
  moveBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param("listId", ParseUUIDPipe) listId: string,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(MoveListBookInputSchema)) body: MoveListBookInputDto,
  ): Promise<void> {
    return this.listMembershipService.moveBook({
      bookId,
      direction: body.direction,
      listId,
      userId: user.id,
    });
  }
}
