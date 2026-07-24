import { CharacterImportResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterImportResultDto extends createZodDto(CharacterImportResultViewSchema) {}
