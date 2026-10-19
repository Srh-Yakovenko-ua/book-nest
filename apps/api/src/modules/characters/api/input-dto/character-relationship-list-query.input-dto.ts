import { CharacterRelationshipListQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipListQueryDto extends createZodDto(
  CharacterRelationshipListQuerySchema,
) {}
