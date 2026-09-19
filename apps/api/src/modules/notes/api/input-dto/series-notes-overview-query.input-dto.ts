import { SeriesNotesOverviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesOverviewQueryDto extends createZodDto(SeriesNotesOverviewQuerySchema) {}
