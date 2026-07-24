import type { BookStoreLinksView, BookStoreLinkView } from "@app/shared";

import { CreateBookStoreLinkInputSchema, UpdateBookStoreLinkInputSchema } from "@app/shared";
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
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { BookStoreLinkService } from "../application/book-store-link.service.js";
import { CreateBookStoreLinkInputDto } from "./input-dto/create-book-store-link.input-dto.js";
import { UpdateBookStoreLinkInputDto } from "./input-dto/update-book-store-link.input-dto.js";
import {
  BookStoreLinksViewDto,
  BookStoreLinkViewDto,
} from "./view-dto/book-store-link.view-dto.js";

@ApiTags("books")
@Controller("api/books")
export class BookStoreLinkController {
  constructor(private readonly bookStoreLinkService: BookStoreLinkService) {}
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({
    description: "The store links of the book with the derived best offer",
    type: BookStoreLinksViewDto,
  })
  @ApiOperation({ summary: "List the store links of a book with its best offer" })
  @Get(":id/store-links")
  @JwtProtected()
  getBookStoreLinks(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookStoreLinksView> {
    return this.bookStoreLinkService.getBookStoreLinks({ bookId: id, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateBookStoreLinkInputDto })
  @ApiConflictResponse({ description: "Duplicate store link URL or link limit reached" })
  @ApiCreatedResponse({ description: "The created store link", type: BookStoreLinkViewDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Add a store link to a book" })
  @HttpCode(HTTP_STATUS.CREATED)
  @JwtProtected()
  @Post(":id/store-links")
  @Throttle(MUTATION_THROTTLE)
  addLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateBookStoreLinkInputSchema)) body: CreateBookStoreLinkInputDto,
  ): Promise<BookStoreLinkView> {
    return this.bookStoreLinkService.addLink({ bookId: id, input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateBookStoreLinkInputDto })
  @ApiConflictResponse({ description: "Duplicate store link URL" })
  @ApiNotFoundResponse({ description: "Book or store link not found" })
  @ApiOkResponse({ description: "The updated store link", type: BookStoreLinkViewDto })
  @ApiOperation({ summary: "Edit a store link of a book" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch(":id/store-links/:linkId")
  @Throttle(MUTATION_THROTTLE)
  editLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
    @Body(new ZodBodyPipe(UpdateBookStoreLinkInputSchema)) body: UpdateBookStoreLinkInputDto,
  ): Promise<BookStoreLinkView> {
    return this.bookStoreLinkService.editLink({
      bookId: id,
      input: body,
      linkId,
      userId: user.id,
    });
  }
  @ApiNoContentResponse({ description: "The store link was removed" })
  @ApiNotFoundResponse({ description: "Book or store link not found" })
  @ApiOperation({ summary: "Remove a store link from a book" })
  @Delete(":id/store-links/:linkId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  @Throttle(MUTATION_THROTTLE)
  deleteLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    return this.bookStoreLinkService.deleteLink({ bookId: id, linkId, userId: user.id });
  }
}
