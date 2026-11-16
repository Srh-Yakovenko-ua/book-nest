import { ForgotPasswordResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ForgotPasswordResultViewDto extends createZodDto(ForgotPasswordResultViewSchema) {}
