import { SeriesReadingContextDefaultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesReadingContextDefaultViewDto extends createZodDto(
  SeriesReadingContextDefaultViewSchema,
) {}
