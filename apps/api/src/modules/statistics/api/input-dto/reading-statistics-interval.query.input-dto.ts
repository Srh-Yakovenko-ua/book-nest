import { ReadingStatisticsIntervalQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsIntervalQueryDto extends createZodDto(
  ReadingStatisticsIntervalQuerySchema,
) {}
