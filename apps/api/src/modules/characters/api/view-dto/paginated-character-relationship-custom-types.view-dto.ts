import { PaginatedCharacterRelationshipCustomTypesViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterRelationshipCustomTypesViewDto extends createZodDto(
  PaginatedCharacterRelationshipCustomTypesViewSchema,
) {}
