import { ReadingGoalBooksResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalBooksResponseDto extends createZodDto(ReadingGoalBooksResponseSchema) {}
