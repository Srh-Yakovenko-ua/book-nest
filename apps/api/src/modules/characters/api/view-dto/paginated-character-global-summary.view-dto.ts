import { PaginatedCharacterGlobalSummarySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterGlobalSummaryDto extends createZodDto(
  PaginatedCharacterGlobalSummarySchema,
) {}
