import { CharacterTheoriesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterTheoriesQueryDto extends createZodDto(CharacterTheoriesQuerySchema) {}
