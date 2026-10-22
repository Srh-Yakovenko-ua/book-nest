import { ReadingStatisticsCalendarPageQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsCalendarPageQueryDto extends createZodDto(
  ReadingStatisticsCalendarPageQuerySchema,
) {}
