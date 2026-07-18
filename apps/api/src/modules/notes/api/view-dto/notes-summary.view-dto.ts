import { NotesSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotesSummaryViewDto extends createZodDto(NotesSummaryViewSchema) {}
