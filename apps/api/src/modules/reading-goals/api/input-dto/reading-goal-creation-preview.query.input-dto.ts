import { ReadingGoalCreationPreviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalCreationPreviewQueryDto extends createZodDto(
  ReadingGoalCreationPreviewQuerySchema,
) {}
