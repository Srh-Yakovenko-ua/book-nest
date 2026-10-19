import { CharacterRelationshipSafeDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipSafeDetailsViewDto extends createZodDto(
  CharacterRelationshipSafeDetailsViewSchema,
) {}
