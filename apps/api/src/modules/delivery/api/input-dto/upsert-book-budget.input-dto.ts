import { UpsertBookBudgetInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpsertBookBudgetInputDto extends createZodDto(UpsertBookBudgetInputSchema) {}
