import { CharacterGroupsListQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CharacterGroupsListQueryDto extends createZodDto(CharacterGroupsListQuerySchema) {}
