import { LoanHistoryDetailViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryDetailViewDto extends createZodDto(LoanHistoryDetailViewSchema) {}
