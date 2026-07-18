import { PaginatedNotesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedNotesDto extends createZodDto(PaginatedNotesSchema) {}
