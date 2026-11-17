import { PaginatedCharacterRelationshipRoleSuggestionsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterRelationshipRoleSuggestionsViewDto extends createZodDto(
  PaginatedCharacterRelationshipRoleSuggestionsViewSchema,
) {}
