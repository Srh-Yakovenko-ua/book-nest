import { CharacterDuplicateCandidatesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterDuplicateCandidatesQueryDto extends createZodDto(
  CharacterDuplicateCandidatesQuerySchema,
) {}
