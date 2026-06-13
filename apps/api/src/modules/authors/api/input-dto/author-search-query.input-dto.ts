import { AuthorSearchPaginationQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthorSearchPaginationQueryDto extends createZodDto(
  AuthorSearchPaginationQuerySchema,
) {}
