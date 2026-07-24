import { CharacterRelationshipPathViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipPathViewDto extends createZodDto(
  CharacterRelationshipPathViewSchema,
) {}
