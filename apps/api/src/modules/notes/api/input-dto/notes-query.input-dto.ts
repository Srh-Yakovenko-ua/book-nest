import { NotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotesQueryDto extends createZodDto(NotesQuerySchema) {}
