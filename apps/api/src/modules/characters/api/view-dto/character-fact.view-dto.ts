import { CharacterFactViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterFactViewDto extends createZodDto(CharacterFactViewSchema) {}
