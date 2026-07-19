import { CharacterMergeInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MergeCharacterInputDto extends createZodDto(CharacterMergeInputSchema) {}
