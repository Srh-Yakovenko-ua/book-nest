import { PaginatedCharacterBooksSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterBooksDto extends createZodDto(PaginatedCharacterBooksSchema) {}
