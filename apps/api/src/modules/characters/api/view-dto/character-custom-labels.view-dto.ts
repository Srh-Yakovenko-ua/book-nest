import { CharacterCustomLabelsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterCustomLabelsViewDto extends createZodDto(CharacterCustomLabelsViewSchema) {}
