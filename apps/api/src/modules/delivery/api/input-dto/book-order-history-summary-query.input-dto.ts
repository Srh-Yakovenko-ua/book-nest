import { BookOrderHistorySummaryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderHistorySummaryQueryDto extends createZodDto(
  BookOrderHistorySummaryQuerySchema,
) {}
