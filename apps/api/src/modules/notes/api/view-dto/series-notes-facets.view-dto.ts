import { SeriesNotesFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesFacetsViewDto extends createZodDto(SeriesNotesFacetsViewSchema) {}
