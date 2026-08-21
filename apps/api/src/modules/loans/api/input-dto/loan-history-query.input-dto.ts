import { LoanHistoryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanHistoryQueryDto extends createZodDto(LoanHistoryQuerySchema) {}
