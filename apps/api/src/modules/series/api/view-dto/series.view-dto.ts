import { SeriesViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesViewDto extends createZodDto(SeriesViewSchema) {}
