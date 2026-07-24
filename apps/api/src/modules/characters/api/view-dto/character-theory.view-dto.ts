import { CharacterTheoryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterTheoryViewDto extends createZodDto(CharacterTheoryViewSchema) {}
