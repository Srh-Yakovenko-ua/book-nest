import { UpdateBookCharacterSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateBookCharacterInputDto extends createZodDto(UpdateBookCharacterSchema) {}
