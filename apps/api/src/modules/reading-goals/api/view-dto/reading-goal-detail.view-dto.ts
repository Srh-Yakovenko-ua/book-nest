import { ReadingGoalDetailSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalDetailDto extends createZodDto(ReadingGoalDetailSchema) {}
