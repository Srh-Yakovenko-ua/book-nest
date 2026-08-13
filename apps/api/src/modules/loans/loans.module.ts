import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { LoanHistoryController } from "./api/loan-history.controller.js";
import { LoansController } from "./api/loans.controller.js";
import { LoanHistoryService } from "./application/loan-history.service.js";
import { LoansService } from "./application/loans.service.js";
import { LoanHistoryRepository } from "./infrastructure/loan-history.repository.js";
import { LoansRepository } from "./infrastructure/loans.repository.js";

@Module({
  controllers: [LoansController, LoanHistoryController],
  imports: [AuthModule, MediaModule],
  providers: [LoansService, LoansRepository, LoanHistoryService, LoanHistoryRepository],
})
export class LoansModule {}
