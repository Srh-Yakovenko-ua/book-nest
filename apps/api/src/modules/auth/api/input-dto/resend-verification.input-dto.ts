import { ResendVerificationSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ResendVerificationInputDto extends createZodDto(ResendVerificationSchema) {}
