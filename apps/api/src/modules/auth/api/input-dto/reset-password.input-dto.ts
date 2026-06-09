import { ResetPasswordInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ResetPasswordInputDto extends createZodDto(ResetPasswordInputSchema) {}
