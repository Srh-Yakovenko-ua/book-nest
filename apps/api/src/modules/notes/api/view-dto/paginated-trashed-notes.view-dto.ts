import { PaginatedTrashedNotesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashedNotesDto extends createZodDto(PaginatedTrashedNotesSchema) {}
