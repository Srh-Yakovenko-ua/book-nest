import { CharacterMergeResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterMergeResultDto extends createZodDto(CharacterMergeResultViewSchema) {}
