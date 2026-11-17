import { CharacterRelationshipRoleSuggestionsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipRoleSuggestionsQueryDto extends createZodDto(
  CharacterRelationshipRoleSuggestionsQuerySchema,
) {}
