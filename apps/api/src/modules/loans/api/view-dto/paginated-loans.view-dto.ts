import { PaginatedLoansSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedLoansDto extends createZodDto(PaginatedLoansSchema) {}
