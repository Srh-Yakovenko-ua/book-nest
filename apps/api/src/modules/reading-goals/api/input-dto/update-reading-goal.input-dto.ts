import { UpdateReadingGoalInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateReadingGoalInputDto extends createZodDto(UpdateReadingGoalInputSchema) {}
