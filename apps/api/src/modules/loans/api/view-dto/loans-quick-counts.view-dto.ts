import { LoansQuickCountsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoansQuickCountsViewDto extends createZodDto(LoansQuickCountsSchema) {}
