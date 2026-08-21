import { ReadingGoalBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalBooksQueryDto extends createZodDto(ReadingGoalBooksQuerySchema) {}
