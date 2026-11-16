import { AuthResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthResultViewDto extends createZodDto(AuthResultViewSchema) {}
