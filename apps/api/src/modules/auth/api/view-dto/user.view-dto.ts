import { UserViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UserViewDto extends createZodDto(UserViewSchema) {}
