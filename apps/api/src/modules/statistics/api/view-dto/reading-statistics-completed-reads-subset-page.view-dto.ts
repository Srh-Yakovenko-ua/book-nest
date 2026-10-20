import { ReadingStatisticsCompletedReadsSubsetPageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsCompletedReadsSubsetPageDto extends createZodDto(
  ReadingStatisticsCompletedReadsSubsetPageSchema,
) {}
