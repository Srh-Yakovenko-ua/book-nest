import { RegistrationInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RegistrationInputDto extends createZodDto(RegistrationInputSchema) {}
