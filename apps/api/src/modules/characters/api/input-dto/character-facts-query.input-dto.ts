import { CharacterFactsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterFactsQueryDto extends createZodDto(CharacterFactsQuerySchema) {}
