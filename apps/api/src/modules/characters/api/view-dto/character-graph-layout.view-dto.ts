import { CharacterGraphLayoutViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGraphLayoutViewDto extends createZodDto(CharacterGraphLayoutViewSchema) {}
