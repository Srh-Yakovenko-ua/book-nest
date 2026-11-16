import { ResendVerificationResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ResendVerificationResultViewDto extends createZodDto(
  ResendVerificationResultViewSchema,
) {}
