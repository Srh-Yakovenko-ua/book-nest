import { BookNotesOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookNotesOverviewViewDto extends createZodDto(BookNotesOverviewViewSchema) {}
