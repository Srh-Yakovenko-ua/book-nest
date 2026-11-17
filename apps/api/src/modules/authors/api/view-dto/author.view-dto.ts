import { AuthorViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthorViewDto extends createZodDto(AuthorViewSchema) {}
