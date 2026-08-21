import { UpdateLoanContactInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateLoanContactInputDto extends createZodDto(UpdateLoanContactInputSchema) {}
