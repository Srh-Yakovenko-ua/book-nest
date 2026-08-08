import { ReadingGoalViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalViewDto extends createZodDto(ReadingGoalViewSchema) {}
