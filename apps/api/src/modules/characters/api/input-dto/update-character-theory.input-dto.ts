import { UpdateCharacterTheoryInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterTheoryInputDto extends createZodDto(UpdateCharacterTheoryInputSchema) {}
