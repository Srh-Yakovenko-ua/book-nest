import { CharacterSuggestionsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterSuggestionsDto extends createZodDto(CharacterSuggestionsViewSchema) {}
