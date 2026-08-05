import { PaginatedTrashSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashDto extends createZodDto(PaginatedTrashSchema) {}
