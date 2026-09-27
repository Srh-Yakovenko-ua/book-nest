import { SeriesNotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesNotesQueryDto extends createZodDto(SeriesNotesQuerySchema) {}
