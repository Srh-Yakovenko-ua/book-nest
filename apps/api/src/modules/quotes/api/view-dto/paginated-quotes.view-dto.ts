import { PaginatedQuotesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedQuotesDto extends createZodDto(PaginatedQuotesSchema) {}
