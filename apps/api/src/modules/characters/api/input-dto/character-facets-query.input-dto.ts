import { CharacterFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterFacetsQueryDto extends createZodDto(CharacterFacetsQuerySchema) {}
