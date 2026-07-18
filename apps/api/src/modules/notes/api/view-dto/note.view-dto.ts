import { NoteViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NoteViewDto extends createZodDto(NoteViewSchema) {}
