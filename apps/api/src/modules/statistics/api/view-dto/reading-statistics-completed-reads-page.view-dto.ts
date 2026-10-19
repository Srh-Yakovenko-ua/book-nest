import { ReadingStatisticsCompletedReadsPageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingStatisticsCompletedReadsPageDto extends createZodDto(
  ReadingStatisticsCompletedReadsPageSchema,
) {}
