import { BookNotesFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookNotesFacetsViewDto extends createZodDto(BookNotesFacetsViewSchema) {}
