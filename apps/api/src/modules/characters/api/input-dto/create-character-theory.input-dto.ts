import { CreateCharacterTheoryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterTheoryInputDto extends createZodDto(CreateCharacterTheoryInputSchema) {}
