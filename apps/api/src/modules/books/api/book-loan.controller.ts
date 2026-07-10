import type { BookView } from "@app/shared";

import { CreateLoanInputSchema, UpdateLoanInputSchema } from "@app/shared";
import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { BookLoanService } from "../application/book-loan.service.js";
import { CreateLoanInputDto } from "./input-dto/create-loan.input-dto.js";
import { UpdateLoanInputDto } from "./input-dto/update-loan.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";

const LOAN_ACTION_TTL_SECONDS = 60;
const LOAN_ACTION_LIMIT = 60;

@ApiTags("books")
@Controller("api/books")
export class BookLoanController {
  constructor(private readonly bookLoanService: BookLoanService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateLoanInputDto })
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the recorded loan", type: BookViewDto })
  @ApiOperation({ summary: "Record a loan for a book, borrowed from or lent to a person" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/loan")
  @Throttle({ default: { limit: LOAN_ACTION_LIMIT, ttl: seconds(LOAN_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  createLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateLoanInputSchema)) body: CreateLoanInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.createLoan(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateLoanInputDto })
  @ApiNotFoundResponse({ description: "Book or active loan not found" })
  @ApiOkResponse({ description: "The book with the updated loan", type: BookViewDto })
  @ApiOperation({ summary: "Edit the active loan of a borrowed or lent book" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch(":id/loan")
  @Throttle({ default: { limit: LOAN_ACTION_LIMIT, ttl: seconds(LOAN_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  editLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateLoanInputSchema)) body: UpdateLoanInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.editLoan(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiConflictResponse({ description: "Book is not currently borrowed or lent" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the loan cleared", type: BookViewDto })
  @ApiOperation({ summary: "Return a borrowed or lent book, clearing its loan" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Post(":id/loan/return")
  @Throttle({ default: { limit: LOAN_ACTION_LIMIT, ttl: seconds(LOAN_ACTION_TTL_SECONDS) } })
  @UseGuards(JwtAccessGuard)
  returnLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.bookLoanService.returnLoan(user.id, id);
  }
}
