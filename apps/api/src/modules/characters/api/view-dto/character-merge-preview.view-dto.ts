import { CharacterMergePreviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterMergePreviewDto extends createZodDto(CharacterMergePreviewViewSchema) {}
