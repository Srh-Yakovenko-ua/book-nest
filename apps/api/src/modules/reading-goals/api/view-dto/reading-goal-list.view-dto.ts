import { ReadingGoalListResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalListResponseDto extends createZodDto(ReadingGoalListResponseSchema) {}
