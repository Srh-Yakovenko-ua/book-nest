import type { BookListsView } from "@app/shared";

import { SetBookListsInputSchema } from "@app/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookListsService } from "../application/book-lists.service.js";
import { SetBookListsInputDto } from "./input-dto/set-book-lists.input-dto.js";
import { BookListsViewDto } from "./view-dto/book-lists.view-dto.js";

@ApiTags("books")
@Controller("api/books")
@JwtProtected()
export class BookListsController {
  constructor(private readonly bookListsService: BookListsService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The user's lists annotated with this book's membership and each list's size",
    type: BookListsViewDto,
  })
  @ApiOperation({
    summary: "Get the user's lists annotated with whether this book belongs to each",
  })
  @ApiParam({ name: "bookId", required: true })
  @Get(":bookId/lists")
  getLists(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<BookListsView> {
    return this.bookListsService.getLists({ bookId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SetBookListsInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The refreshed list-membership state for this book",
    type: BookListsViewDto,
  })
  @ApiOperation({ summary: "Set which of the user's lists contain this book" })
  @ApiParam({ name: "bookId", required: true })
  @Put(":bookId/lists")
  setLists(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(SetBookListsInputSchema)) body: SetBookListsInputDto,
  ): Promise<BookListsView> {
    return this.bookListsService.setLists({ bookId, input: body, userId: user.id });
  }
}
