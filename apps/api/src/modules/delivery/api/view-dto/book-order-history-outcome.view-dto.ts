import { BookOrderHistoryOutcomeViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderHistoryOutcomeViewDto extends createZodDto(
  BookOrderHistoryOutcomeViewSchema,
) {}
