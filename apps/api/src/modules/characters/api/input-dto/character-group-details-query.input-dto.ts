import { CharacterGroupDetailsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGroupDetailsQueryDto extends createZodDto(CharacterGroupDetailsQuerySchema) {}
