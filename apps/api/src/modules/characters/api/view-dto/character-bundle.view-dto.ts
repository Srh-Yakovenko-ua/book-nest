import { CharacterBundleSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterBundleDto extends createZodDto(CharacterBundleSchema) {}
