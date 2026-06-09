import { ForgotPasswordInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ForgotPasswordInputDto extends createZodDto(ForgotPasswordInputSchema) {}
