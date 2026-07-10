import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { LoansController } from "./api/loans.controller.js";
import { LoansService } from "./application/loans.service.js";
import { LoansRepository } from "./infrastructure/loans.repository.js";

@Module({
  controllers: [LoansController],
  imports: [AuthModule, MediaModule],
  providers: [LoansService, LoansRepository],
})
export class LoansModule {}
