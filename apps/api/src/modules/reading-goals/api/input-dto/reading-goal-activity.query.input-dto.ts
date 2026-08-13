import { ReadingGoalActivityQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalActivityQueryDto extends createZodDto(ReadingGoalActivityQuerySchema) {}
