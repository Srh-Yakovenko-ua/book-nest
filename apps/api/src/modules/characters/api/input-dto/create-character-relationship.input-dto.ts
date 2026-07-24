import { CreateCharacterRelationshipSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterRelationshipInputDto extends createZodDto(
  CreateCharacterRelationshipSchema,
) {}
