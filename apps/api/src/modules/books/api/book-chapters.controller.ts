import type { BookChaptersView } from "@app/shared";

import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookChaptersService } from "../application/book-chapters.service.js";
import { BookChaptersViewDto } from "./view-dto/book-chapters.view-dto.js";

@ApiTags("books")
@Controller("api/books")
@JwtProtected()
export class BookChaptersController {
  constructor(private readonly bookChaptersService: BookChaptersService) {}

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description:
      "The distinct chapters already used by this book's notes, quotes and timeline events with their usage counts",
    type: BookChaptersViewDto,
  })
  @ApiOperation({ summary: "List the chapters this book already uses with how often each is used" })
  @ApiParam({ name: "bookId", required: true })
  @Get(":bookId/chapters")
  getChapters(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<BookChaptersView> {
    return this.bookChaptersService.getChapters({ bookId, userId: user.id });
  }
}
