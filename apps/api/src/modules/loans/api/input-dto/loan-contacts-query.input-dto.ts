import { LoanContactsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoanContactsQueryDto extends createZodDto(LoanContactsQuerySchema) {}
