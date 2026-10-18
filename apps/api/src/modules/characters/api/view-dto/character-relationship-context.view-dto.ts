import { CharacterRelationshipSafeContextViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipSafeContextViewDto extends createZodDto(
  CharacterRelationshipSafeContextViewSchema,
) {}
