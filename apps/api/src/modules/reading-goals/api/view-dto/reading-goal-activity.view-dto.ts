import { ReadingGoalActivityResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalActivityResponseDto extends createZodDto(
  ReadingGoalActivityResponseSchema,
) {}
