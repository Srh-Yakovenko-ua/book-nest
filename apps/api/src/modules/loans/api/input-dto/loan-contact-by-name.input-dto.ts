import { LoanContactByNameQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanContactByNameQueryDto extends createZodDto(LoanContactByNameQuerySchema) {}
