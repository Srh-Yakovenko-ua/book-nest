import { ChangePasswordInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ChangePasswordInputDto extends createZodDto(ChangePasswordInputSchema) {}
