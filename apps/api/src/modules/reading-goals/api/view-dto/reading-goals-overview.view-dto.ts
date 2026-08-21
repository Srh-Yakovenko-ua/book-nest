import { ReadingGoalsOverviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReadingGoalsOverviewDto extends createZodDto(ReadingGoalsOverviewSchema) {}
