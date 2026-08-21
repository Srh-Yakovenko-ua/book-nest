import { LoanContactsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanContactsViewDto extends createZodDto(LoanContactsViewSchema) {}
