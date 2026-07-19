import { CharacterGraphViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGraphViewDto extends createZodDto(CharacterGraphViewSchema) {}
