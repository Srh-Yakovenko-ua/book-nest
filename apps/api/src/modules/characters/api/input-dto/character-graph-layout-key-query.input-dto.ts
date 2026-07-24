import { CharacterGraphLayoutKeyQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGraphLayoutKeyQueryDto extends createZodDto(
  CharacterGraphLayoutKeyQuerySchema,
) {}
