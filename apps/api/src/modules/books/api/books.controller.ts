import type { BookView, Paginator } from "@app/shared";

import { CreateBookInputSchema, PaginationQuerySchema, UpdateBookInputSchema } from "@app/shared";
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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { UserModel } from "../../../generated/prisma/models.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { BooksService } from "../application/books.service.js";
import { CreateBookInputDto } from "./input-dto/create-book.input-dto.js";
import { PaginationQueryDto } from "./input-dto/pagination-query.input-dto.js";
import { UpdateBookInputDto } from "./input-dto/update-book.input-dto.js";

const CREATE_BOOK_TTL_SECONDS = 60;
const CREATE_BOOK_LIMIT = 30;
const UPDATE_BOOK_TTL_SECONDS = 60;
const UPDATE_BOOK_LIMIT = 60;

@ApiTags("books")
@Controller("api/books")
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateBookInputDto })
  @ApiCreatedResponse({ description: "The created book" })
  @ApiNotFoundResponse({ description: "Author or publisher not found" })
  @ApiOperation({ summary: "Create a book in the current user library" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Post()
  @Throttle({ default: { limit: CREATE_BOOK_LIMIT, ttl: seconds(CREATE_BOOK_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: UserModel,
    @Body(new ZodBodyPipe(CreateBookInputSchema)) body: CreateBookInputDto,
  ): Promise<BookView> {
    return this.booksService.create(user.id, body);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "A page of the current user books" })
  @ApiOperation({ summary: "List the current user books" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  list(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(PaginationQuerySchema)) query: PaginationQueryDto,
  ): Promise<Paginator<BookView>> {
    return this.booksService.list(user.id, query);
  }

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The requested book" })
  @ApiOperation({ summary: "Get a book by id" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get(":id")
  @UseGuards(JwtAccessGuard)
  getById(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.booksService.getById(user.id, id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateBookInputDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The updated book" })
  @ApiOperation({ summary: "Update a book in the current user library" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Patch(":id")
  @Throttle({ default: { limit: UPDATE_BOOK_LIMIT, ttl: seconds(UPDATE_BOOK_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateBookInputSchema)) body: UpdateBookInputDto,
  ): Promise<BookView> {
    return this.booksService.update(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The book was deleted" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Delete a book by id" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  delete(@CurrentUser() user: UserModel, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.booksService.delete(user.id, id);
  }
}
