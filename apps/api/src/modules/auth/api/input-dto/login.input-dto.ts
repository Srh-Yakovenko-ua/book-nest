import { LoginInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LoginInputDto extends createZodDto(LoginInputSchema) {}
