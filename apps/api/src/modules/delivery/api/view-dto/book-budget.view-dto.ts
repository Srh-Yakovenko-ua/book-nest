import { BookBudgetOverviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookBudgetOverviewViewDto extends createZodDto(BookBudgetOverviewSchema) {}
