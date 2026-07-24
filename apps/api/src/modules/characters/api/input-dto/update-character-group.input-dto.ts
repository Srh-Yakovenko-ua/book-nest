import { UpdateCharacterGroupSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterGroupInputDto extends createZodDto(UpdateCharacterGroupSchema) {}
