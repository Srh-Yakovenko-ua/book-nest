import { CharacterDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterDetailsViewDto extends createZodDto(CharacterDetailsViewSchema) {}
