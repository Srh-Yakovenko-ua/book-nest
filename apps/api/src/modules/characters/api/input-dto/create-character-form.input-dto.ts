import { CreateCharacterFormSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateCharacterFormInputDto extends createZodDto(CreateCharacterFormSchema) {}
