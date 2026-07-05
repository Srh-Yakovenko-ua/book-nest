import { CreateLoanInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateLoanInputDto extends createZodDto(CreateLoanInputSchema) {}
