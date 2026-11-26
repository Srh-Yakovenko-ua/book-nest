import { ReadingGoalCreationPreviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalCreationPreviewDto extends createZodDto(ReadingGoalCreationPreviewSchema) {}
