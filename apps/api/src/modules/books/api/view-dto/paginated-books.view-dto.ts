import { PaginatedBooksSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedBooksDto extends createZodDto(PaginatedBooksSchema) {}
