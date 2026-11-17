import { CharacterRelationshipCustomTypesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterRelationshipCustomTypesQueryDto extends createZodDto(
  CharacterRelationshipCustomTypesQuerySchema,
) {}
