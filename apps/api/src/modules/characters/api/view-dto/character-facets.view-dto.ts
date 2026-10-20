import { CharacterFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterFacetsDto extends createZodDto(CharacterFacetsViewSchema) {}
