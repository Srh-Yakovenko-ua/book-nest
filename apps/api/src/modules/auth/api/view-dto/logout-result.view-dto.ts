import { LogoutResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LogoutResultViewDto extends createZodDto(LogoutResultViewSchema) {}
