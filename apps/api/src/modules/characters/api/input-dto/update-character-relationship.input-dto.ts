import { UpdateCharacterRelationshipSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterRelationshipInputDto extends createZodDto(
  UpdateCharacterRelationshipSchema,
) {}
