import type { BookView } from "@app/shared";

import {
  CreateLoanInputSchema,
  ExtendLoanInputSchema,
  SetLoanReminderInputSchema,
  UpdateLoanInputSchema,
} from "@app/shared";
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
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
import { BookLoanService } from "../application/book-loan.service.js";
import { CreateLoanInputDto } from "./input-dto/create-loan.input-dto.js";
import { ExtendLoanInputDto } from "./input-dto/extend-loan.input-dto.js";
import { SetLoanReminderInputDto } from "./input-dto/set-loan-reminder.input-dto.js";
import { UpdateLoanInputDto } from "./input-dto/update-loan.input-dto.js";
import { BookViewDto } from "./view-dto/book.view-dto.js";

@ApiTags("books")
@Controller("api/books")
export class BookLoanController {
  constructor(private readonly bookLoanService: BookLoanService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateLoanInputDto })
  @ApiConflictResponse({ description: "Book does not have the required ownership status" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the recorded loan", type: BookViewDto })
  @ApiOperation({ summary: "Record a loan for a book, borrowed from or lent to a person" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":id/loan")
  @Throttle(MUTATION_THROTTLE)
  createLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(CreateLoanInputSchema)) body: CreateLoanInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.createLoan(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateLoanInputDto })
  @ApiNotFoundResponse({ description: "Book or active loan not found" })
  @ApiOkResponse({ description: "The book with the updated loan", type: BookViewDto })
  @ApiOperation({ summary: "Edit the active loan of a borrowed or lent book" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch(":id/loan")
  @Throttle(MUTATION_THROTTLE)
  editLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateLoanInputSchema)) body: UpdateLoanInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.editLoan(user.id, id, body);
  }
  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: ExtendLoanInputDto })
  @ApiConflictResponse({ description: "Loan has no return date to extend" })
  @ApiNotFoundResponse({ description: "Book or active loan not found" })
  @ApiOkResponse({ description: "The book with the extended return date", type: BookViewDto })
  @ApiOperation({ summary: "Push the expected return date of an active loan by 7 or 14 days" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":id/loan/extend")
  @Throttle(MUTATION_THROTTLE)
  extendLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(ExtendLoanInputSchema)) body: ExtendLoanInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.extendLoan(user.id, id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: SetLoanReminderInputDto })
  @ApiConflictResponse({ description: "Loan has no return date for a reminder" })
  @ApiNotFoundResponse({ description: "Book or active loan not found" })
  @ApiOkResponse({ description: "The book with the updated reminder", type: BookViewDto })
  @ApiOperation({ summary: "Turn the return reminder of an active loan on or off" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch(":id/loan/reminder")
  @Throttle(MUTATION_THROTTLE)
  setLoanReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(SetLoanReminderInputSchema)) body: SetLoanReminderInputDto,
  ): Promise<BookView> {
    return this.bookLoanService.setLoanReminder(user.id, id, body);
  }

  @ApiConflictResponse({ description: "Book is not currently borrowed or lent" })
  @ApiNotFoundResponse({ description: "Book not found" })
  @ApiOkResponse({ description: "The book with the loan cleared", type: BookViewDto })
  @ApiOperation({ summary: "Return a borrowed or lent book, clearing its loan" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Post(":id/loan/return")
  @Throttle(MUTATION_THROTTLE)
  returnLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookView> {
    return this.bookLoanService.returnLoan(user.id, id);
  }
}
