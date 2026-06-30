import { VerifyEmailSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class VerifyEmailInputDto extends createZodDto(VerifyEmailSchema) {}
