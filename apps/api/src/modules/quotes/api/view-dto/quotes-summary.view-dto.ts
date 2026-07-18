import { QuotesSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotesSummaryViewDto extends createZodDto(QuotesSummaryViewSchema) {}
