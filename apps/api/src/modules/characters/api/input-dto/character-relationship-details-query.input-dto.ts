import { CharacterRelationshipDetailsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipDetailsQueryDto extends createZodDto(
  CharacterRelationshipDetailsQuerySchema,
) {}
