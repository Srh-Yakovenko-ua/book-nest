import { UpdateCharacterSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterInputDto extends createZodDto(UpdateCharacterSchema) {}
