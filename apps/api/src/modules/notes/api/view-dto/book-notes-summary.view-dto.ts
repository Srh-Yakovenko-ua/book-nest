import { BookNotesSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookNotesSummaryViewDto extends createZodDto(BookNotesSummaryViewSchema) {}
