import { CharacterOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterOverviewDto extends createZodDto(CharacterOverviewViewSchema) {}
