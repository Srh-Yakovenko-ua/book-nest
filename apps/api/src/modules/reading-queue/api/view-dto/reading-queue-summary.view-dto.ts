import { ReadingQueueSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingQueueSummaryViewDto extends createZodDto(ReadingQueueSummaryViewSchema) {}
