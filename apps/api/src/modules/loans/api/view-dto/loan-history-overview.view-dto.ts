import { LoanHistoryOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryOverviewViewDto extends createZodDto(LoanHistoryOverviewViewSchema) {}
