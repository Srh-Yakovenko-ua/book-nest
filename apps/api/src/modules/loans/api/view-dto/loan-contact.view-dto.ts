import { LoanContactViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanContactViewDto extends createZodDto(LoanContactViewSchema) {}
