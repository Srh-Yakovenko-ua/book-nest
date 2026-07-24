import { CharacterBundleSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterImportBundleDto extends createZodDto(CharacterBundleSchema) {}
