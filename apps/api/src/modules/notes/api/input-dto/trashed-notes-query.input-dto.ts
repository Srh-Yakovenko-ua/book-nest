import { TrashedNotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedNotesQueryDto extends createZodDto(TrashedNotesQuerySchema) {}
