import { UpdateProfileInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateProfileInputDto extends createZodDto(UpdateProfileInputSchema) {}
