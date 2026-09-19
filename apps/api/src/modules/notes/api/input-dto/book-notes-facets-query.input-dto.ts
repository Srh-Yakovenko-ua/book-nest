import { BookNotesFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookNotesFacetsQueryDto extends createZodDto(BookNotesFacetsQuerySchema) {}
