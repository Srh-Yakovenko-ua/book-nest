import type { BookQuotesView, QuoteView } from "@app/shared";

import { CreateQuoteInputSchema, UpdateQuoteInputSchema } from "@app/shared";
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
import { MUTATION_THROTTLE, READ_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { QuotesService } from "../application/quotes.service.js";
import { CreateQuoteInputDto } from "./input-dto/create-quote.input-dto.js";
import { UpdateQuoteInputDto } from "./input-dto/update-quote.input-dto.js";
import { BookQuotesViewDto } from "./view-dto/book-quotes.view-dto.js";
import { QuoteViewDto } from "./view-dto/quote.view-dto.js";

@ApiTags("quotes")
@Controller("api/books")
@JwtProtected()
export class BookQuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateQuoteInputDto })
  @ApiCreatedResponse({ description: "The created quote", type: QuoteViewDto })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOperation({ summary: "Add a quote to a book" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post(":bookId/quotes")
  @Throttle(MUTATION_THROTTLE)
  createQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Body(new ZodBodyPipe(CreateQuoteInputSchema)) body: CreateQuoteInputDto,
  ): Promise<QuoteView> {
    return this.quotesService.createForBook({ bookId, input: body, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book's quotes with summary counts", type: BookQuotesViewDto })
  @ApiOperation({ summary: "List the quotes of a book" })
  @Get(":bookId/quotes")
  @Throttle(READ_THROTTLE)
  listBookQuotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
  ): Promise<BookQuotesView> {
    return this.quotesService.listForBook({ bookId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateQuoteInputDto })
  @ApiNotFoundResponse({ description: "Book or quote not found" })
  @ApiOkResponse({ description: "The updated quote", type: QuoteViewDto })
  @ApiOperation({ summary: "Edit a book quote, including its spoiler and favorite flags" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch(":bookId/quotes/:quoteId")
  @Throttle(MUTATION_THROTTLE)
  updateQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("quoteId", ParseUUIDPipe) quoteId: string,
    @Body(new ZodBodyPipe(UpdateQuoteInputSchema)) body: UpdateQuoteInputDto,
  ): Promise<QuoteView> {
    return this.quotesService.updateForBook({ bookId, input: body, quoteId, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The quote was deleted" })
  @ApiNotFoundResponse({ description: "Book or quote not found" })
  @ApiOperation({ summary: "Delete a book quote" })
  @Delete(":bookId/quotes/:quoteId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle(MUTATION_THROTTLE)
  async deleteQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("bookId", ParseUUIDPipe) bookId: string,
    @Param("quoteId", ParseUUIDPipe) quoteId: string,
  ): Promise<void> {
    await this.quotesService.deleteForBook({ bookId, quoteId, userId: user.id });
  }
}
