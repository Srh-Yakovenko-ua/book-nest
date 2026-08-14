import { BookOrderHistorySummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderHistorySummaryViewDto extends createZodDto(
  BookOrderHistorySummaryViewSchema,
) {}
