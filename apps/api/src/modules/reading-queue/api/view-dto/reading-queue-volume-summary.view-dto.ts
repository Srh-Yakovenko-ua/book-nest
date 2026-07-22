import { ReadingQueueVolumeSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingQueueVolumeSummaryViewDto extends createZodDto(
  ReadingQueueVolumeSummaryViewSchema,
) {}
