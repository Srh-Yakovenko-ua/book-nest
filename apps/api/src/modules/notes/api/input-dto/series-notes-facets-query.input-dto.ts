import { SeriesNotesFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesFacetsQueryDto extends createZodDto(SeriesNotesFacetsQuerySchema) {}
