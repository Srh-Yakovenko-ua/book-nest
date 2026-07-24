import { CharacterRelationshipPathQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipPathQueryDto extends createZodDto(
  CharacterRelationshipPathQuerySchema,
) {}
