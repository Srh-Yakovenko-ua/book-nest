import { RegistrationResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RegistrationResultViewDto extends createZodDto(RegistrationResultViewSchema) {}
