import { PaginatedAuthorsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedAuthorsDto extends createZodDto(PaginatedAuthorsSchema) {}
