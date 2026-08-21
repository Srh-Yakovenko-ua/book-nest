import { CreateLoanContactInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateLoanContactInputDto extends createZodDto(CreateLoanContactInputSchema) {}
