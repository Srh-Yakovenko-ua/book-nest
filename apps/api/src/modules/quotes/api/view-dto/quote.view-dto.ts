import { QuoteViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuoteViewDto extends createZodDto(QuoteViewSchema) {}
