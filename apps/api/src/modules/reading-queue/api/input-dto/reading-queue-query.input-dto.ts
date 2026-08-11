import { ReadingQueueQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingQueueQueryDto extends createZodDto(ReadingQueueQuerySchema) {}
