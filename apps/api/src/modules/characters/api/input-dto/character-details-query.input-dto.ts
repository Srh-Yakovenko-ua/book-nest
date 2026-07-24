import { CharacterDetailsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterDetailsQueryDto extends createZodDto(CharacterDetailsQuerySchema) {}
