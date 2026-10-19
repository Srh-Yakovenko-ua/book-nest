import { CreateCharacterFactInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterFactInputDto extends createZodDto(CreateCharacterFactInputSchema) {}
