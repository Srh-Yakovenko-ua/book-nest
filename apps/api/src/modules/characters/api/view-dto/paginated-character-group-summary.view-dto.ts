import { PaginatedCharacterGroupSummarySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterGroupSummaryDto extends createZodDto(
  PaginatedCharacterGroupSummarySchema,
) {}
