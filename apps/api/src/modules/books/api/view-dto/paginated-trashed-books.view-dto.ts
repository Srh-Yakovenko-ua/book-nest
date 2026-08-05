import { PaginatedTrashedBooksSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashedBooksDto extends createZodDto(PaginatedTrashedBooksSchema) {}
