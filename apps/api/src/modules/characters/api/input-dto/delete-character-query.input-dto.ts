import { DeleteCharacterQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeleteCharacterQueryDto extends createZodDto(DeleteCharacterQuerySchema) {}
