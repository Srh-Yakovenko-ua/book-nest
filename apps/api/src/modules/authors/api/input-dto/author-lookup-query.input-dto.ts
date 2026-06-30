import { AuthorLookupQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthorLookupQueryDto extends createZodDto(AuthorLookupQuerySchema) {}
