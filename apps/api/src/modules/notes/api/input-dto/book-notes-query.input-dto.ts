import { BookNotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookNotesQueryDto extends createZodDto(BookNotesQuerySchema) {}
