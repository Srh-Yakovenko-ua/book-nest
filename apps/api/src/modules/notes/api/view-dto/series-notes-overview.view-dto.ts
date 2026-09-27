import { SeriesNotesOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesOverviewViewDto extends createZodDto(SeriesNotesOverviewViewSchema) {}
