import { ReadingStatisticsCalendarPageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsCalendarPageDto extends createZodDto(
  ReadingStatisticsCalendarPageSchema,
) {}
