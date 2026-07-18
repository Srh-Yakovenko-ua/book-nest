import { ReadingHistoryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingHistoryQueryDto extends createZodDto(ReadingHistoryQuerySchema) {}
