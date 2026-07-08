import { UpdateLoanInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateLoanInputDto extends createZodDto(UpdateLoanInputSchema) {}
