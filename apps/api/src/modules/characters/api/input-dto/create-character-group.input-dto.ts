import { CreateCharacterGroupSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterGroupInputDto extends createZodDto(CreateCharacterGroupSchema) {}
