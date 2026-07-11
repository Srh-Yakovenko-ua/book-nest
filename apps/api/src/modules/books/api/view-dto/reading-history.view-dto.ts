import { ReadingHistoryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingHistoryViewDto extends createZodDto(ReadingHistoryViewSchema) {}
