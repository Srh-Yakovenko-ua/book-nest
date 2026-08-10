import { CreateReadingGoalInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateReadingGoalInputDto extends createZodDto(CreateReadingGoalInputSchema) {}
