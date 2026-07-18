import { CharacterSeriesProfileViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterSeriesProfileViewDto extends createZodDto(CharacterSeriesProfileViewSchema) {}
