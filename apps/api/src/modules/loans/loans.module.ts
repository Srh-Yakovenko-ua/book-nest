import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { LoanContactsController } from "./api/loan-contacts.controller.js";
import { LoanHistoryController } from "./api/loan-history.controller.js";
import { LoansController } from "./api/loans.controller.js";
import { LoanContactResolver } from "./application/loan-contact.resolver.js";
import { LoanContactsService } from "./application/loan-contacts.service.js";
import { LoanHistoryService } from "./application/loan-history.service.js";
import { LoansService } from "./application/loans.service.js";
import { LoanContactsRepository } from "./infrastructure/loan-contacts.repository.js";
import { LoanHistoryRepository } from "./infrastructure/loan-history.repository.js";
import { LoansRepository } from "./infrastructure/loans.repository.js";

@Module({
  controllers: [LoansController, LoanHistoryController, LoanContactsController],
  exports: [LoanContactResolver],
  imports: [AuthModule, MediaModule],
  providers: [
    LoansService,
    LoansRepository,
    LoanHistoryService,
    LoanHistoryRepository,
    LoanContactsService,
    LoanContactsRepository,
    LoanContactResolver,
  ],
})
export class LoansModule {}
