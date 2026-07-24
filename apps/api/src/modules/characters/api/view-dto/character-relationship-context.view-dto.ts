import { CharacterRelationshipContextViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipContextViewDto extends createZodDto(
  CharacterRelationshipContextViewSchema,
) {}
