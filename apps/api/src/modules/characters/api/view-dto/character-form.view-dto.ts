import { CharacterFormViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterFormViewDto extends createZodDto(CharacterFormViewSchema) {}
