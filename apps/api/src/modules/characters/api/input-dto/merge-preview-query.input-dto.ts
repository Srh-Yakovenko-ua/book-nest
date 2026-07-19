import { CharacterMergePreviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterMergePreviewQueryDto extends createZodDto(CharacterMergePreviewQuerySchema) {}
