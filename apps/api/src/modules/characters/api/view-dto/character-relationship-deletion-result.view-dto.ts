import { CharacterRelationshipDeletionResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipDeletionResultViewDto extends createZodDto(
  CharacterRelationshipDeletionResultViewSchema,
) {}
