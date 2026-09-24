import { LoansQuickCountsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoansQuickCountsQueryDto extends createZodDto(LoansQuickCountsQuerySchema) {}
