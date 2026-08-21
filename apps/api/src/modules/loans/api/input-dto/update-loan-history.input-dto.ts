import { UpdateLoanHistoryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateLoanHistoryInputDto extends createZodDto(UpdateLoanHistoryInputSchema) {}
