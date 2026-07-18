import { CharacterSuggestionsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterSuggestionsQueryDto extends createZodDto(CharacterSuggestionsQuerySchema) {}
