import { ReadingStatisticsCompletedReadsSubsetQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsCompletedReadsSubsetQueryDto extends createZodDto(
  ReadingStatisticsCompletedReadsSubsetQuerySchema,
) {}
