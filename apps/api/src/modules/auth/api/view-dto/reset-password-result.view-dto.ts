import { ResetPasswordResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ResetPasswordResultViewDto extends createZodDto(ResetPasswordResultViewSchema) {}
