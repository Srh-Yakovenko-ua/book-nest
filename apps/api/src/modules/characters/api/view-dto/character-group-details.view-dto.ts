import { CharacterGroupDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGroupDetailsViewDto extends createZodDto(CharacterGroupDetailsViewSchema) {}
