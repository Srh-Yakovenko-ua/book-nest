import { ReadingGoalsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalsQueryDto extends createZodDto(ReadingGoalsQuerySchema) {}
