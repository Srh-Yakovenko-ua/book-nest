import { SeriesDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesDetailsViewDto extends createZodDto(SeriesDetailsViewSchema) {}
