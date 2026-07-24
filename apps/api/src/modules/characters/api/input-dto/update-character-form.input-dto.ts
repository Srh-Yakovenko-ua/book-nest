import { UpdateCharacterFormSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateCharacterFormInputDto extends createZodDto(UpdateCharacterFormSchema) {}
