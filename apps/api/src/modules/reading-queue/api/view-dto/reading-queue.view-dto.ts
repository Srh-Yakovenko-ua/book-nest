import { ReadingQueueViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingQueueViewDto extends createZodDto(ReadingQueueViewSchema) {}
