import { LoansSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoansSummaryViewDto extends createZodDto(LoansSummaryViewSchema) {}
