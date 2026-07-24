import { CharacterRelationshipDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipDetailsViewDto extends createZodDto(
  CharacterRelationshipDetailsViewSchema,
) {}
