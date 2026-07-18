import { CreateCharacterSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterInputDto extends createZodDto(CreateCharacterSchema) {}
