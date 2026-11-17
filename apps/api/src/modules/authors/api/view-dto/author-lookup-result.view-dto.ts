import { AuthorLookupResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AuthorLookupResultDto extends createZodDto(AuthorLookupResultSchema) {}
