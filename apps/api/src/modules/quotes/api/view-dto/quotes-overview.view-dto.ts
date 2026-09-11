import { QuotesOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotesOverviewViewDto extends createZodDto(QuotesOverviewViewSchema) {}
