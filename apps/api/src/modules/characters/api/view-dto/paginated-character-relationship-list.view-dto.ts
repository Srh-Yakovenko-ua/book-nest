import { PaginatedCharacterRelationshipListViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterRelationshipListViewDto extends createZodDto(
  PaginatedCharacterRelationshipListViewSchema,
) {}
