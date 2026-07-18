import { CharacterDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterDeletionResultDto extends createZodDto(CharacterDeletionResultSchema) {}
