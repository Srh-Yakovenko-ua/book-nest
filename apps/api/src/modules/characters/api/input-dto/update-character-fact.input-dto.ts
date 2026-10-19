import { UpdateCharacterFactInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterFactInputDto extends createZodDto(UpdateCharacterFactInputSchema) {}
