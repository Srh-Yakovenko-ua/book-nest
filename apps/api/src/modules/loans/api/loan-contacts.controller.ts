import type { LoanContactsView, LoanContactView } from "@app/shared";

import {
  CreateLoanContactInputSchema,
  LoanContactsQuerySchema,
  UpdateLoanContactInputSchema,
} from "@app/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { MUTATION_THROTTLE } from "../../../core/throttle.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { LoanContactsService } from "../application/loan-contacts.service.js";
import { CreateLoanContactInputDto } from "./input-dto/create-loan-contact.input-dto.js";
import { LoanContactsQueryDto } from "./input-dto/loan-contacts-query.input-dto.js";
import { UpdateLoanContactInputDto } from "./input-dto/update-loan-contact.input-dto.js";
import { LoanContactViewDto } from "./view-dto/loan-contact.view-dto.js";
import { LoanContactsViewDto } from "./view-dto/loan-contacts.view-dto.js";

@ApiTags("loans")
@Controller("api/loans/contacts")
@JwtProtected()
export class LoanContactsController {
  constructor(private readonly loanContactsService: LoanContactsService) {}

  @ApiOkResponse({
    description: "The people the current user lends books to and borrows books from",
    type: LoanContactsViewDto,
  })
  @ApiOperation({ summary: "List the loan contacts of the current user" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "includeArchived", required: false })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(LoanContactsQuerySchema)) query: LoanContactsQueryDto,
  ): Promise<LoanContactsView> {
    return this.loanContactsService.list({ query, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Loan contact not found" })
  @ApiOkResponse({ description: "The requested loan contact", type: LoanContactViewDto })
  @ApiOperation({ summary: "Read one loan contact of the current user" })
  @ApiParam({ name: "contactId" })
  @Get(":contactId")
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("contactId", ParseUUIDPipe) contactId: string,
  ): Promise<LoanContactView> {
    return this.loanContactsService.detail({ contactId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateLoanContactInputDto })
  @ApiConflictResponse({ description: "A contact of the current user already uses this name" })
  @ApiCreatedResponse({ description: "The created loan contact", type: LoanContactViewDto })
  @ApiOperation({ summary: "Create a loan contact for the current user" })
  @Post()
  @Throttle(MUTATION_THROTTLE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateLoanContactInputSchema)) body: CreateLoanContactInputDto,
  ): Promise<LoanContactView> {
    return this.loanContactsService.create({ input: body, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateLoanContactInputDto })
  @ApiConflictResponse({ description: "A contact of the current user already uses this name" })
  @ApiNotFoundResponse({ description: "Loan contact not found" })
  @ApiOkResponse({ description: "The updated loan contact", type: LoanContactViewDto })
  @ApiOperation({ summary: "Rename a loan contact or change how to reach it" })
  @ApiParam({ name: "contactId" })
  @Patch(":contactId")
  @Throttle(MUTATION_THROTTLE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("contactId", ParseUUIDPipe) contactId: string,
    @Body(new ZodBodyPipe(UpdateLoanContactInputSchema)) body: UpdateLoanContactInputDto,
  ): Promise<LoanContactView> {
    return this.loanContactsService.update({ contactId, input: body, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Loan contact not found" })
  @ApiOkResponse({ description: "The archived loan contact", type: LoanContactViewDto })
  @ApiOperation({ summary: "Archive a loan contact so new loans stop offering it" })
  @ApiParam({ name: "contactId" })
  @HttpCode(HttpStatus.OK)
  @Post(":contactId/archive")
  @Throttle(MUTATION_THROTTLE)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("contactId", ParseUUIDPipe) contactId: string,
  ): Promise<LoanContactView> {
    return this.loanContactsService.archive({ contactId, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Loan contact not found" })
  @ApiOkResponse({ description: "The restored loan contact", type: LoanContactViewDto })
  @ApiOperation({ summary: "Restore an archived loan contact" })
  @ApiParam({ name: "contactId" })
  @HttpCode(HttpStatus.OK)
  @Post(":contactId/restore")
  @Throttle(MUTATION_THROTTLE)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("contactId", ParseUUIDPipe) contactId: string,
  ): Promise<LoanContactView> {
    return this.loanContactsService.restore({ contactId, userId: user.id });
  }
}
