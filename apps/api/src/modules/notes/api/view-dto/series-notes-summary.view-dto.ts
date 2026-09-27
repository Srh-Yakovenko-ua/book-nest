import { SeriesNotesSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesSummaryViewDto extends createZodDto(SeriesNotesSummaryViewSchema) {}
