import { LoanHistoryOverviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryOverviewQueryDto extends createZodDto(LoanHistoryOverviewQuerySchema) {}
